#!/usr/bin/env node

/**
 * Test script to verify admin creation functionality
 * This script simulates the process of creating a company admin
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('URL:', supabaseUrl ? '✅' : '❌');
  console.error('ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminCreation() {
  console.log('🧪 Testing admin creation process...\n');

  const testEmail = `test-admin-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testFullName = 'Test Admin User';
  
  try {
    // Step 1: Create a test company first
    console.log('1️⃣ Creating test company...');
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: 'Test Company for Admin Creation',
        domain: 'testcompany.com',
        settings: { storage_limit_gb: 10 },
        status: 'active'
      })
      .select()
      .single();

    if (companyError) {
      console.error('❌ Company creation failed:', companyError);
      return;
    }

    console.log('✅ Test company created:', companyData.name);

    // Step 2: Simulate user signup
    console.log('\n2️⃣ Creating user via Auth...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (authError) {
      console.error('❌ Auth signup failed:', authError);
      return;
    }

    console.log('✅ User created in auth:', authData.user?.email);

    // Step 3: Wait for trigger to create profile
    console.log('\n3️⃣ Waiting for profile trigger...');
    let profileExists = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!profileExists && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, group_name')
        .eq('user_id', authData.user.id)
        .single();

      if (profile) {
        console.log(`✅ Profile created by trigger (attempt ${attempts}):`, {
          id: profile.id,
          group_name: profile.group_name
        });
        profileExists = true;
      } else {
        console.log(`⏳ Profile not found yet (attempt ${attempts}/${maxAttempts})`);
      }
    }

    if (!profileExists) {
      console.error('❌ Profile was not created by trigger');
      return;
    }

    // Step 4: Update profile to company_admin
    console.log('\n4️⃣ Updating profile to company_admin...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: testFullName,
        company_id: companyData.id,
        group_name: 'company_admin',
        status: 'active'
      })
      .eq('user_id', authData.user.id);

    if (updateError) {
      console.error('❌ Profile update failed:', updateError);
      return;
    }

    // Step 5: Verify final profile
    const { data: finalProfile, error: verifyError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    if (verifyError) {
      console.error('❌ Profile verification failed:', verifyError);
      return;
    }

    console.log('✅ Profile updated successfully:', {
      full_name: finalProfile.full_name,
      group_name: finalProfile.group_name,
      company_id: finalProfile.company_id,
      status: finalProfile.status
    });

    console.log('\n🎉 Admin creation process completed successfully!');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    // Delete user (this will cascade delete the profile)
    await supabase.auth.admin.deleteUser(authData.user.id);
    
    // Delete test company
    await supabase.from('companies').delete().eq('id', companyData.id);
    
    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testAdminCreation().catch(console.error);
