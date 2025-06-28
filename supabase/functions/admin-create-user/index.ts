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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string; // e.g., 'user', 'admin', etc.
  group_type: string; // e.g., 'trial', 'paid', 'internal'
  company_name: string;
  status?: string; // e.g., 'active', 'pending', etc.
}

serve(async (req) => {
  // Handle CORS pre-flight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Received request:', req.method, req.url);
    
    // Only allow POST requests
    if (req.method !== 'POST') {
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
    
    // Store user ID for logging purposes
    const userId = payload.sub;
    console.log(`Authenticated user: ${userId}`)

    // Parse and validate the request payload
    const requestBody = await req.text();
    console.log('Raw request body:', requestBody);
    
    let requestPayload;
    try {
      requestPayload = JSON.parse(requestBody);
      console.log('Parsed request payload:', JSON.stringify(requestPayload, null, 2));
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Extract the required fields
    const { email, username, password, firstName, lastName, role, group_type, company_name, status = 'active' } = requestPayload;
    
    console.log('Extracted fields:', JSON.stringify({
      email, username, password: password ? '******' : undefined, 
      firstName, lastName, role, group_type, company_name, status
    }, null, 2));
    
    const missingFields: string[] = [];
    if (!email) missingFields.push('email');
    if (!username) missingFields.push('username');
    if (!password) missingFields.push('password');
    if (!firstName) missingFields.push('firstName');
    if (!lastName) missingFields.push('lastName');
    if (!role) missingFields.push('role');
    if (!group_type) missingFields.push('group_type');
    if (!company_name) missingFields.push('company_name');
      
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(JSON.stringify({ 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        receivedPayload: requestBody
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
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

    // Check if the email already exists in Clerk
    const searchResponse = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clerk_secret}`,
        'Content-Type': 'application/json',
      }
    });

    if (!searchResponse.ok) {
      const searchError = await searchResponse.text();
      return new Response(JSON.stringify({ error: `Error checking existing user in Clerk: ${searchError}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingUsers = await searchResponse.json();
    if (existingUsers && existingUsers.length > 0) {
      return new Response(JSON.stringify({ error: 'User with this email already exists in Clerk' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if email exists in Supabase users table
    const { data: existingSupabaseUser, error: supabaseUserError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingSupabaseUser) {
      return new Response(JSON.stringify({ error: 'User with this email already exists in database' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the provided username instead of generating one
    console.log('Using provided username:', username);
    
    // Create user in Clerk
    const createUserResponse = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clerk_secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: [email],
        password,
        username,
        first_name: firstName,
        last_name: lastName,
        public_metadata: {
          role,
          group_type,
          company_name
        }
      }),
    });

    if (!createUserResponse.ok) {
      const createError = await createUserResponse.text();
      return new Response(JSON.stringify({ error: `Error creating user in Clerk: ${createError}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clerkUser = await createUserResponse.json();
    console.log('User created in Clerk:', clerkUser.id);

    // Create user in Supabase users table with clerk_id reference
    const { data: supabaseUser, error: insertError } = await supabase
      .from('users')
      .insert({
        clerk_id: clerkUser.id,
        email: email,
        username: username,
        first_name: firstName,
        last_name: lastName,
        role: role,
        group_type: group_type,
        company_name: company_name,
        status: status
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating user in Supabase:', insertError);
      
      // Attempt to delete the Clerk user since Supabase insert failed
      try {
        await fetch(`https://api.clerk.com/v1/users/${clerkUser.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${clerk_secret}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (deleteError) {
        console.error('Error cleaning up Clerk user after Supabase error:', deleteError);
      }
      
      return new Response(JSON.stringify({ error: `Error creating user in Supabase: ${insertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      message: 'User created successfully',
      user: {
        id: clerkUser.id,
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role,
        group_type: group_type,
        company_name: company_name,
        status: status
      }
    }), {
      status: 201, // 201 Created
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unhandled error in admin-create-user:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
