import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables should be set in your Supabase project's Function settings
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY');

if (!CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY is not set. Password reset will not work.');
}

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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Function environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service_role key
    const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const { userId, newPassword } = await req.json() as RequestPayload;
    if (!userId || !newPassword) {
      return new Response(JSON.stringify({ error: 'Missing userId or newPassword in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Call Clerk API to reset the user's password
    console.log(`Resetting password for Clerk user ID: ${userId} using Clerk API`);
    if (!CLERK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Clerk API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Make a request to Clerk's Admin API to set the password
      const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${userId}/set_password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: newPassword
        })
      });

      // Safely handle the response - it might not always be valid JSON
      let clerkData;
      try {
        const responseText = await clerkResponse.text();
        try {
          clerkData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing Clerk API response:', parseError, 'Response text:', responseText);
          clerkData = { 
            errors: [{ message: `Failed to parse response: ${parseError.message}. Raw response: ${responseText.substring(0, 100)}...` }] 
          };
        }
      } catch (textError) {
        console.error('Error reading Clerk API response text:', textError);
        clerkData = { errors: [{ message: 'Failed to read response from Clerk API' }] };
      }

      if (!clerkResponse.ok) {
        console.error('Error from Clerk API:', clerkData);
        return new Response(JSON.stringify({ 
          error: 'Failed to reset password via Clerk API', 
          details: clerkData.errors?.[0]?.message || clerkResponse.statusText 
        }), {
          status: clerkResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('Password successfully reset via Clerk API');

    } catch (clerkError) {
      console.error('Error calling Clerk API:', clerkError);
      return new Response(JSON.stringify({ error: 'Error communicating with Clerk API', details: clerkError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Password updated successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error in Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
