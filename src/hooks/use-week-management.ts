import { useState, useEffect } from 'react';
import { supabaseAdmin } from '@/lib/supabase';

export interface WeekSelection {
  id: string;
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
  year: number;
  week_number: number;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
}

export interface WeekManagementHook {
  weeks: WeekSelection[];
  currentWeek: WeekSelection | null;
  activeWeeks: WeekSelection[];
  isLoading: boolean;
  error: string | null;
  fetchWeeks: () => Promise<void>;
  setCurrentWeek: (weekId: string) => Promise<void>;
  toggleWeekActive: (weekId: string, isActive: boolean) => Promise<void>;
  getCurrentWeekForUser: (userRole: string) => WeekSelection | null;
}

export function useWeekManagement(): WeekManagementHook {
  const [weeks, setWeeks] = useState<WeekSelection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSupabase = () => {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }
    return supabaseAdmin;
  };

  const fetchWeeks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const db = checkSupabase();
      
      const { data, error } = await db
        .from('week_selections')
        .select('*')
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      
      setWeeks(data || []);
    } catch (err) {
      console.error('Error fetching weeks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch weeks');
    } finally {
      setIsLoading(false);
    }
  };

  const setCurrentWeek = async (weekId: string) => {
    try {
      const db = checkSupabase();
      
      // First, set all weeks to not current
      await db
        .from('week_selections')
        .update({ is_current: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
      
      // Then set the selected week as current
      const { error } = await db
        .from('week_selections')
        .update({ is_current: true })
        .eq('id', weekId);

      if (error) throw error;
      
      await fetchWeeks();
    } catch (err) {
      console.error('Error setting current week:', err);
      setError(err instanceof Error ? err.message : 'Failed to set current week');
      throw err;
    }
  };

  const toggleWeekActive = async (weekId: string, isActive: boolean) => {
    try {
      const db = checkSupabase();
      
      const { error } = await db
        .from('week_selections')
        .update({ is_active: isActive })
        .eq('id', weekId);

      if (error) throw error;
      
      await fetchWeeks();
    } catch (err) {
      console.error('Error toggling week active status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update week status');
      throw err;
    }
  };

  const getCurrentWeekForUser = (userRole: string): WeekSelection | null => {
    // For now, return the current week regardless of role
    // This can be enhanced later for role-specific week access
    return weeks.find(week => week.is_current) || null;
  };

  useEffect(() => {
    fetchWeeks();
  }, []);

  // Computed values
  const currentWeek = weeks.find(week => week.is_current) || null;
  const activeWeeks = weeks.filter(week => week.is_active);

  return {
    weeks,
    currentWeek,
    activeWeeks,
    isLoading,
    error,
    fetchWeeks,
    setCurrentWeek,
    toggleWeekActive,
    getCurrentWeekForUser
  };
}

// Utility functions for week management
export const getWeekInfo = (week: WeekSelection) => {
  const startDate = new Date(week.week_start_date);
  const endDate = new Date(week.week_end_date);
  
  return {
    reference: week.week_reference,
    startDate,
    endDate,
    year: week.year,
    weekNumber: week.week_number,
    dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    isCurrentWeek: week.is_current,
    isActive: week.is_active
  };
};

export const isWeekInPast = (week: WeekSelection): boolean => {
  const endDate = new Date(week.week_end_date);
  const today = new Date();
  return endDate < today;
};

export const isWeekInFuture = (week: WeekSelection): boolean => {
  const startDate = new Date(week.week_start_date);
  const today = new Date();
  return startDate > today;
};

export const canUserAccessWeek = (week: WeekSelection, userRole: string): boolean => {
  // Basic access control - can be enhanced based on requirements
  if (!week.is_active) return false;
  
  switch (userRole) {
    case 'admin':
      return true; // Admins can access all weeks
    case 'regional_manager':
    case 'area_manager':
    case 'store_manager':
      return week.is_current || week.is_active; // Managers can access current/active weeks
    default:
      return false;
  }
};