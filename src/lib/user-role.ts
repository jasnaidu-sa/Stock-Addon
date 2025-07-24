import { getSupabaseClient } from './supabase';

export type UserRole = 'store_manager' | 'area_manager' | 'regional_manager' | 'admin' | null;

export interface UserHierarchy {
  id: string;
  role: string;
  hierarchyRole: UserRole;
  assignedStores: string[];
}

export interface StoreHierarchy {
  store_id: string;
  store_code: string;
  store_name: string;
  region: string;
  store_active: boolean;
  store_status: string;
  store_manager_id: string;
  store_manager_first_name: string;
  store_manager_last_name: string;
  store_manager_email: string;
  store_manager_status: string;
  area_manager_id: string;
  area_manager_first_name: string;
  area_manager_last_name: string;
  area_manager_email: string;
  area_manager_status: string;
  regional_manager_id: string;
  regional_manager_first_name: string;
  regional_manager_last_name: string;
  regional_manager_email: string;
  regional_manager_status: string;
  effective_manager_id: string;
  effective_manager_level: string;
  effective_manager_email: string;
}

/**
 * Get user hierarchy information based on Clerk user ID
 */
export async function getUserHierarchy(clerkUserId: string): Promise<UserHierarchy | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    // Get user data from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      return null;
    }

    // Check if user is admin
    if (userData.role === 'admin') {
      return {
        id: userData.id,
        role: userData.role,
        hierarchyRole: 'admin',
        assignedStores: []
      };
    }

    // Check management hierarchy
    const { data: hierarchyData, error: hierarchyError } = await supabase
      .from('store_management_hierarchy')
      .select('*')
      .or(`store_manager_id.eq.${userData.id},area_manager_id.eq.${userData.id},regional_manager_id.eq.${userData.id}`);

    if (hierarchyError || !hierarchyData || hierarchyData.length === 0) {
      return null;
    }

    // Determine role based on hierarchy
    const firstRecord = hierarchyData[0];
    let hierarchyRole: UserRole = null;
    let assignedStores: string[] = [];

    if (firstRecord.regional_manager_id === userData.id) {
      hierarchyRole = 'regional_manager';
      assignedStores = hierarchyData.map(h => h.store_id);
    } else if (firstRecord.area_manager_id === userData.id) {
      hierarchyRole = 'area_manager';
      assignedStores = hierarchyData.map(h => h.store_id);
    } else if (firstRecord.store_manager_id === userData.id) {
      hierarchyRole = 'store_manager';
      assignedStores = hierarchyData.map(h => h.store_id);
    }

    return {
      id: userData.id,
      role: userData.role,
      hierarchyRole,
      assignedStores
    };
  } catch (error) {
    console.error('Error getting user hierarchy:', error);
    return null;
  }
}

/**
 * Get store hierarchy for a user based on their role
 */
export async function getStoreHierarchyForUser(userId: string): Promise<StoreHierarchy[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('store_management_hierarchy')
      .select('*')
      .or(`store_manager_id.eq.${userId},area_manager_id.eq.${userId},regional_manager_id.eq.${userId}`)
      .order('store_name');

    if (error) {
      console.error('Error getting store hierarchy:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting store hierarchy:', error);
    return [];
  }
}

/**
 * Check if user has permission to access a specific store
 */
export function hasStorePermission(storeId: string, userHierarchy: UserHierarchy): boolean {
  return userHierarchy.assignedStores.includes(storeId) || userHierarchy.hierarchyRole === 'admin';
}

/**
 * Get amendment type based on user role
 */
export function getAmendmentType(role: UserRole): string {
  switch (role) {
    case 'store_manager':
      return 'store_manager';
    case 'area_manager':
      return 'area_manager';
    case 'regional_manager':
      return 'regional_manager';
    case 'admin':
      return 'admin';
    default:
      return 'unknown';
  }
}

/**
 * Get next approval level in hierarchy
 */
export function getNextApprovalLevel(currentRole: UserRole): UserRole {
  switch (currentRole) {
    case 'store_manager':
      return 'area_manager';
    case 'area_manager':
      return 'regional_manager';
    case 'regional_manager':
      return 'admin';
    default:
      return null;
  }
}