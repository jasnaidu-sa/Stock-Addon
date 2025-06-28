import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables should be set in your Supabase project's Function settings
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY');

// Helper function to decode JWT without verification
function decodeJwt(token: string) {
  try {
    const [_, payloadBase64] = token.split('.');
    if (!payloadBase64) throw new Error('Invalid token format');
    
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
      )
    );
    return { payload, error: null };
  } catch (error) {
    return { payload: null, error };
  }
}

// Create a Supabase client with the service role key for admin access
export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface RequestPayload {
  userId: string; // Clerk user ID
  newPassword: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // IMPORTANT: For production, restrict this to your app's domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check all required environment variables
    if (!CLERK_SECRET_KEY) {
      console.error('Function environment variable CLERK_SECRET_KEY is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Clerk credentials.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Function environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Log environment variable status for debugging
    console.log('Environment variables check:', {
      hasClerkKey: !!CLERK_SECRET_KEY,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasSupabaseKey: !!SUPABASE_SERVICE_ROLE_KEY
    });

    // 1. Authenticate the calling user (extract JWT and decode)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.split(' ')[1];
    
    // Decode the JWT token to get the Clerk user ID
    console.log('Decoding JWT token...');
    const { payload, error: jwtError } = decodeJwt(token);
    
    if (jwtError || !payload) {
      console.error('Error decoding JWT:', jwtError);
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const callingUserId = payload.sub;
    console.log('Clerk User ID from JWT:', callingUserId);

    // 2. Verify if the calling user has 'admin' role in the users table
    const { data: usersData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('clerk_id', callingUserId);

    console.log('User lookup result:', JSON.stringify({ data: usersData, error: userError }));

    if (userError) {
      console.error('Error checking admin role:', userError);
      return new Response(JSON.stringify({ error: `Error checking admin role: ${userError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // No user found with this clerk_id
    if (!usersData || usersData.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found in database' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Check if any of the user records has admin role
    const isAdmin = usersData.some(user => user.role === 'admin');
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Process the request payload
    let userId, newPassword;
    try {
      const payload = await req.json() as RequestPayload;
      userId = payload.userId;
      newPassword = payload.newPassword;
    } catch (parseError) {
      console.error('Error parsing request payload:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!userId || !newPassword) {
      return new Response(JSON.stringify({ error: 'Missing userId or newPassword in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Reset password directly using Clerk API
    console.log(`Attempting to reset password for Clerk user ID: ${userId}`);
    
    const clerkApiUrl = `https://api.clerk.com/v1/users/${userId}/set_password`;
    
    const response = await fetch(clerkApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: newPassword
      })
    });
    
    // Safely parse the Clerk API response
    let clerkResponseData;
    try {
      const responseText = await response.text();
      console.log('Raw response from Clerk API:', responseText.substring(0, 100) + '...');
      clerkResponseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing Clerk API response:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Failed to parse Clerk API response', 
        details: parseError.message,
        tip: 'This likely means your CLERK_SECRET_KEY is invalid or not set correctly'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!response.ok) {
      console.error('Error from Clerk API:', clerkResponseData);
      return new Response(JSON.stringify({ 
        error: clerkResponseData.errors?.[0]?.message || 'Failed to reset password',
        details: clerkResponseData
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      message: 'Password reset successfully',
      user: clerkResponseData
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error in Edge Function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred.',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
