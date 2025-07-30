
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

    const { fileId } = await req.json();

    if (!fileId) {
      throw new Error('File ID is required');
    }

    // Get file metadata and verify access
    const { data: file } = await supabaseClient
      .from('files')
      .select('file_path, name, company_id')
      .eq('id', fileId)
      .eq('company_id', profile.company_id)
      .single();

    if (!file) {
      throw new Error('File not found or access denied');
    }

    // Generate signed URL for B2 download
    const b2Config = {
      accessKeyId: Deno.env.get('B2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('B2_SECRET_ACCESS_KEY'),
      region: Deno.env.get('B2_REGION'),
      endpoint: Deno.env.get('B2_ENDPOINT'),
      bucket: Deno.env.get('B2_BUCKET_NAME'),
    };

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

    const command = new GetObjectCommand({
      Bucket: b2Config.bucket,
      Key: file.file_path,
      ResponseContentDisposition: `attachment; filename="${file.name}"`,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    console.log('Generated signed URL for download:', { fileId, filePath: file.file_path });

    return new Response(JSON.stringify({
      signedUrl,
      fileName: file.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in b2-download-url:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
