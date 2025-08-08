// Debug script to test upload functions
// Execute this in browser console after login

console.log('🔍 Testing upload functions...');

// Test 1: Check if user is logged in
supabase.auth.getUser().then(({ data: { user }, error }) => {
  if (error) {
    console.error('❌ Auth error:', error);
    return;
  }
  
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }
  
  console.log('✅ User logged in:', user.id);
  
  // Test 2: Try to get company_id
  supabase
    .rpc('get_user_company_id', { user_id: user.id })
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Error getting company_id:', error);
      } else {
        console.log('✅ Company ID:', data);
        
        if (!data) {
          console.warn('⚠️ Company ID is NULL - user profile needs to be updated');
        }
      }
    });
  
  // Test 3: Check profile
  supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Error getting profile:', error);
      } else {
        console.log('✅ User profile:', data);
        
        if (!data.company_id) {
          console.warn('⚠️ Profile company_id is NULL');
        }
      }
    });
    
  // Test 4: Check recent files
  supabase
    .from('files')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Error getting files:', error);
      } else {
        console.log('✅ Recent files:', data);
      }
    });
});

console.log('🔍 Debug script completed. Check results above.');
