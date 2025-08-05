import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 B2 File Manager function called - Method:', req.method, 'URL:', req.url);

  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log environment check
    console.log('🔧 Checking environment variables...');
    const requiredEnvs = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'B2_ACCESS_KEY_ID', 'B2_SECRET_ACCESS_KEY', 'B2_BUCKET_NAME', 'B2_REGION', 'B2_ENDPOINT'];
    const missingEnvs = requiredEnvs.filter(env => !Deno.env.get(env));
    if (missingEnvs.length > 0) {
      console.error('❌ Missing environment variables:', missingEnvs);
      return new Response(JSON.stringify({ error: 'Missing required environment variables', missing: missingEnvs }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('✅ All environment variables present');

    // Get JWT token from request
    console.log('🔐 Checking authorization...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('✅ Token extracted from header');

    // Initialize Supabase client
    console.log('🔗 Initializing Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    console.log('👤 Verifying user authentication...');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message || 'No user found');
      return new Response(JSON.stringify({ error: 'Authentication failed', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('✅ User authenticated:', user.id);

    // Get user profile
    console.log('👥 Fetching user profile...');
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id, group_name, status')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ User profile not found:', profileError?.message);
      return new Response(JSON.stringify({ error: 'User profile not found', details: profileError?.message }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profile.status !== 'active') {
      console.error('❌ User account is not active:', profile.status);
      return new Response(JSON.stringify({ error: 'User account is not active' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('✅ User profile loaded - Company:', profile.company_id, 'Group:', profile.group_name);

    // Super admins can operate without company_id
    const isSuperAdmin = profile.group_name === 'super_admin';
    if (!isSuperAdmin && !profile.company_id) {
      console.error('❌ Invalid user profile - no company association');
      return new Response(JSON.stringify({ error: 'Invalid user profile - no company association' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    console.log('📋 Parsing request body...');
    const body = await req.json();
    const { action, ...payload } = body;
    console.log('🎯 Action requested:', action, 'Payload:', payload ? Object.keys(payload) : 'none');

    // B2 configuration
    console.log('⚙️ Loading B2 configuration...');
    const b2Config = {
      accessKeyId: Deno.env.get('B2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('B2_SECRET_ACCESS_KEY'),
      bucketName: Deno.env.get('B2_BUCKET_NAME'),
      region: Deno.env.get('B2_REGION'),
      endpoint: Deno.env.get('B2_ENDPOINT'),
    };

    // Verificar se as credenciais estão configuradas
    if (!b2Config.accessKeyId || !b2Config.secretAccessKey || !b2Config.bucketName) {
      console.error('❌ B2 credentials not configured');
      return new Response(JSON.stringify({ error: 'B2 credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test B2 connectivity
    if (action === 'test_connection') {
      console.log('🧪 Testing B2 connection...');
      try {
        const { S3Client, ListBucketsCommand } = await import("https://esm.sh/@aws-sdk/client-s3@3.445.0");
        const s3Client = new S3Client({
          region: b2Config.region,
          endpoint: b2Config.endpoint,
          credentials: {
            accessKeyId: b2Config.accessKeyId!,
            secretAccessKey: b2Config.secretAccessKey!,
          },
        });
        
        await s3Client.send(new ListBucketsCommand({}));
        console.log('✅ B2 connection successful');
        return new Response(JSON.stringify({ success: true, message: 'B2 connection successful' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ B2 connection failed:', error);
        return new Response(JSON.stringify({ error: 'B2 connection failed', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    switch (action) {
      case 'list_folders':
        console.log('📁 Listing folders...');
        // List folders from database
        let foldersQuery = supabaseClient
          .from('folders')
          .select('id, name, parent_id, created_at')
          .order('name');

        if (payload.parentId) {
          foldersQuery = foldersQuery.eq('parent_id', payload.parentId);
        } else {
          foldersQuery = foldersQuery.is('parent_id', null);
        }

        const { data: folders, error: foldersError } = await foldersQuery;
        if (foldersError) {
          console.error('❌ Error listing folders:', foldersError);
          throw foldersError;
        }

        console.log('✅ Folders listed:', folders?.length || 0);
        return new Response(JSON.stringify(folders), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'list_files':
        console.log('📄 Listing files...');
        // List files from database
        const { data: files, error: filesError } = await supabaseClient
          .from('files')
          .select('id, name, file_path, file_size, file_type, created_at')
          .eq('folder_id', payload.folderId || null)
          .order('name');

        if (filesError) {
          console.error('❌ Error listing files:', filesError);
          throw filesError;
        }

        console.log('✅ Files listed:', files?.length || 0);
        return new Response(JSON.stringify(files), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'create_folder':
        console.log('📁 Creating folder...');
        // Create folder in database
        const { folderName, parentId } = payload;
        
        const { data: newFolder, error: createError } = await supabaseClient
          .from('folders')
          .insert({
            name: folderName,
            parent_id: parentId || null,
            created_by: user.id,
            company_id: profile.company_id || null,
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating folder:', createError);
          throw createError;
        }

        // Log the folder creation
        await supabaseClient
          .from('logs')
          .insert({
            user_id: user.id,
            action: 'folder_create',
            target_type: 'folder',
            target_name: folderName,
            company_id: profile.company_id || null,
          });

        console.log('✅ Folder created:', newFolder);
        return new Response(JSON.stringify(newFolder), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get_download_url':
        console.log('📥 Generating download URL...');
        // Generate download URL for file
        const { fileId } = payload;
        
        // Get file info and verify access
        const { data: fileInfo } = await supabaseClient
          .from('files')
          .select('file_path, name, company_id, uploaded_by')
          .eq('id', fileId)
          .single();

        // Verify access: same company or super admin can access their own files
        if (fileInfo?.company_id !== profile.company_id && 
            !(isSuperAdmin && fileInfo?.uploaded_by === user.id)) {
          console.error('❌ File access denied');
          throw new Error('File not found or access denied');
        }

        if (!fileInfo) {
          console.error('❌ File not found');
          throw new Error('File not found or access denied');
        }

        // Importar S3 Client quando necessário para download
        const { S3Client, GetObjectCommand } = await import("https://esm.sh/@aws-sdk/client-s3@3.445.0");
        const { getSignedUrl } = await import("https://esm.sh/@aws-sdk/s3-request-presigner@3.445.0");

        const s3Client = new S3Client({
          region: b2Config.region,
          endpoint: b2Config.endpoint,
          credentials: {
            accessKeyId: b2Config.accessKeyId!,
            secretAccessKey: b2Config.secretAccessKey!,
          },
          forcePathStyle: true,
        });

        const getCommand = new GetObjectCommand({
          Bucket: b2Config.bucketName,
          Key: fileInfo.file_path,
        });

        const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

        console.log('✅ Download URL generated');
        return new Response(JSON.stringify({ 
          url: downloadUrl,
          filename: fileInfo.name 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get_usage':
        console.log('📊 Getting storage usage...');
        // Get storage usage
        let usageFiles, storageLimit;
        
        if (profile.company_id) {
          // Company usage
          const { data: companyFiles } = await supabaseClient
            .from('files')
            .select('file_size')
            .eq('company_id', profile.company_id);
          
          usageFiles = companyFiles;

          const { data: company } = await supabaseClient
            .from('companies')
            .select('settings')
            .eq('id', profile.company_id)
            .single();

          storageLimit = company?.settings?.storage_limit_gb || 10;
        } else {
          // Super admin personal usage
          const { data: personalFiles } = await supabaseClient
            .from('files')
            .select('file_size')
            .eq('uploaded_by', user.id)
            .is('company_id', null);
          
          usageFiles = personalFiles;
          storageLimit = 50; // 50GB for super admin personal files
        }

        const totalUsage = usageFiles?.reduce((sum, file) => sum + file.file_size, 0) || 0;
        const usageGB = totalUsage / (1024 * 1024 * 1024);

        console.log('✅ Usage calculated:', usageGB, '/', storageLimit, 'GB');
        return new Response(JSON.stringify({
          totalUsageBytes: totalUsage,
          totalUsageGB: usageGB,
          storageLimitGB: storageLimit,
          usagePercentage: (usageGB / storageLimit) * 100
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'save_metadata':
        console.log('💾 Saving file metadata...');
        // Save file metadata after successful upload
        const { fileName, filePath, fileSize, fileType, folderId } = payload;
        
        const { error: insertError } = await supabaseClient
          .from('files')
          .insert({
            name: fileName,
            file_path: filePath,
            file_size: fileSize,
            file_type: fileType,
            folder_id: folderId,
            uploaded_by: user.id,
            company_id: profile.company_id || null,
          });

        if (insertError) {
          console.error('❌ Error saving metadata:', insertError);
          throw insertError;
        }

        // Log the upload
        await supabaseClient
          .from('logs')
          .insert({
            user_id: user.id,
            action: 'file_upload_b2',
            target_type: 'file',
            target_name: fileName,
            company_id: profile.company_id || null,
            details: {
              file_size: fileSize,
              file_type: fileType,
              storage_backend: 'backblaze_b2'
            }
          });

        console.log('✅ File metadata saved');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'delete':
        console.log('🗑️ Deleting file...');
        const { fileId: deleteFileId } = payload;
        
        // Get file info and verify access
        const { data: fileToDelete } = await supabaseClient
          .from('files')
          .select('file_path, name, company_id, uploaded_by')
          .eq('id', deleteFileId)
          .single();

        // Verify access: same company or super admin can delete their own files
        if (fileToDelete?.company_id !== profile.company_id && 
            !(isSuperAdmin && fileToDelete?.uploaded_by === user.id)) {
          console.error('❌ Delete access denied');
          throw new Error('File not found or access denied');
        }

        if (!fileToDelete) {
          console.error('❌ File to delete not found');
          throw new Error('File not found or access denied');
        }

        // Importar S3 Client quando necessário para delete
        const { S3Client: S3DeleteClient, DeleteObjectCommand } = await import("https://esm.sh/@aws-sdk/client-s3@3.445.0");

        const s3DeleteClient = new S3DeleteClient({
          region: b2Config.region,
          endpoint: b2Config.endpoint,
          credentials: {
            accessKeyId: b2Config.accessKeyId!,
            secretAccessKey: b2Config.secretAccessKey!,
          },
          forcePathStyle: true,
        });

        // Delete from B2
        const deleteCommand = new DeleteObjectCommand({
          Bucket: b2Config.bucketName,
          Key: fileToDelete.file_path,
        });

        await s3DeleteClient.send(deleteCommand);

        // Delete from database
        const { error: deleteError } = await supabaseClient
          .from('files')
          .delete()
          .eq('id', deleteFileId);

        if (deleteError) {
          console.error('❌ Error deleting from database:', deleteError);
          throw deleteError;
        }

        // Log the deletion
        await supabaseClient
          .from('logs')
          .insert({
            user_id: user.id,
            action: 'file_delete_b2',
            target_type: 'file',
            target_name: fileToDelete.name,
            company_id: profile.company_id || null,
            details: {
              storage_backend: 'backblaze_b2',
              file_path: fileToDelete.file_path
            }
          });

        console.log('✅ File deleted successfully');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        console.error('❌ Invalid action:', action);
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('❌ Error in B2 File Manager:', error);
    console.error('❌ Stack trace:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack || 'No stack trace available',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});