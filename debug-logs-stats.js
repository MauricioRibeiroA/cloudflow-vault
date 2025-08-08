import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLogsAndStats() {
  console.log('🔍 Debugging Logs and Statistics...\n');
  
  try {
    // 1. Check if logs table exists and has data
    console.log('1. Checking logs table...');
    const { data: logs, error: logsError } = await supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (logsError) {
      console.error('❌ Logs table error:', logsError);
    } else {
      console.log(`✅ Found ${logs.length} recent logs`);
      logs.forEach((log, i) => {
        console.log(`   ${i+1}. ${log.action} - ${log.target_name} (${new Date(log.created_at).toLocaleString()})`);
      });
    }
    
    console.log('');
    
    // 2. Check files table and company totals
    console.log('2. Checking files table and company statistics...');
    
    // Get all companies first
    console.log('   Listing all companies...');
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    
    console.log(`   Found ${companies?.length || 0} companies:`);
    companies?.forEach((comp, i) => {
      console.log(`     ${i+1}. ${comp.name} (${comp.id})`);
    });
    
    // Find 3dpine or similar
    const targetCompany = companies?.find(c => 
      c.name.toLowerCase().includes('3dpine') || 
      c.name.toLowerCase().includes('pine') ||
      c.name.toLowerCase().includes('test')
    );
    
    if (targetCompany) {
      const company = targetCompany;
      console.log(`🎯 Using target company: ${company.name}`);
    } else if (companies && companies.length > 0) {
      const company = companies[0];
      console.log(`📊 Using first available company: ${company.name}`);
    }
    
    if (companies && companies.length > 0) {
      const company = targetCompany || companies[0];
      console.log(`📊 Found company: ${company.name} (ID: ${company.id})`);
      
      // Get files for this company
      const { data: files } = await supabase
        .from('files')
        .select('id, name, file_size, created_at, uploaded_by')
        .eq('company_id', company.id);
      
      if (files && files.length > 0) {
        const totalSize = files.reduce((sum, file) => sum + (file.file_size || 0), 0);
        console.log(`📁 Files found: ${files.length}`);
        console.log(`💾 Total size: ${formatFileSize(totalSize)}`);
        console.log('   Recent files:');
        files.slice(0, 5).forEach((file, i) => {
          console.log(`     ${i+1}. ${file.name} - ${formatFileSize(file.file_size)} (${new Date(file.created_at).toLocaleString()})`);
        });
        
        // Check company usage stats
        const { data: companyStats } = await supabase
          .from('companies')
          .select('current_storage_used_bytes, current_download_used_bytes')
          .eq('id', company.id)
          .single();
        
        console.log(`\n📈 Company stats in database:`);
        console.log(`   current_storage_used_bytes: ${formatFileSize(companyStats?.current_storage_used_bytes || 0)}`);
        console.log(`   current_download_used_bytes: ${formatFileSize(companyStats?.current_download_used_bytes || 0)}`);
        
        if (totalSize !== (companyStats?.current_storage_used_bytes || 0)) {
          console.log(`⚠️ MISMATCH: Files total (${formatFileSize(totalSize)}) != Company stats (${formatFileSize(companyStats?.current_storage_used_bytes || 0)})`);
        }
        
      } else {
        console.log('❌ No files found for this company');
      }
      
      // Check logs for this company
      const { data: companyLogs } = await supabase
        .from('logs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log(`\n📝 Logs for company: ${companyLogs?.length || 0}`);
      if (companyLogs && companyLogs.length > 0) {
        companyLogs.forEach((log, i) => {
          console.log(`   ${i+1}. ${log.action} - ${log.target_name} by ${log.user_id}`);
        });
      }
      
    } else {
      console.log('❌ No company found matching "3dpine"');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

debugLogsAndStats();
