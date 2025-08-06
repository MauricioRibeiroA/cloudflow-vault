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

      // DELETE - Delete file or folder
      if (body.action === 'delete') {
        console.log('Deleting file/folder:', body.key);
        
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
        console.log('File/folder deleted successfully:', keyToDelete);

        return new Response(JSON.stringify({
          success: true,
          message: 'File/folder deleted successfully',
          deletedKey: keyToDelete
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
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
