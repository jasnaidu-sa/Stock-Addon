import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductCategory, Base } from '@/types/product'; // Added Base import

// Extend Window interface to include ENV
declare global {
  interface Window {
    ENV?: Record<string, string>;
  }
}

// Add a robust function to get environment values from various sources
function getEnvValue(key: string): string {
  // Try to get values from different sources
  const importMetaValue = import.meta.env[key];
  const windowEnvValue = window.ENV && window.ENV[key];
  
  // Define fallbacks for critical values
  const fallbacks: Record<string, string> = {
    'VITE_SUPABASE_URL': 'https://cfjvskafvcljvxnawccs.supabase.co',
    'VITE_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanZza2FmdmNsanZ4bmF3Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MzczODQsImV4cCI6MjA1NjIxMzM4NH0.0kEvw4fWwp0Qw2fSXtmvcstZK3pYhS2yXiS0h68DEx0'
  };
  
  // Return the first non-empty value from our sources
  return importMetaValue || windowEnvValue || fallbacks[key] || '';
}

const supabaseUrl = getEnvValue('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvValue('VITE_SUPABASE_ANON_KEY');
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Debug: Log all available environment variables
if (import.meta.env.DEV) {
  console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'exists' : 'missing');
  console.log('VITE_SUPABASE_SERVICE_ROLE_KEY:', import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing');
}

// Enhanced debug logging
console.log('Environment Variables Check:', {
  hasUrl: !!supabaseUrl,
  urlLength: supabaseUrl?.length,
  hasAnonKey: !!supabaseAnonKey,
  anonKeyLength: supabaseAnonKey?.length,
  hasServiceKey: !!supabaseServiceRoleKey,
  serviceKeyLength: supabaseServiceRoleKey?.length,
  // Direct comparison of actual values for debugging
  url: supabaseUrl,
  // For security, only log key format
  anonKeyFormat: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 10)}` : 'not available',
  serviceKeyFormat: supabaseServiceRoleKey ? `${supabaseServiceRoleKey.substring(0, 10)}...${supabaseServiceRoleKey.substring(supabaseServiceRoleKey.length - 10)}` : 'not available'
});

// Check if service role key is available
if (!supabaseServiceRoleKey) {
  console.error('⚠️ SERVICE ROLE KEY NOT FOUND! Admin functions will not work.');
  console.log('Available env vars:', Object.keys(import.meta.env));
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables:', {
    url: supabaseUrl ? 'present' : 'missing',
    anonKey: supabaseAnonKey ? 'present' : 'missing'
  });
  throw new Error('Missing Supabase environment variables');
}

console.log('Initializing Supabase client with:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey
});

// Interface for Clerk's getToken function
interface ClerkGetToken {
  (options?: { template?: string; skipCache?: boolean }): Promise<string | null>;
}

// Interface for token cache
interface TokenCache {
  value: string | null;
  expiresAt: number;
}

// Token cache to reduce Clerk API calls
let tokenCache: TokenCache | null = null;

// Define a utility function to get the Clerk JWT token with caching
async function getClerkToken(getToken: ClerkGetToken): Promise<string | null> {
  // Check if we have a valid cached token first
  const now = Date.now();
  if (tokenCache?.value && tokenCache.expiresAt > now) {
    console.log('Using cached Clerk token (expires in', Math.round((tokenCache.expiresAt - now) / 1000), 'seconds)');
    return tokenCache.value;
  }

  console.log('Fetching fresh Clerk token');
  // Get a fresh token from Clerk
  try {
    const token = await getToken({ template: 'supabase' });
    
    // Cache the token if we received one
    if (token) {
      try {
        // Parse JWT to get expiration time
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          // Set cache expiry 5 minutes before actual token expiry to be safe
          const expiryTime = payload.exp ? (payload.exp * 1000) - (5 * 60 * 1000) : (now + 3600 * 1000);
          tokenCache = { value: token, expiresAt: expiryTime };
          console.log('Token cached until', new Date(expiryTime).toISOString());
        } else {
          // If token doesn't have the expected format, set a default 1 hour expiry
          tokenCache = { value: token, expiresAt: now + 3600 * 1000 };
          console.log('Token format unexpected, using default 1 hour cache');
        }
      } catch (e) {
        // If parsing fails, set a default 1 hour expiry
        console.error('Error parsing JWT token for caching:', e);
        tokenCache = { value: token, expiresAt: now + 3600 * 1000 };
      }
    }
    
    return token;
  } catch (error) {
    console.error('Error getting Clerk token:', error);
    return null;
  }
}

/**
 * A singleton class to manage Supabase client instances
 * This ensures we only create one instance of each client type
 */
class SupabaseClientManager {
  // Private static fields for singleton instances
  private static regularClient: SupabaseClient | null = null;
  private static adminClient: SupabaseClient | null = null;
  private static clerkGetToken: ClerkGetToken | null = null;
  private static isClerkInitialized = false;

  // Private constructor to prevent instantiation
  private constructor() {}

  /**
   * Initialize Supabase with Clerk token provider
   * This should only be called once when Clerk is fully loaded
   */
  public static initWithClerk(getToken: ClerkGetToken): SupabaseClient {
    // Store the token provider for future use
    this.clerkGetToken = getToken;
    this.isClerkInitialized = true;
    
    // If we already have a client, destroy it to avoid multiple instances
    if (this.regularClient) {
      console.log('Destroying existing Supabase client before recreation');
      this.regularClient = null;
    }
    
    // Create a new client with Clerk token integration
    this.regularClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Disable Supabase Auth features that would conflict with Clerk
        autoRefreshToken: false,
        persistSession: false,
        // Use a unique storage key to avoid conflicts
        storageKey: 'supabase-js-clerk-auth',
        // Use in-memory storage (effectively disables storage)
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      },
      global: {
        // Custom fetch handler to inject Clerk JWT token
        fetch: async (url, options = {}) => {
          console.log('[SupabaseCustomFetch DEBUG] Incoming URL:', url.toString()); // Log the incoming URL
          let token = null;
          
          try {
            // Skip token requests for public resources like assets
            const isPublicResource = url.toString().includes('/storage/v1/object/public/') ||
                                   url.toString().includes('.png') ||
                                   url.toString().includes('.jpg') ||
                                   url.toString().includes('.svg') ||
                                   url.toString().includes('.css') ||
                                   url.toString().includes('.js');
            
            if (isPublicResource) {
              // Don't request token for public resources
              // No need to log this for every request
            } else {
              // Get the Clerk JWT token with caching for protected resources
              token = await getClerkToken(getToken);
            }
            
            // If we have a token, decode and log its structure (without sensitive data)
            if (token) {
              try {
                // Split the JWT and decode the payload (middle part)
                const parts = token.split('.');
                if (parts.length === 3) {
                  const payload = JSON.parse(atob(parts[1]));
                  console.log('JWT payload structure:', {
                    sub: payload.sub ? `${payload.sub.substring(0, 6)}...` : undefined,
                    role: payload.role,
                    hasUserId: !!payload.user_id,
                    exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
                    iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined,
                    keys: Object.keys(payload)
                  });
                  
                  // Log the full sub claim for debugging
                  console.log('JWT sub claim (Clerk user ID):', payload.sub);
                  
                  // Check if this matches any known Clerk IDs in our database
                  if (payload.sub === 'user_2xe4YRzCyXlvSGjMEhaGnFQC95k' || 
                      payload.sub === 'user_2xrEqSwjuYBqv3G7o1wsuZ37kPM') {
                    console.log('JWT contains a recognized Clerk ID');
                  } else {
                    console.warn('JWT contains an unrecognized Clerk ID');
                  }
                }
              } catch (e) {
                console.error('Error decoding JWT:', e);
              }
            }
            
            // Initialize headers if they don't exist
            if (!options.headers) {
              options.headers = {};
            }
            
            // Always include the anon key as apikey for public routes
            // This ensures we have at least basic authentication for all requests
            (options.headers as any).apikey = supabaseAnonKey;
            
            if (token) {
              // Make sure headers is initialized
              (options.headers as any).Authorization = `Bearer ${token}`;
              console.log('Added Clerk JWT token to request headers');
            } else {
              // Only warn for protected routes that should have a token
              if (!url.toString().includes('/storage/v1/object/public/')) {
                console.warn('No Clerk JWT token available for request to:', url.toString());
              }
            }
            
            // Debug the final headers being sent (redacted for security)
            // Reduce logging frequency to avoid console spam
            if (Math.random() < 0.1) { // Log only ~10% of requests
              console.log('Request headers:', {
                hasApiKey: !!(options.headers as any).apikey,
                hasAuthorization: !!(options.headers as any).Authorization,
                url: url.toString()
              });
            }
          } catch (error) {
            // Check if this is a rate limit error
            if (error instanceof Error && error.message.includes('429')) {
              console.warn('Rate limit hit when requesting Clerk token. Using fallback authentication.');
              // Continue with just the anon key
            } else {
              console.error('Error getting Clerk token:', error);
            }
          }
          
          // Always proceed with the fetch, even if token acquisition fails
          return fetch(url, options);
        }
      }
    });
    
    console.log('Created new Supabase client with Clerk integration');
    return this.regularClient;
  }

  /**
   * Get the Supabase client instance
   * If Clerk is not initialized yet, this will return null
   */
  public static getClient(): SupabaseClient | null {
    // If Clerk is not initialized yet, return null
    if (!this.isClerkInitialized) {
      console.log('Supabase client requested before Clerk initialization');
      return null;
    }
    
    // If we have a token provider but no client, initialize with Clerk
    if (!this.regularClient && this.clerkGetToken) {
      return this.initWithClerk(this.clerkGetToken);
    }
    
    return this.regularClient;
  }

  /**
   * Get the admin Supabase client instance with service role key
   * Creates a new instance if one doesn't exist
   */
  public static getAdminClient(): SupabaseClient | null {
    if (!supabaseServiceRoleKey) {
      console.error('Cannot create admin client: Service role key is missing');
      return null;
    }
    
    if (!this.adminClient) {
      this.adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          storageKey: 'supabase-admin-auth',
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
          }
        },
        global: {
          headers: {
            'x-client-info': 'supabase-admin/2.x'
          }
        }
      });
      console.log('Created Supabase admin client');
    }
    
    return this.adminClient;
  }
}

// Public API for Supabase client access

/**
 * Initialize Supabase with Clerk authentication
 * Call this once when Clerk is loaded
 */
export function initializeSupabaseWithClerk(getToken: ClerkGetToken): SupabaseClient {
  return SupabaseClientManager.initWithClerk(getToken);
}

/**
 * Get the Supabase client instance
 * This will return the Clerk-authenticated client if available, or null if Clerk is not initialized
 */
export function getSupabaseClient(): SupabaseClient | null {
  return SupabaseClientManager.getClient();
}

/**
 * Get the Supabase admin client with service role key
 * Only use this for admin operations
 */
export const supabaseAdmin = SupabaseClientManager.getAdminClient();

// Log admin client status
console.log('Supabase Admin Client:', {
  isAvailable: !!supabaseAdmin,
  hasServiceKey: !!supabaseServiceRoleKey,
  serviceKeyLength: supabaseServiceRoleKey?.length
});

// Set up auth state listeners only once when the module is loaded
// This prevents duplicate listeners when the module is imported multiple times
let authListenersInitialized = false;

/**
 * Set up auth state listeners when Supabase client is available
 * This is called after Clerk is initialized
 */
export function setupAuthListeners() {
  if (authListenersInitialized) return;
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('Cannot set up auth listeners: Supabase client not initialized');
    return;
  }
  
  // Add auth state change listener for debugging
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', { 
      event, 
      hasSession: !!session, 
      user: session?.user?.email
    });
  });

  // Initial session check
  supabase.auth.getSession().then(({ data, error }) => {
    console.log('Initial session check:', {
      hasSession: !!data.session,
      error: error?.message,
      user: data.session?.user?.email
    });
  });
  
  authListenersInitialized = true;
  console.log('Auth listeners initialized successfully');
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  created_at: string;
};

export interface CartItem {
  id: string;
  quantity: number;
  price: number;
  name: string;
  code: string;
  category: ProductCategory; // Retaining for now, though product_type might supersede
  notes?: string;
  base_qty?: number; // Retaining for now, might be legacy or for a different purpose
  product_type?: ProductCategory; // Added: e.g., 'mattress', 'base'
  base?: Base; // Added: Optional, for mattresses that include a base
}

export type Product = {
  id: string;
  code?: string;
  mattress_code?: string;
  base_code?: string;
  description: string;
  size: string;
  price: number;
  set_price?: string;
  mattress_price?: string;
  base_price?: string;
  created_at: string;
};