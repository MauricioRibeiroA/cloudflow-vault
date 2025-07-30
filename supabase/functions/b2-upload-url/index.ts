
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

    const { fileName, fileSize, fileType, folderId } = await req.json();

    if (!fileName || !fileSize || !fileType) {
      throw new Error('Missing required fields');
    }

    // Check storage limits (implement based on company settings)
    const { data: company } = await supabaseClient
      .from('companies')
      .select('settings')
      .eq('id', profile.company_id)
      .single();

    const storageLimit = company?.settings?.storage_limit_gb || 10; // Default 10GB
    
    // Calculate current usage
    const { data: files } = await supabaseClient
      .from('files')
      .select('file_size')
      .eq('company_id', profile.company_id);

    const currentUsage = files?.reduce((sum, file) => sum + file.file_size, 0) || 0;
    const currentUsageGB = currentUsage / (1024 * 1024 * 1024);

    if (currentUsageGB + (fileSize / (1024 * 1024 * 1024)) > storageLimit) {
      throw new Error('Storage limit exceeded');
    }

    // Generate signed URL for B2
    const timestamp = Date.now();
    const filePath = `${profile.company_id}/${folderId || 'root'}/${timestamp}-${fileName}`;

    const b2Config = {
      accessKeyId: Deno.env.get('B2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('B2_SECRET_ACCESS_KEY'),
      region: Deno.env.get('B2_REGION'),
      endpoint: Deno.env.get('B2_ENDPOINT'),
      bucket: Deno.env.get('B2_BUCKET_NAME'),
    };

    // Create AWS SDK-compatible signed URL
    const { S3Client, PutObjectCommand } = await import("https://esm.sh/@aws-sdk/client-s3@3.445.0");
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
