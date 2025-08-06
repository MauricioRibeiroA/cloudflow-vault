import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    console.log('=== B2 PROXY ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);

    const b2Config = {
      accessKeyId: Deno.env.get('B2_ACCESS_KEY_ID') || '005c579be2fa8160000000002',
      secretAccessKey: Deno.env.get('B2_SECRET_ACCESS_KEY') || 'K005W5lkzoEz7H1PvH2NwRPiLsqhalg',
      region: Deno.env.get('B2_REGION') || 'us-east-005',
      endpoint: Deno.env.get('B2_ENDPOINT') || 'https://s3.us-east-005.backblazeb2.com',
      bucket: Deno.env.get('B2_BUCKET_NAME') || 'cloud-clients-cloudflow',
    };
    
    // Garantir que o endpoint tenha o protocolo https://
    if (b2Config.endpoint && !b2Config.endpoint.startsWith('http')) {
      b2Config.endpoint = `https://${b2Config.endpoint}`;
    }

    console.log('B2 Config check:', {
      hasAccessKey: !!b2Config.accessKeyId,
      hasSecret: !!b2Config.secretAccessKey,
      region: b2Config.region,
      endpoint: b2Config.endpoint,
      bucket: b2Config.bucket
    });

    // Simple response for testing
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Request body:', body);

      if (body.action === 'test') {
        return new Response(JSON.stringify({
          success: true,
          message: "B2 Proxy working!",
          config: {
            hasAccessKey: !!b2Config.accessKeyId,
            hasSecret: !!b2Config.secretAccessKey,
            endpoint: b2Config.endpoint
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (body.action === 'debug') {
        return new Response(JSON.stringify({
          success: true,
          message: "Debug info",
          credentials: {
            accessKeyId: b2Config.accessKeyId?.substring(0, 8) + '...' + b2Config.accessKeyId?.substring(-4),
            secretLength: b2Config.secretAccessKey?.length || 0,
            secretStart: b2Config.secretAccessKey?.substring(0, 4) + '...',
            region: b2Config.region,
            endpoint: b2Config.endpoint,
            bucket: b2Config.bucket
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // Import AWS SDK with specific configuration to prevent file system access
      // Use CDN with explicit no-node flag to prevent Node.js specific code
      const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = await import("https://cdn.skypack.dev/@aws-sdk/client-s3@3.445.0?dts");
      const { getSignedUrl } = await import("https://cdn.skypack.dev/@aws-sdk/s3-request-presigner@3.445.0?dts");
      
      // Create S3Client with minimal configuration
      const s3Client = new S3Client({
        region: b2Config.region || 'us-west-004',
        endpoint: b2Config.endpoint,
        credentials: {
          accessKeyId: b2Config.accessKeyId!,
          secretAccessKey: b2Config.secretAccessKey!,
        },
        forcePathStyle: true,
      });

      if (body.action === 'list') {
        const path = body.path || '';
        const prefix = `cloud-vault/${path}`;
        console.log('Listing files with prefix:', prefix);
        
        const command = new ListObjectsV2Command({
          Bucket: b2Config.bucket,
          MaxKeys: 1000,
          Prefix: prefix,
          Delimiter: '/', // Always use delimiter to detect folders
        });

        const response = await s3Client.send(command);
        console.log('S3 Response Contents:', response.Contents?.length || 0, 'files');
        console.log('S3 Response CommonPrefixes:', response.CommonPrefixes?.length || 0, 'folders');
        console.log('Full S3 Response:', JSON.stringify(response, null, 2));

        // Process files and folders
        const files = [];
        
        // Add regular files
        if (response.Contents) {
          console.log('Processing Contents...');
          for (const item of response.Contents) {
            if (item.Key && item.Key !== prefix) { // Skip the prefix itself
              const relativePath = item.Key.replace(prefix, '');
              console.log('Processing file:', item.Key, '-> relativePath:', relativePath);
              // Only files in current directory (no nested folders) and not system files
              if (relativePath && !relativePath.includes('/') && 
                  relativePath !== '.folderkeeper' && 
                  relativePath !== '.foldermarker' && 
                  relativePath !== 'folder_marker(2)') {
                files.push({
                  Key: item.Key,
                  name: relativePath,
                  Size: item.Size || 0,
                  LastModified: item.LastModified,
                  isFolder: false
                });
                console.log('Added file:', relativePath);
              } else if (relativePath === '.folderkeeper' || relativePath === '.foldermarker' || relativePath === 'folder_marker(2)') {
                console.log('Skipping system file:', relativePath);
              }
            }
          }
        }
        
        // Add folders (CommonPrefixes)
        if (response.CommonPrefixes) {
          console.log('Processing CommonPrefixes...');
          for (const folderPrefix of response.CommonPrefixes) {
            console.log('Processing prefix:', folderPrefix.Prefix);
            if (folderPrefix.Prefix && folderPrefix.Prefix !== prefix) {
              const relativeFolderPath = folderPrefix.Prefix.replace(prefix, '').replace('/', '');
              console.log('Folder name extracted:', relativeFolderPath);
              if (relativeFolderPath) {
                files.push({
                  Key: folderPrefix.Prefix,
                  name: relativeFolderPath,
                  Size: 0,
                  LastModified: new Date().toISOString(),
                  isFolder: true
                });
                console.log('Added folder:', relativeFolderPath);
              }
            }
          }
        } else {
          console.log('No CommonPrefixes found - this means no folders detected');
        }
        
        console.log('Final processed files:', files.map(f => ({ name: f.name, isFolder: f.isFolder })));

        return new Response(JSON.stringify({
          success: true,
          files: files,
          folders: response.CommonPrefixes || [],
          count: files.length,
          prefix: 'cloud-vault/',
          timestamp: new Date().toISOString()
        }), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            // Add cache-control headers to ensure fresh data
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          status: 200
        });
      }

      // UPLOAD (CREATE) - Handle file upload
      if (body.action === 'upload') {
        console.log('Uploading file:', body.fileName);
        
        if (!body.fileName || !body.fileContent) {
          return new Response(JSON.stringify({
            error: 'fileName and fileContent are required for upload'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const filePath = `cloud-vault/${body.path || ''}${body.fileName}`;
        
        // Convert base64 string back to binary if needed
        let fileBody;
        if (body.isBase64) {
          const binaryString = atob(body.fileContent);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileBody = bytes;
        } else {
          fileBody = body.fileContent;
        }

        const command = new PutObjectCommand({
          Bucket: b2Config.bucket,
          Key: filePath,
          Body: fileBody,
          ContentType: body.contentType || 'application/octet-stream',
        });

        await s3Client.send(command);
        console.log('File uploaded successfully:', filePath);

        return new Response(JSON.stringify({
          success: true,
          message: 'File uploaded successfully',
          filePath: filePath
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // DELETE - Delete file only (single object)
      if (body.action === 'delete') {
        console.log('Deleting file:', body.key);
        
        if (!body.key) {
          return new Response(JSON.stringify({
            error: 'key is required for delete operation'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Ensure key has proper prefix
        const keyToDelete = body.key.startsWith('cloud-vault/') ? body.key : `cloud-vault/${body.key}`;
        
        const command = new DeleteObjectCommand({
          Bucket: b2Config.bucket,
          Key: keyToDelete,
        });

        await s3Client.send(command);
        console.log('File deleted successfully:', keyToDelete);

        return new Response(JSON.stringify({
          success: true,
          message: 'File deleted successfully',
          deletedKey: keyToDelete
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // DELETE FOLDER - Delete folder recursively (all contents)
      if (body.action === 'deleteFolder') {
        console.log('Deleting folder recursively:', body.folderPath);
        
        if (!body.folderPath) {
          return new Response(JSON.stringify({
            error: 'folderPath is required for deleteFolder operation'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Ensure folder path has proper prefix and ends with '/'
        let folderPath = body.folderPath;
        if (!folderPath.startsWith('cloud-vault/')) {
          folderPath = `cloud-vault/${folderPath}`;
        }
        if (!folderPath.endsWith('/')) {
          folderPath += '/';
        }
        
        console.log('Folder path normalized:', folderPath);
        
        try {
          // Step 1: List all objects in the folder (recursively)
          const listCommand = new ListObjectsV2Command({
            Bucket: b2Config.bucket,
            Prefix: folderPath,
            // No delimiter - get ALL objects under this prefix
          });

          const listResponse = await s3Client.send(listCommand);
          const objectsToDelete = listResponse.Contents || [];
          
          console.log(`Found ${objectsToDelete.length} objects to delete in folder:`, folderPath);
          
          if (objectsToDelete.length === 0) {
            return new Response(JSON.stringify({
              success: true,
              message: 'Folder was already empty or does not exist',
              folderPath: folderPath,
              deletedObjects: []
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            });
          }

          // Step 2: Delete all objects in parallel (limited batches for safety)
          const deletePromises = [];
          const deletedKeys = [];
          
          for (const object of objectsToDelete) {
            if (object.Key) {
              console.log('Deleting object:', object.Key);
              const deleteCommand = new DeleteObjectCommand({
                Bucket: b2Config.bucket,
                Key: object.Key,
              });
              
              deletePromises.push(
                s3Client.send(deleteCommand).then(() => {
                  deletedKeys.push(object.Key!);
                  console.log('✅ Deleted:', object.Key);
                }).catch((error) => {
                  console.error('❌ Failed to delete:', object.Key, error);
                  throw error;
                })
              );
            }
          }

          // Wait for all deletions to complete
          await Promise.all(deletePromises);
          
          console.log(`Successfully deleted folder with ${deletedKeys.length} objects:`, folderPath);

          return new Response(JSON.stringify({
            success: true,
            message: `Folder deleted successfully with ${deletedKeys.length} objects`,
            folderPath: folderPath,
            deletedObjects: deletedKeys,
            totalDeleted: deletedKeys.length
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });

        } catch (error) {
          console.error('Error deleting folder:', error);
          return new Response(JSON.stringify({
            error: 'Failed to delete folder',
            details: error.message,
            folderPath: folderPath
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // DOWNLOAD - Serve file directly to avoid CORS issues
      if (body.action === 'download') {
        console.log('Serving file directly for download:', body.key);
        
        if (!body.key) {
          return new Response(JSON.stringify({
            error: 'key is required for download operation'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Ensure key has proper prefix
        const keyToDownload = body.key.startsWith('cloud-vault/') ? body.key : `cloud-vault/${body.key}`;
        
        const command = new GetObjectCommand({
          Bucket: b2Config.bucket,
          Key: keyToDownload,
        });

        try {
          const response = await s3Client.send(command);
          
          if (!response.Body) {
            return new Response(JSON.stringify({
              error: 'File not found or empty'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Get the file content as Uint8Array
          const chunks = [];
          const reader = response.Body.getReader();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          
          // Combine all chunks
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const combinedArray = new Uint8Array(totalLength);
          let offset = 0;
          
          for (const chunk of chunks) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
          }
          
          // Extract filename from key
          const fileName = keyToDownload.split('/').pop() || 'download';
          
          console.log('File served successfully:', keyToDownload, 'Size:', combinedArray.length);

          return new Response(combinedArray, {
            headers: {
              ...corsHeaders,
              'Content-Type': response.ContentType || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Content-Length': combinedArray.length.toString(),
            },
            status: 200
          });
        } catch (error) {
          console.error('Error retrieving file:', error);
          return new Response(JSON.stringify({
            error: 'Failed to retrieve file',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // DEBUG ACTION - List all files without filtering
      if (body.action === 'listAllFiles') {
        const path = body.path || '';
        const prefix = `cloud-vault/${path}`;
        console.log('Listing ALL files with prefix:', prefix);
        
        const command = new ListObjectsV2Command({
          Bucket: b2Config.bucket,
          MaxKeys: 1000,
          Prefix: prefix,
          // No delimiter - show all files
        });

        const response = await s3Client.send(command);
        console.log('All files found:', response.Contents?.length || 0);
        
        const allFiles = [];
        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key) {
              allFiles.push({
                Key: item.Key,
                Size: item.Size || 0,
                LastModified: item.LastModified,
                StorageClass: item.StorageClass
              });
            }
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          allFiles: allFiles,
          count: allFiles.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // CREATE FOLDER WITH folder_marker(2) (exactly like the working folders)
      if (body.action === 'createFolderOldWay') {
        console.log('Creating folder the EXACT OLD way with folder_marker(2):', body.folderPath);
        
        if (!body.folderPath) {
          return new Response(JSON.stringify({
            error: 'folderPath is required for createFolderOldWay operation'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Ensure folder path has proper prefix and ends with '/'
        let folderPath = body.folderPath;
        if (!folderPath.startsWith('cloud-vault/')) {
          folderPath = `cloud-vault/${folderPath}`;
        }
        if (!folderPath.endsWith('/')) {
          folderPath += '/';
        }
        
        // Create folder_marker(2) file exactly like the working folders
        const markerPath = folderPath + 'folder_marker(2)';
        
        // Use specific content matching the file name
        const markerContent = new TextEncoder().encode('folder_marker(2)');
        const markerCommand = new PutObjectCommand({
          Bucket: b2Config.bucket,
          Key: markerPath,
          Body: markerContent,
          ContentType: 'application/x-directory',
        });

        await s3Client.send(markerCommand);
        console.log('folder_marker(2) created successfully in folder:', markerPath);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Folder created successfully with folder_marker(2) (exact old way)',
          folderPath: folderPath,
          markerFile: markerPath
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // CREATE FOLDER - Create folder with folder_marker(2) to ensure it's visible in B2 UI
      if (body.action === 'createFolder') {
        console.log('Creating folder:', body.folderPath);
        
        if (!body.folderPath) {
          return new Response(JSON.stringify({
            error: 'folderPath is required for createFolder operation'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Ensure folder path has proper prefix and ends with '/'
        let folderPath = body.folderPath;
        if (!folderPath.startsWith('cloud-vault/')) {
          folderPath = `cloud-vault/${folderPath}`;
        }
        if (!folderPath.endsWith('/')) {
          folderPath += '/';
        }
        
        // Create folder_marker(2) file exactly like working folders
        const markerPath = folderPath + 'folder_marker(2)';
        
        const markerContent = new TextEncoder().encode('folder_marker(2)');
        const markerCommand = new PutObjectCommand({
          Bucket: b2Config.bucket,
          Key: markerPath,
          Body: markerContent,
          ContentType: 'application/x-directory',
          // Add cache-busting metadata to force refresh
          Metadata: {
            'created-at': new Date().toISOString(),
            'cache-buster': Date.now().toString()
          }
        });

        await s3Client.send(markerCommand);
        console.log('folder_marker(2) created successfully in folder:', markerPath);
        
        // Wait a moment and then verify the folder was created
        console.log('Waiting 500ms before verifying folder creation...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify folder creation with immediate list
        try {
          const verifyCommand = new ListObjectsV2Command({
            Bucket: b2Config.bucket,
            MaxKeys: 10,
            Prefix: folderPath,
          });
          
          const verifyResponse = await s3Client.send(verifyCommand);
          const markerFound = verifyResponse.Contents?.some(item => item.Key === markerPath);
          console.log('Folder verification - Marker found:', markerFound);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Folder created successfully with folder_marker(2)',
            folderPath: folderPath,
            markerFile: markerPath,
            verified: markerFound,
            createdAt: new Date().toISOString()
          }), {
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              // Add cache-control headers to prevent caching
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            status: 200
          });
        } catch (verifyError) {
          console.error('Folder verification failed:', verifyError);
          return new Response(JSON.stringify({
            success: true,
            message: 'Folder created but verification failed',
            folderPath: folderPath,
            markerFile: markerPath,
            verified: false,
            verifyError: verifyError.message,
            createdAt: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }
      }

      // CREATE COMPANY STRUCTURE - Cria estrutura completa de pastas para nova empresa
      if (body.action === 'createCompanyStructure') {
        console.log('Creating company structure:', body.companyId);
        
        if (!body.companyId) {
          return new Response(JSON.stringify({
            error: 'companyId is required for createCompanyStructure operation'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const companyId = body.companyId;
        const basePath = `cloud-vault/company-${companyId}/`;
        
        // Definir estrutura de pastas
        const foldersToCreate = [
          `${basePath}users/`,
          `${basePath}shared/`,
          `${basePath}shared/documents/`,
          `${basePath}shared/projects/`,
          `${basePath}shared/templates/`,
          `${basePath}admin/`
        ];

        console.log('Creating folders:', foldersToCreate);
        
        const createdFolders = [];
        const errors = [];
        
        // Criar cada pasta sequencialmente para evitar problemas de concorrência
        for (const folderPath of foldersToCreate) {
          try {
            const markerPath = folderPath + 'folder_marker(2)';
            const markerContent = new TextEncoder().encode('folder_marker(2)');
            
            const markerCommand = new PutObjectCommand({
              Bucket: b2Config.bucket,
              Key: markerPath,
              Body: markerContent,
              ContentType: 'application/x-directory',
              Metadata: {
                'company-id': companyId,
                'created-at': new Date().toISOString(),
                'folder-type': 'company-structure'
              }
            });

            await s3Client.send(markerCommand);
            createdFolders.push({
              path: folderPath,
              marker: markerPath,
              success: true
            });
            console.log('✅ Created folder:', folderPath);
            
          } catch (error) {
            console.error('❌ Failed to create folder:', folderPath, error);
            errors.push({
              path: folderPath,
              error: error.message
            });
          }
        }
        
        const success = errors.length === 0;
        
        return new Response(JSON.stringify({
          success: success,
          message: success 
            ? `Company structure created successfully for ${companyId}` 
            : `Company structure created with ${errors.length} errors`,
          companyId: companyId,
          createdFolders: createdFolders,
          errors: errors,
          totalCreated: createdFolders.length,
          totalErrors: errors.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: success ? 200 : 207 // 207 Multi-Status para parcial sucesso
        });
      }

      // CREATE USER PERSONAL FOLDER - Cria pasta pessoal para novo usuário
      if (body.action === 'createUserPersonalFolder') {
        console.log('Creating user personal folder:', body.userId, 'for company:', body.companyId);
        
        if (!body.userId || !body.companyId) {
          return new Response(JSON.stringify({
            error: 'userId and companyId are required for createUserPersonalFolder operation'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const userFolderPath = `cloud-vault/company-${body.companyId}/users/user-${body.userId}/`;
        const markerPath = userFolderPath + 'folder_marker(2)';
        
        try {
          const markerContent = new TextEncoder().encode('folder_marker(2)');
          const markerCommand = new PutObjectCommand({
            Bucket: b2Config.bucket,
            Key: markerPath,
            Body: markerContent,
            ContentType: 'application/x-directory',
            Metadata: {
              'user-id': body.userId,
              'company-id': body.companyId,
              'created-at': new Date().toISOString(),
              'folder-type': 'user-personal'
            }
          });

          await s3Client.send(markerCommand);
          console.log('✅ Created user personal folder:', userFolderPath);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'User personal folder created successfully',
            userId: body.userId,
            companyId: body.companyId,
            folderPath: userFolderPath,
            markerFile: markerPath
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
          
        } catch (error) {
          console.error('❌ Failed to create user personal folder:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to create user personal folder',
            details: error.message,
            userId: body.userId,
            companyId: body.companyId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      error: 'Method not supported',
      method: req.method
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('B2 Proxy Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
