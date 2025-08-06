import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log('=== DEBUG EDGE FUNCTION ===');
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    console.log('Method:', req.method);
    console.log('URL:', req.url);

    // Check auth header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);

    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'No authorization header',
        debug: 'Auth header missing' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Key present:', !!supabaseKey);

    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseKey ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Try to get user
    console.log('Trying to get user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    console.log('User:', user?.id);
    console.log('User error:', userError);

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        debug: { userError, hasUser: !!user },
        authHeader: authHeader?.substring(0, 20) + '...'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check B2 environment variables
    const b2Config = {
      accessKeyId: Deno.env.get('B2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('B2_SECRET_ACCESS_KEY'),
      region: Deno.env.get('B2_REGION'),
      endpoint: Deno.env.get('B2_ENDPOINT'),
      bucket: Deno.env.get('B2_BUCKET_NAME'),
    };

    console.log('B2 Config:', {
      accessKeyId: b2Config.accessKeyId?.substring(0, 10) + '...',
      hasSecret: !!b2Config.secretAccessKey,
      region: b2Config.region,
      endpoint: b2Config.endpoint,
      bucket: b2Config.bucket
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Debug successful!",
      user: { id: user.id, email: user.email },
      b2Config: {
        hasAccessKey: !!b2Config.accessKeyId,
        hasSecretKey: !!b2Config.secretAccessKey,
        region: b2Config.region,
        endpoint: b2Config.endpoint,
        bucket: b2Config.bucket
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack,
      debug: 'Caught in try-catch'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
