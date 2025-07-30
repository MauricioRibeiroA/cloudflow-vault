
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
      .select('company_id, status')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.status !== 'active' || !profile.company_id) {
      throw new Error('Invalid user profile');
    }

    const { action, ...payload } = await req.json();

    const b2Config = {
      accessKeyId: Deno.env.get('B2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('B2_SECRET_ACCESS_KEY'),
      region: Deno.env.get('B2_REGION'),
      endpoint: Deno.env.get('B2_ENDPOINT'),
      bucket: Deno.env.get('B2_BUCKET_NAME'),
    };

    const { S3Client, DeleteObjectCommand, CopyObjectCommand } = await import("https://esm.sh/@aws-sdk/client-s3@3.445.0");

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
            company_id: profile.company_id,
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
            company_id: profile.company_id,
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
          .select('file_path, name, company_id')
          .eq('id', fileId)
          .eq('company_id', profile.company_id)
          .single();

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
          .eq('id', fileId)
          .eq('company_id', profile.company_id);

        if (deleteError) throw deleteError;

        // Log the deletion
        await supabaseClient
          .from('logs')
          .insert({
            user_id: user.id,
            action: 'file_delete_b2',
            target_type: 'file',
            target_name: fileToDelete.name,
            company_id: profile.company_id,
            details: {
              storage_backend: 'backblaze_b2',
              file_path: fileToDelete.file_path
            }
          });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'list_usage':
        // Get storage usage for company
        const { data: files } = await supabaseClient
          .from('files')
          .select('file_size')
          .eq('company_id', profile.company_id);

        const totalUsage = files?.reduce((sum, file) => sum + file.file_size, 0) || 0;
        const usageGB = totalUsage / (1024 * 1024 * 1024);

        const { data: company } = await supabaseClient
          .from('companies')
          .select('settings')
          .eq('id', profile.company_id)
          .single();

        const storageLimit = company?.settings?.storage_limit_gb || 10;

        return new Response(JSON.stringify({
          totalUsageBytes: totalUsage,
          totalUsageGB: usageGB,
          storageLimitGB: storageLimit,
          usagePercentage: (usageGB / storageLimit) * 100
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
