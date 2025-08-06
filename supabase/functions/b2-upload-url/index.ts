
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, status, group_name')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.status !== 'active') throw new Error('Invalid profile');
    const isSuperAdmin = profile.group_name === 'super_admin';
    
    // Super admins can operate without company_id
    if (!isSuperAdmin && !profile.company_id) {
      throw new Error('Invalid user profile - no company association');
    }

    const { fileName, fileSize, fileType, folderId } = await req.json();
    if (!fileName || !fileSize || !fileType) throw new Error('Missing file info');

    const fileSizeGB = fileSize / (1024 * 1024 * 1024);
    let storageLimit = 100; // Default for super admin

    if (profile.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', profile.company_id)
        .single();

      storageLimit = company?.settings?.storage_limit_gb || 10;

      const { data: files } = await supabase
        .from('files')
        .select('file_size')
        .eq('company_id', profile.company_id);

      const used = files?.reduce((s, f) => s + f.file_size, 0) || 0;
      if ((used / (1024 * 1024 * 1024)) + fileSizeGB > storageLimit) {
        throw new Error('Storage limit exceeded');
      }
    }

    // S3 config
    const accessKeyId = Deno.env.get("B2_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("B2_SECRET_ACCESS_KEY")!;
    const region = Deno.env.get("B2_REGION")!;
    const bucket = Deno.env.get("B2_BUCKET_NAME")!;
    const endpoint = Deno.env.get("B2_ENDPOINT")!;

    const now = new Date();
    const isoDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = isoDate.substring(0, 8);
    const timestamp = now.getTime();
    const basePath = profile.company_id || `user_${user.id}`;
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `cloud-vault/${basePath}/${folderId || 'root'}/${timestamp}-${sanitizedFileName}`;

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const host = endpoint.replace(/^https?:\/\//, '');
    const expires = 3600;

    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
      'X-Amz-Date': isoDate,
      'X-Amz-Expires': expires.toString(),
      'X-Amz-SignedHeaders': 'host',
    });

    const canonicalRequest = [
      "PUT",
      `/${key}`,
      queryParams.toString(),
      `host:${host}`,
      "",
      "host",
      "UNSIGNED-PAYLOAD"
    ].join("\n");

    const hashedCanonicalRequest = await sha256(canonicalRequest);
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      isoDate,
      credentialScope,
      hashedCanonicalRequest
    ].join("\n");

    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, "s3");
    const signature = await hmacHex(signingKey, stringToSign);

    queryParams.set("X-Amz-Signature", signature);

    const signedUrl = `${endpoint}/${bucket}/${key}?${queryParams.toString()}`;

    return new Response(JSON.stringify({
      signedUrl,
      filePath: key,
      fileKey: key
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sha256(message: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: CryptoKey, data: string) {
  const encoder = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
}

async function hmacHex(key: CryptoKey, data: string) {
  return Array.from(await hmac(key, data)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  const kDate = await importKey("AWS4" + key);
  const kRegion = await hmac(kDate, dateStamp);
  const kService = await hmac(await importKey(kRegion), region);
  const kSigning = await hmac(await importKey(kService), service);
  return await importKey(kSigning);
}

async function importKey(key: string | Uint8Array) {
  const raw = typeof key === "string"
    ? new TextEncoder().encode(key)
    : key;
  return await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
