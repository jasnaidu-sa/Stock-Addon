import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables should be set in your Supabase project's Function settings
const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
const supabaseAdmin = createClient(
  SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY || '',
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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for required environment variables
    if (!CLERK_SECRET_KEY) {
      console.error('Missing CLERK_SECRET_KEY environment variable');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Clerk API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Use our manual JWT decoder instead of Supabase's verification
    const { payload: jwtPayload, error: jwtError } = decodeJwt(token);
    
    if (jwtError || !jwtPayload) {
      console.error('Error decoding JWT:', jwtError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const callingUserId = jwtPayload.sub;
    console.log('Clerk User ID from JWT:', callingUserId);
    
    // Check if the calling user has 'admin' role in the users table
    const { data: usersData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('clerk_id', callingUserId);

    console.log('User lookup result:', JSON.stringify({ data: usersData, error: userError }));

    if (userError) {
      console.error('Error checking admin role:', userError);
      return new Response(
        JSON.stringify({ error: `Error checking admin role: ${userError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No user found with this clerk_id
    if (!usersData || usersData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if any of the user records has admin role
    const isAdmin = usersData.some(user => user.role === 'admin');
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    let requestPayload;
    try {
      requestPayload = await req.json() as RequestPayload;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { userId, newPassword } = requestPayload;
    
    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or newPassword in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Call Clerk API with improved error handling
    try {
      console.log(`Attempting to reset password for user ${userId}`);
      console.log(`Using Clerk key: ${CLERK_SECRET_KEY ? 'Set (masked for security)' : 'Not set'}`);
      
      // Using the correct Clerk API endpoint for password reset
      const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword
        })
      });
      
      // Get response as text first for safer handling
      const responseText = await clerkResponse.text();
      console.log(`Clerk API response status: ${clerkResponse.status}`);
      console.log(`Clerk API response body preview: ${responseText.substring(0, 100)}...`);
      
      // Try to parse as JSON, but handle parse errors gracefully
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing Clerk response:', parseError);
        return new Response(
          JSON.stringify({ 
            error: 'Error parsing Clerk API response',
            details: `Raw response: ${responseText.substring(0, 200)}...` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!clerkResponse.ok) {
        console.error('Error from Clerk API:', responseData);
        return new Response(
          JSON.stringify({ 
            error: responseData.errors?.[0]?.message || 'Failed to reset password',
            clerkStatus: clerkResponse.status,
            details: responseData
          }),
          { status: clerkResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          message: 'Password reset successfully',
          user: userId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error calling Clerk API:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to call Clerk API', 
          details: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
