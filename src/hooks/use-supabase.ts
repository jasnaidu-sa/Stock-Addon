import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * Custom hook that provides the Supabase client only when it's ready
 * and handles loading state
 */
export function useSupabase() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if client is already available
    const supabase = getSupabaseClient();
    if (supabase) {
      setClient(supabase);
      setIsLoading(false);
      return;
    }

    // If not available, set up an interval to check periodically
    const checkInterval = setInterval(() => {
      const client = getSupabaseClient();
      if (client) {
        setClient(client);
        setIsLoading(false);
        clearInterval(checkInterval);
      }
    }, 500); // Check every 500ms

    // Set a timeout to prevent infinite waiting
    const timeout = setTimeout(() => {
      if (!getSupabaseClient()) {
        clearInterval(checkInterval);
        setError(new Error('Timed out waiting for Supabase client initialization'));
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  return { supabase: client, isLoading, error };
}
