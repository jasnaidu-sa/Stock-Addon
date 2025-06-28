/**
 * Admin utilities for user management with Clerk and Supabase
 * These functions handle the admin operations by calling Supabase Edge Functions
 * that securely interact with both Clerk and Supabase backends
 */
// We use Edge Functions for admin operations
// No direct Supabase client imports needed

// Helper function to get the token from Clerk session
const getAuthToken = async (): Promise<string> => {
  try {
    // Use the default JWT template instead of Supabase template
    // This will provide a standard JWT that our Edge Function can validate
    const token = await window.Clerk?.session?.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    console.log('Successfully obtained auth token');
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw error;
  }
};

// Helper function to call a Supabase Edge Function with proper authentication
const callEdgeFunction = async (functionName: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' = 'POST', body?: any): Promise<any> => {
  try {
    const token = await getAuthToken();
    console.log(`Calling Edge Function ${functionName} with method ${method}`);
    
    // Log a truncated version of the token for debugging (first 10 chars only for security)
    console.log(`Using token starting with: ${token.substring(0, 10)}...`);
    
    const requestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
    console.log(`Request URL: ${requestUrl}`);
    
    // Log the request body for debugging
    if (body) {
      console.log(`Request body for ${functionName}:`, JSON.stringify(body, null, 2));
    }
    
    const requestBody = body ? JSON.stringify(body) : undefined;
    const response = await fetch(requestUrl, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: requestBody
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    // Clone the response to read it twice (once for logging, once for returning)
    const responseClone = response.clone();
    const rawText = await responseClone.text();
    
    console.log(`Raw response: ${rawText.substring(0, 200)}${rawText.length > 200 ? '...' : ''}`);
    
    let data;
    try {
      // Parse the original response as JSON
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error(`Error parsing response as JSON: ${parseError}`);
      throw new Error(`Error parsing response from ${functionName}: ${rawText.substring(0, 50)}...`);
    }
    
    if (!response.ok) {
      console.error(`Error response from ${functionName}:`, data);
      throw new Error(data.error || `Error calling ${functionName}: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    throw error;
  }
};

interface CreateUserParams {
  emailAddress: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  groupType?: string;
  companyName?: string;
}

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddress: string;
  publicMetadata: Record<string, any>;
  createdAt: Date;
  lastSignInAt: Date | null;
  supabaseData?: {
    role: string;
    group_type: string;
    company_name: string;
    status: string;
  };
}

/**
 * Create a new user in both Clerk and Supabase using the admin-create-user Edge Function
 */
export async function createUser(params: CreateUserParams): Promise<string | null> {
  try {
    // Add more logging to debug payload contents
    console.log('Preparing user creation payload with params:', {
      email: params.emailAddress,
      password: params.password ? '[REDACTED]' : undefined,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role,
      groupType: params.groupType,
      companyName: params.companyName
    });
    
    // Send payload with field names matching exactly what the Edge Function expects
    const response = await callEdgeFunction('admin-create-user', 'POST', {
      email: params.emailAddress,
      username: params.username,
      password: params.password,
      firstName: params.firstName || '',
      lastName: params.lastName || '',
      role: params.role || 'user',
      group_type: params.groupType || 'Franchisee',
      company_name: params.companyName || '',
      status: 'active'
    });
    
    // Debug info - if the response doesn't contain user data
    if (!response.user) {
      console.error('User data missing from Edge Function response:', response);
    }

    // Return the ID of the created user
    return response.user?.id || null;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}



/**
 * Reset a user's password using the Supabase Edge Function
 * The Edge Function handles admin verification and Clerk API calls
 * @param userId The Clerk user ID 
 * @param newPassword The new password to set
 */
export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  try {
    console.log(`Resetting password for Clerk user ID: ${userId}`);
    
    // Call the simple-reset-password Edge Function
    // This function has improved error handling and better diagnostics
    await callEdgeFunction('simple-reset-password', 'POST', {
      userId,
      newPassword
    });
    
    console.log('Password reset successful', { userId });
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

/**
 * Delete a user from both Clerk and Supabase using the admin-delete-user Edge Function
 */
export async function deleteUser(userId: string, clerkId?: string): Promise<void> {
  try {
    await callEdgeFunction('admin-delete-user', 'POST', {
      userId,
      clerkId // Only needed if different from userId
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Fetch all users using the admin-list-users Edge Function
 */
export async function fetchUsers(): Promise<User[]> {
  try {
    // Call the Edge Function to get the combined user list
    const response = await callEdgeFunction('admin-list-users', 'GET');
    return response.users || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Update user metadata using the admin-update-user Edge Function
 */
export async function updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<void> {
  try {
    await callEdgeFunction('admin-update-user', 'PATCH', {
      userId,
      ...metadata // The Edge Function will apply these as user_metadata
    });
  } catch (error) {
    console.error('Error updating user metadata:', error);
    throw error;
  }
}

/**
 * Update user details in both Clerk and Supabase using the admin-update-user Edge Function
 */
export async function updateUserInSupabase(userId: string, data: {
  first_name?: string;
  last_name?: string;
  role?: string;
  group_type?: string;
  company_name?: string;
  status?: string;
  email?: string;
}): Promise<void> {
  try {
    console.log(`Updating user ${userId} in Supabase with data:`, data);
    await callEdgeFunction('admin-update-user', 'POST', {
      userId,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
      group_type: data.group_type,
      company_name: data.company_name,
      status: data.status,
      email: data.email
    });
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// Add Clerk types to Window interface
declare global {
  interface Window {
    Clerk: any;
  }
}
