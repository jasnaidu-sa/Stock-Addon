# Assignment Tables Analysis and Fix

## Problem Summary

The `hierarchy-upload.tsx` component was failing with 400 errors because it was trying to insert into assignment tables that didn't exist in the database.

## Analysis of hierarchy-upload.tsx

The hierarchy upload code attempts to insert into these tables:

1. **store_manager_assignments** - Links store managers to their assigned stores
2. **area_manager_store_assignments** - Links area managers to stores they oversee  
3. **regional_manager_assignments** - Links regional managers to stores in their region
4. **regional_area_manager_assignments** - Links regional managers to area managers they supervise

## Current Database State

### Existing Tables
- ✅ **users** - Contains user data with roles (customer, admin, regional_manager, area_manager, store_manager)
- ✅ **stores** - Contains store information
- ✅ **regional_manager_store_allocations** - Links regional managers to stores (older table)

### Missing Tables (causing 400 errors)
- ❌ **store_manager_assignments** - MISSING
- ❌ **area_manager_store_assignments** - MISSING  
- ❌ **regional_manager_assignments** - MISSING
- ❌ **regional_area_manager_assignments** - MISSING
- ❌ **excel_sync_logs** - MISSING (for tracking upload progress)
- ❌ **sync_conflicts** - MISSING (for tracking upload conflicts)

## Solution

Created migration `20250716_003_create_assignment_tables.sql` that adds:

### 1. Core Assignment Tables

#### store_manager_assignments
```sql
- id (UUID, primary key)
- store_id (UUID, references stores)
- store_manager_id (UUID, references users)
- assignment_source (excel_upload, manual, api)
- status (active, inactive, pending)
- assigned_by, assigned_at, deactivated_at
- notes, created_at, updated_at
```

#### area_manager_store_assignments  
```sql
- id (UUID, primary key)
- store_id (UUID, references stores)
- area_manager_id (UUID, references users)
- assignment_source (excel_upload, manual, api)
- status (active, inactive, pending)
- assigned_by, assigned_at, deactivated_at
- notes, created_at, updated_at
```

#### regional_manager_assignments
```sql
- id (UUID, primary key)
- store_id (UUID, references stores)  
- regional_manager_id (UUID, references users)
- assignment_source (excel_upload, manual, api)
- status (active, inactive, pending)
- assigned_by, assigned_at, deactivated_at
- notes, created_at, updated_at
```

#### regional_area_manager_assignments
```sql
- id (UUID, primary key)
- regional_manager_id (UUID, references users)
- area_manager_id (UUID, references users)
- assignment_source (excel_upload, manual, api)
- status (active, inactive, pending)
- assigned_by, assigned_at, deactivated_at
- notes, created_at, updated_at
```

### 2. Support Tables for Excel Upload

#### excel_sync_logs
```sql
- id (UUID, primary key)
- sync_id (UUID, unique per upload)
- operation_type (full_sync, etc.)
- total_rows_processed, users_created, users_updated
- stores_created, stores_updated, assignments_created
- conflicts_found, sync_status, error_details
- created_at, updated_at
```

#### sync_conflicts
```sql
- id (UUID, primary key)
- sync_id (UUID, links to excel_sync_logs)
- conflict_type (validation_error, etc.)
- entity_type (user, store, assignment)
- entity_id (UUID, optional)
- conflict_description, resolution_status, resolution_notes
- created_at, updated_at
```

### 3. Security Features

- **Row Level Security (RLS)** enabled on all tables
- **Role-based policies**:
  - Admins: Full access to all tables
  - Regional Managers: Read access to their assignments
  - Area Managers: Read access to their assignments  
  - Store Managers: Read access to their assignments
- **Foreign key constraints** ensure data integrity
- **Check constraints** validate user roles
- **Unique constraints** prevent duplicate assignments

### 4. Performance Features

- **Indexes** on frequently queried columns
- **Updated_at triggers** for audit trail
- **Proper data types** for optimal storage

## How to Apply the Fix

1. **Run the migration**:
   ```bash
   node apply-migration.js
   ```

2. **Verify tables exist**:
   ```bash
   node check-db-tables.js
   ```

3. **Test hierarchy upload**:
   - Use the hierarchy-upload component
   - Upload an Excel file with the expected format
   - Should now work without 400 errors

## Expected Excel Format

The hierarchy upload expects these columns:
- `rm_name`, `rm_surname`, `rm_email`, `rm_username` (Regional Manager)
- `am_name`, `am_surname`, `am_username`, `am_email` (Area Manager)
- `Store`, `store_code` (Store information)
- `store_manager`, `Store_manager_email`, `Store_manager_username` (Store Manager)

## Impact on hierarchy-upload.tsx

After applying the migration, the hierarchy upload will:

1. ✅ Successfully create users for all management levels
2. ✅ Successfully create/update stores
3. ✅ Successfully create assignments between managers and stores
4. ✅ Successfully create regional-to-area manager relationships
5. ✅ Log sync progress and conflicts properly
6. ✅ Maintain data integrity with proper constraints

## Testing

To test the fix:

1. Apply the migration
2. Upload a sample Excel file with hierarchy data
3. Verify assignments were created in the database
4. Check that RLS policies work correctly for different user roles

The 400 errors should be resolved once these tables exist in the database.