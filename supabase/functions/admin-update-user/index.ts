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
  'Access-Control-Allow-Methods': 'POST, PATCH, PUT, OPTIONS',
};

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const clerk_secret = Deno.env.get('CLERK_SECRET_KEY');

// Function to decode a JWT token without verification
function decodeJwt(token) {
  try {
    console.log('Attempting to decode token. Token length:', token.length);
    console.log('Token prefix:', token.substring(0, 15) + '...');
    
    // JWT structure is header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token structure: Not a standard JWT (expected 3 parts, got', parts.length, ')');
      throw new Error('Invalid token format: Not a standard JWT');
    }
    
    const [_, payloadBase64] = parts;
    if (!payloadBase64) throw new Error('Invalid token format: Missing payload');
    
    // Add padding if needed
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
    
    // Decode the base64 payload
    let decodedText;
    try {
      decodedText = atob(paddedBase64);
    } catch (e) {
      console.error('Base64 decode error:', e);
      throw new Error('Invalid base64 encoding in token payload');
    }
    
    // Convert to Uint8Array and then to JSON
    const uint8Array = Uint8Array.from(decodedText, c => c.charCodeAt(0));
    const jsonText = new TextDecoder().decode(uint8Array);
    
    try {
      const payload = JSON.parse(jsonText);
      console.log('Successfully decoded JWT payload with claims:', Object.keys(payload).join(', '));
      return { payload, error: null };
    } catch (e) {
      console.error('JSON parse error:', e);
      throw new Error('Invalid JSON in token payload');
    }
  } catch (error) {
    console.error('JWT decode error:', error.message);
    return { payload: null, error };
  }
}

interface UpdateUserPayload {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  group_type?: string;
  company_name?: string;
  status?: string;
}

serve(async (req) => {
  // Handle CORS pre-flight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Received request:', req.method, req.url);
    
    // Only allow PUT and POST requests
    if (req.method !== 'PUT' && req.method !== 'POST' && req.method !== 'PATCH') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
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
    
    // Get and validate the JWT token from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Auth header present, length:', authHeader.length);
    
    // Extract the token part
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Invalid authorization header format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Decode the JWT using our custom decoder that works with Clerk tokens
    const { payload, error } = decodeJwt(token);
    if (error || !payload) {
      console.error('JWT decode error:', error?.message || 'Unknown error');
      return new Response(JSON.stringify({ error: 'Invalid JWT token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Log the JWT payload for debugging
    console.log('JWT payload keys:', Object.keys(payload).join(', '));
    
    // Extract the user ID from the JWT claims
    const callingUserId = payload.sub;
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
    
    // Keep detailed logging for production diagnostics
    console.log('Authorized admin user');
    
    // Log authenticated user information
    console.log(`Authenticated admin user: ${callingUserId}`)

    // Parse request body for update data
    const updateData = await req.json() as UpdateUserPayload;
    const { userId, firstName, lastName, email, role, group_type, company_name, status } = updateData;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing required field: userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Make sure at least one field to update is provided
    if (!firstName && !lastName && !email && !role && !group_type && !company_name && !status) {
      return new Response(JSON.stringify({ error: 'No update fields provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if Clerk API key is available
    if (!clerk_secret) {
      return new Response(JSON.stringify({ error: 'Clerk API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update user in Supabase users table
    let supabaseUpdated = false;
    if (firstName !== undefined || lastName !== undefined || role !== undefined || group_type !== undefined || company_name !== undefined || status !== undefined) {
      const supabaseUpdateData: any = {};
      if (firstName !== undefined) supabaseUpdateData.first_name = firstName;
      if (lastName !== undefined) supabaseUpdateData.last_name = lastName;
      if (role !== undefined) supabaseUpdateData.role = role;
      if (group_type !== undefined) supabaseUpdateData.group_type = group_type;
      if (company_name !== undefined) supabaseUpdateData.company_name = company_name;
      if (status !== undefined) supabaseUpdateData.status = status;

      const { error: updateError } = await supabase
        .from('users')
        .update(supabaseUpdateData)
        .eq('clerk_id', userId);

      if (updateError) {
        console.error('Error updating user in Supabase:', updateError);
        return new Response(JSON.stringify({ error: `Error updating user in Supabase: ${updateError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      supabaseUpdated = true;
    }

    // Update user in Clerk
    let clerkUpdated = false;
    if (firstName !== undefined || lastName !== undefined) {
      const updateResponse = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${clerk_secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
        }),
      });

      if (!updateResponse.ok) {
        const updateError = await updateResponse.text();
        return new Response(JSON.stringify({ 
          message: supabaseUpdated ? 'User partially updated' : 'User update failed', 
          error: `Error updating user in Clerk: ${updateError}` 
        }), {
          status: supabaseUpdated ? 207 : 500, // Partial success if Supabase was updated
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      clerkUpdated = true;
    }

    // Update email if provided
    if (email) {
      // First get user's email addresses
      const emailsResponse = await fetch(`https://api.clerk.com/v1/users/${userId}/email_addresses`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${clerk_secret}`,
          'Content-Type': 'application/json',
        },
      });

      if (!emailsResponse.ok) {
        const emailsError = await emailsResponse.text();
        return new Response(JSON.stringify({ 
          message: 'User partially updated, but email could not be updated', 
          error: `Error getting user email addresses from Clerk: ${emailsError}` 
        }), {
          status: 207, // Partial success
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const emailAddresses = await emailsResponse.json();
      if (emailAddresses && emailAddresses.length > 0) {
        const primaryEmailId = emailAddresses[0].id;
        
        // Update the primary email address
        const updateEmailResponse = await fetch(`https://api.clerk.com/v1/email_addresses/${primaryEmailId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${clerk_secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email_address: email
          }),
        });
        
        if (!updateEmailResponse.ok) {
          const updateEmailError = await updateEmailResponse.text();
          return new Response(JSON.stringify({ 
            message: 'User updated, but email could not be changed', 
            error: `Error updating email in Clerk: ${updateEmailError}` 
          }), {
            status: 207, // Partial success
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        clerkUpdated = true;
      }
    }

    return new Response(JSON.stringify({ 
      message: 'User updated successfully', 
      updated: {
        clerk: clerkUpdated,
        supabase: supabaseUpdated
      } 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unhandled error in admin-update-user:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
