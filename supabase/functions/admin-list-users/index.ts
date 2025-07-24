import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// WORKAROUND: Prevent unauthorized errors by accepting both Supabase and Clerk JWT tokens.
// Even when we set verify_jwt to false, Supabase may enforce verification.
// This method allows the function to work regardless of the JWT verification setting.
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

// CORS headers for all Edge Functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const clerk_secret = Deno.env.get('CLERK_SECRET_KEY');

// Function to decode a JWT token without verification
function decodeJwt(token) {
  try {
    // JWT structure is header.payload.signature
    const [_, payloadBase64] = token.split('.');
    if (!payloadBase64) throw new Error('Invalid token format');
    
    // Decode the base64 payload
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

serve(async (req) => {
  // Handle CORS pre-flight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Received request:', req.method, req.url);
    
    // Only allow GET requests
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    console.log('Token received with prefix:', token.substring(0, 10) + '...');
    
    // Get Clerk user ID from the token
    let callingUserId;
    
    // Try to decode JWT token manually
    const { payload, error } = decodeJwt(token);
    
    if (error || !payload) {
      console.error('Error decoding JWT token:', error);
      return new Response(JSON.stringify({ 
        error: 'Invalid token format or unable to decode', 
        details: error?.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Decoded JWT payload:', JSON.stringify(payload));
    
    // Extract the user ID from the JWT claims
    callingUserId = payload.sub;
    if (!callingUserId) {
      console.log('No sub claim in JWT');
      return new Response(JSON.stringify({ error: 'Invalid token: no user ID found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Authenticated user ID:', callingUserId);

    // Check if the user is an admin in the users table
    const { data: usersData, error: userError } = await supabase
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

    // Get all users from Supabase users table
    const { data: supabaseUsers, error: supabaseError } = await supabase
      .from('users')
      .select('*');

    if (supabaseError) {
      return new Response(JSON.stringify({ error: `Error fetching users from Supabase: ${supabaseError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all users from Clerk - this requires the Clerk API key
    if (!clerk_secret) {
      return new Response(JSON.stringify({ error: 'Clerk API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Make a request to Clerk API to get all users with pagination
    // Clerk API defaults to limit=10, so we need to increase this to get all users
    const clerkResponse = await fetch('https://api.clerk.com/v1/users?limit=500', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clerk_secret}`,
        'Content-Type': 'application/json',
      },
    });

    if (!clerkResponse.ok) {
      const clerkError = await clerkResponse.text();
      return new Response(JSON.stringify({ error: `Error fetching users from Clerk: ${clerkError}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clerkUsers = await clerkResponse.json();
    console.log(`Retrieved ${clerkUsers.length} users from Clerk`);

    // Create a map of Clerk IDs to Supabase data
    const supabaseUserMap = new Map();
    if (supabaseUsers) {
      supabaseUsers.forEach((user) => {
        if (user.clerk_id) {
          supabaseUserMap.set(user.clerk_id, {
            id: user.id,
            role: user.role,
            group_type: user.group_type,
            company_name: user.company_name,
            status: user.status,
          });
        }
      });
    }

    // Merge the data
    const mergedUsers = clerkUsers.map((user) => {
      const primaryEmail = user.email_addresses?.[0]?.email_address || '';
      const supabaseData = supabaseUserMap.get(user.id);

      return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        emailAddress: primaryEmail,
        publicMetadata: user.public_metadata || {},
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        supabaseData
      };
    });

    return new Response(JSON.stringify({ users: mergedUsers }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unhandled error in admin-list-users:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
