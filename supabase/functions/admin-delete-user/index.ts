import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables - set these in your Supabase Function settings
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY');

interface DeleteUserPayload {
  userId: string;  // Supabase/Clerk user ID
  clerkId?: string; // Separate Clerk ID if different from userId
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // For production, restrict this to your app's domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Function environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role key
    const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Authenticate the calling user
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

    // 2. Verify the calling user has admin role
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

    // 3. Parse and validate the request payload
    const { userId, clerkId } = await req.json() as DeleteUserPayload;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing required field: userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Delete the user from Supabase Auth (if exists)
    // Try to delete from Supabase Auth, but don't fail if user doesn't exist
    try {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        // Log the error but continue with deletion from the users table
        console.warn('Note: Could not delete from Supabase Auth:', deleteAuthError.message);
      } else {
        console.log('Successfully deleted user from Supabase Auth');
      }
    } catch (authError) {
      // Just log the error and continue
      console.warn('Note: Could not delete from Supabase Auth:', authError);
    }
    
    // 5. Delete the user from Clerk if a clerkId was provided
    if (clerkId && CLERK_SECRET_KEY) {
      try {
        console.log(`Attempting to delete user from Clerk with ID: ${clerkId}`);
        const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!clerkResponse.ok) {
          const errorData = await clerkResponse.text();
          console.error(`Error deleting user from Clerk: ${errorData}`);
        } else {
          console.log('Successfully deleted user from Clerk');
        }
      } catch (clerkError) {
        console.error('Error deleting user from Clerk:', clerkError);
        // Don't fail the request if Clerk deletion fails
      }
    } else if (!clerkId) {
      console.warn('No Clerk ID provided, skipping Clerk user deletion');
    } else if (!CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY not set, cannot delete user from Clerk');
    }

    // 6. Delete the user from Supabase public.users table (if not cascading)
    // Note: If you have cascade deletes set up, this step may be redundant
    const { error: deleteProfileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      console.warn('Warning: Could not delete user profile:', deleteProfileError);
      // We don't fail the request if this step fails, as the auth user is already deleted
    }

    // 7. Return success response
    return new Response(JSON.stringify({
      message: 'User deleted successfully',
      userId: userId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error in Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
