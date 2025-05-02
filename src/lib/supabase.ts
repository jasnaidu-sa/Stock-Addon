import { createClient } from '@supabase/supabase-js';
import { ProductCategory } from '@/types/product';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Debug logging
console.log('Environment Variables Check:', {
  hasUrl: !!supabaseUrl,
  urlLength: supabaseUrl?.length,
  hasAnonKey: !!supabaseAnonKey,
  anonKeyLength: supabaseAnonKey?.length,
  hasServiceKey: !!supabaseServiceRoleKey,
  serviceKeyLength: supabaseServiceRoleKey?.length,
  // Log actual values for debugging
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  serviceKey: supabaseServiceRoleKey
});

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

// Create the main Supabase client with anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js/2.x',
    },
  },
});

// Create admin client with service role key (only for server-side operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      'x-client-info': 'supabase-admin/2.x',
    },
  },
});

// Add auth state change listener for debugging
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', {
    event,
    hasSession: !!session,
    user: session?.user?.email,
  });
});

// Test the connection on initialization
supabase.auth.getSession().then(({ data, error }) => {
  console.log('Initial session check:', {
    hasSession: !!data.session,
    error: error?.message,
    user: data.session?.user?.email
  });
});

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
  category: ProductCategory;
  notes?: string;
  base_qty?: number;
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