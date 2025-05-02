import { supabase } from './supabase';

// This function can be called from the browser console to test the Supabase connection
export async function testSupabaseConnection(password?: string) {
  console.log('=== Testing Supabase Connection ===');
  
  try {
    // Test 1: Auth Service
    console.log('1. Testing auth service...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log('Auth Service Test:', {
      success: !authError,
      error: authError?.message,
      hasSession: !!authData?.session,
      sessionData: authData?.session ? {
        user: authData.session.user?.email,
        expiresAt: authData.session.expires_at
      } : null
    });

    if (!password) {
      console.log('Skipping sign in test - no password provided');
      return {
        success: !authError,
        authData,
        message: 'Password required for sign in test'
      };
    }

    // Test 2: Sign In Test
    console.log('2. Testing sign in...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jnaidu@thebedshop.co.za',
      password: password
    });

    console.log('Sign In Test:', {
      success: !signInError && !!signInData?.user,
      error: signInError?.message,
      errorDetails: signInError ? {
        name: signInError.name,
        message: signInError.message,
        status: signInError.status
      } : null,
      user: signInData?.user?.email,
      session: signInData?.session ? {
        expiresAt: signInData.session.expires_at,
        provider: signInData.session.user?.app_metadata?.provider
      } : null
    });

    return {
      success: !authError && !signInError,
      authData,
      signInData,
      error: signInError?.message
    };
  } catch (error) {
    console.error('Connection Test Failed:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Expose the function to the window object so it can be called from the browser console
if (typeof window !== 'undefined') {
  (window as any).testSupabaseConnection = testSupabaseConnection;
} 