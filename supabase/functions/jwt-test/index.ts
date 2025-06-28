// A simple test function to check JWT verification
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// IMPORTANT: Attempt to explicitly disable JWT verification
export const verify_jwt = false;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    
    // Log everything for debugging
    console.log('Request received:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries([...req.headers.entries()]),
      authHeader: authHeader ? `${authHeader.substring(0, 15)}...` : 'none'
    });

    // Return success with auth header info
    return new Response(
      JSON.stringify({
        message: 'JWT test successful',
        auth_header_present: !!authHeader,
        first_10_chars: authHeader ? authHeader.substring(0, 10) : 'none',
        verify_jwt_setting: verify_jwt
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in jwt-test function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
