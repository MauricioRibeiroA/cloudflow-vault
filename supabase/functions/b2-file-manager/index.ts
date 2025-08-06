
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get user profile and company
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id, status, group_name')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.status !== 'active') {
      throw new Error('Invalid user profile');
    }

    // Super admins can operate without company_id
    const isSuperAdmin = profile.group_name === 'super_admin';
    if (!isSuperAdmin && !profile.company_id) {
      throw new Error('Invalid user profile - no company association');
    }

    const { action, ...payload } = await req.json();

    const b2Config = {
      accessKeyId: Deno.env.get('B2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('B2_SECRET_ACCESS_KEY'),
      region: Deno.env.get('B2_REGION'),
      endpoint: Deno.env.get('B2_ENDPOINT'),
      bucket: Deno.env.get('B2_BUCKET_NAME'),
    };

    const { S3Client, DeleteObjectCommand, CopyObjectCommand, GetObjectCommand } = await import("https://esm.sh/@aws-sdk/client-s3@3.445.0");
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

    switch (action) {
      case 'save_metadata':
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

        if (insertError) throw insertError;

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

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'delete':
        const { fileId } = payload;
        
        // Get file info and verify access
        const { data: fileToDelete } = await supabaseClient
          .from('files')
          .select('file_path, name, company_id, uploaded_by')
          .eq('id', fileId)
          .single();

        // Verify access: same company or super admin can delete their own files
        if (fileToDelete?.company_id !== profile.company_id && 
            !(isSuperAdmin && fileToDelete?.uploaded_by === user.id)) {
          throw new Error('File not found or access denied');
        }

        if (!fileToDelete) {
          throw new Error('File not found or access denied');
        }

        // Delete from B2
        const deleteCommand = new DeleteObjectCommand({
          Bucket: b2Config.bucket,
          Key: fileToDelete.file_path,
        });

        await s3Client.send(deleteCommand);

        // Delete from database
        const { error: deleteError } = await supabaseClient
          .from('files')
          .delete()
          .eq('id', fileId);

        if (deleteError) throw deleteError;

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

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'list_folders':
        // List folders for the current parent
        const { parent } = payload;
        
        let folderQuery = supabaseClient
          .from('folders')
          .select('id, name, parent_id')
          .order('name');
        
        if (parent) {
          folderQuery = folderQuery.eq('parent_id', parent);
        } else {
          folderQuery = folderQuery.is('parent_id', null);
        }
        
        // Filter by company or super admin
        if (profile.company_id) {
          folderQuery = folderQuery.eq('company_id', profile.company_id);
        } else if (isSuperAdmin) {
          folderQuery = folderQuery.eq('created_by', user.id).is('company_id', null);
        }
        
        const { data: foldersData } = await folderQuery;
        
        return new Response(JSON.stringify({
          folders: foldersData?.map(f => ({ id: f.id, name: f.name, parent: f.parent_id })) || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'list_files':
        // List files for the current folder
        const { folder } = payload;
        
        let fileQuery = supabaseClient
          .from('files')
          .select('id, name, file_path, file_size, file_type, created_at')
          .order('name');
        
        if (folder) {
          fileQuery = fileQuery.eq('folder_id', folder);
        } else {
          fileQuery = fileQuery.is('folder_id', null);
        }
        
        // Filter by company or super admin
        if (profile.company_id) {
          fileQuery = fileQuery.eq('company_id', profile.company_id);
        } else {
          fileQuery = fileQuery.eq('uploaded_by', user.id).is('company_id', null);
        }
        
        const { data: filesData } = await fileQuery;
        
        return new Response(JSON.stringify({
          files: filesData?.map(f => ({
            name: f.name,
            filePath: f.file_path,
            size: f.file_size,
            type: f.file_type,
            createdAt: f.created_at
          })) || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'create_folder':
        // Create a new folder
        const { parent: parentId, folder_name } = payload;
        
        const { error: folderError } = await supabaseClient
          .from('folders')
          .insert({
            name: folder_name,
            parent_id: parentId,
            created_by: user.id,
            company_id: profile.company_id || null,
          });
        
        if (folderError) throw folderError;
        
        // Log folder creation
        await supabaseClient
          .from('logs')
          .insert({
            user_id: user.id,
            action: 'folder_create',
            target_type: 'folder',
            target_name: folder_name,
            company_id: profile.company_id || null,
          });
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get_download_url':
        // Generate a signed URL for downloading files
        const { file_path } = payload;
        
        // Verify file access
        const { data: fileData } = await supabaseClient
          .from('files')
          .select('company_id, uploaded_by')
          .eq('file_path', file_path)
          .single();
        
        if (!fileData) {
          throw new Error('File not found');
        }
        
        // Check access permissions
        const hasAccess = profile.company_id === fileData.company_id || 
                         (isSuperAdmin && fileData.uploaded_by === user.id);
        
        if (!hasAccess) {
          throw new Error('Access denied');
        }
        
        const getObjectCommand = new GetObjectCommand({
          Bucket: b2Config.bucket,
          Key: file_path,
        });
        
        const downloadUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 }); // 1 hour
        
        // Log the download
        await supabaseClient
          .from('logs')
          .insert({
            user_id: user.id,
            action: 'file_download_b2',
            target_type: 'file',
            target_name: file_path,
            company_id: profile.company_id || null,
            details: {
              storage_backend: 'backblaze_b2'
            }
          });
        
        return new Response(JSON.stringify({ downloadUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'delete_file':
        // Delete a file by file path
        const { file_path: filePathToDelete } = payload;
        
        // Get file info and verify access
        const { data: fileToDeleteByPath } = await supabaseClient
          .from('files')
          .select('id, file_path, name, company_id, uploaded_by')
          .eq('file_path', filePathToDelete)
          .single();
        
        if (!fileToDeleteByPath) {
          throw new Error('File not found');
        }
        
        // Verify access: same company or super admin can delete their own files
        if (fileToDeleteByPath.company_id !== profile.company_id && 
            !(isSuperAdmin && fileToDeleteByPath.uploaded_by === user.id)) {
          throw new Error('File not found or access denied');
        }
        
        // Delete from B2
        const deleteFileCommand = new DeleteObjectCommand({
          Bucket: b2Config.bucket,
          Key: fileToDeleteByPath.file_path,
        });
        
        await s3Client.send(deleteFileCommand);
        
        // Delete from database
        const { error: deleteFileError } = await supabaseClient
          .from('files')
          .delete()
          .eq('id', fileToDeleteByPath.id);
        
        if (deleteFileError) throw deleteFileError;
        
        // Log the deletion
        await supabaseClient
          .from('logs')
          .insert({
            user_id: user.id,
            action: 'file_delete_b2',
            target_type: 'file',
            target_name: fileToDeleteByPath.name,
            company_id: profile.company_id || null,
            details: {
              storage_backend: 'backblaze_b2',
              file_path: fileToDeleteByPath.file_path
            }
          });
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get_usage':
        // Get storage usage
        let storageFiles, storageLimit;
        
        if (profile.company_id) {
          // Company usage
          const { data: companyFiles } = await supabaseClient
            .from('files')
            .select('file_size')
            .eq('company_id', profile.company_id);
          
          storageFiles = companyFiles;

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
          
          storageFiles = personalFiles;
          storageLimit = 100; // 100GB for super admin personal files
        }

        const totalStorageUsage = storageFiles?.reduce((sum, file) => sum + file.file_size, 0) || 0;
        const usageStorageGB = totalStorageUsage / (1024 * 1024 * 1024);
        const usagePercentage = (usageStorageGB / storageLimit) * 100;

        return new Response(JSON.stringify({
          usedGB: usageStorageGB,
          limitGB: storageLimit,
          pct: usagePercentage
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'list_usage':
        // Get storage usage
        let files, usageStorageLimit;
        
        if (profile.company_id) {
          // Company usage
          const { data: companyFiles } = await supabaseClient
            .from('files')
            .select('file_size')
            .eq('company_id', profile.company_id);
          
          files = companyFiles;

          const { data: company } = await supabaseClient
            .from('companies')
            .select('settings')
            .eq('id', profile.company_id)
            .single();

          usageStorageLimit = company?.settings?.storage_limit_gb || 10;
        } else {
          // Super admin personal usage
          const { data: personalFiles } = await supabaseClient
            .from('files')
            .select('file_size')
            .eq('uploaded_by', user.id)
            .is('company_id', null);
          
          files = personalFiles;
          usageStorageLimit = 50; // 50GB for super admin personal files
        }

        const totalUsage = files?.reduce((sum, file) => sum + file.file_size, 0) || 0;
        const usageGB = totalUsage / (1024 * 1024 * 1024);

        return new Response(JSON.stringify({
          totalUsageBytes: totalUsage,
          totalUsageGB: usageGB,
          storageLimitGB: usageStorageLimit,
          usagePercentage: (usageGB / usageStorageLimit) * 100
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in b2-file-manager:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
