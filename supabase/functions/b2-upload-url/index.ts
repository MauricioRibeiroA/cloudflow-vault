
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

    // Super admins can upload without company_id
    const isSuperAdmin = profile.group_name === 'super_admin';
    if (!isSuperAdmin && !profile.company_id) {
      throw new Error('Invalid user profile - no company association');
    }

    const { fileName, fileSize, fileType, folderId } = await req.json();

    if (!fileName || !fileSize || !fileType) {
      throw new Error('Missing required fields');
    }

    // Get storage settings and check limits
    let storageLimit = 50; // Default 50GB for super admins
    const fileSizeGB = fileSize / (1024 * 1024 * 1024);
    
    if (profile.company_id) {
      // For users with company
      const { data: company } = await supabaseClient
        .from('companies')
        .select('settings')
        .eq('id', profile.company_id)
        .single();

      storageLimit = company?.settings?.storage_limit_gb || 10;

      // Check current usage for company
      const { data: files } = await supabaseClient
        .from('files')
        .select('file_size')
        .eq('company_id', profile.company_id);

      const currentUsage = files?.reduce((sum, file) => sum + file.file_size, 0) || 0;
      const currentUsageGB = currentUsage / (1024 * 1024 * 1024);

      if (currentUsageGB + fileSizeGB > storageLimit) {
        throw new Error(`Storage limit exceeded. Current: ${currentUsageGB.toFixed(2)}GB, Limit: ${storageLimit}GB`);
      }
    } else if (isSuperAdmin) {
      // Check current usage for super admin (personal files)
      const { data: files } = await supabaseClient
        .from('files')
        .select('file_size')
        .eq('uploaded_by', user.id)
        .is('company_id', null);

      const currentUsage = files?.reduce((sum, file) => sum + file.file_size, 0) || 0;
      const currentUsageGB = currentUsage / (1024 * 1024 * 1024);

      if (currentUsageGB + fileSizeGB > storageLimit) {
        throw new Error(`Storage limit exceeded. Current: ${currentUsageGB.toFixed(2)}GB, Limit: ${storageLimit}GB`);
      }
    }

    // Generate signed URL for B2
    const timestamp = Date.now();
    const basePath = profile.company_id || `user_${user.id}`;
    const filePath = `${basePath}/${folderId || 'root'}/${timestamp}-${fileName}`;

    const b2Config = {
      accessKeyId: Deno.env.get('B2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('B2_SECRET_ACCESS_KEY'),
      region: Deno.env.get('B2_REGION'),
      endpoint: Deno.env.get('B2_ENDPOINT'),
      bucket: Deno.env.get('B2_BUCKET_NAME'),
    };

    // Create AWS SDK-compatible signed URL
    const { S3Client, PutObjectCommand } = await import("https://cdn.jsdelivr.net/npm/@aws-sdk/client-s3@3.445.0/+esm");
    const { getSignedUrl } = await import("https://cdn.jsdelivr.net/npm/@aws-sdk/s3-request-presigner@3.445.0/+esm");


    const s3Client = new S3Client({
      region: b2Config.region,
      endpoint: b2Config.endpoint,
      credentials: {
        accessKeyId: b2Config.accessKeyId!,
        secretAccessKey: b2Config.secretAccessKey!,
      },
      forcePathStyle: true,
    });

    const command = new PutObjectCommand({
      Bucket: b2Config.bucket,
      Key: filePath,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    console.log('Generated signed URL for upload:', { filePath, fileSize, fileType });

    return new Response(JSON.stringify({
      signedUrl,
      filePath,
      fileKey: filePath
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in b2-upload-url:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
