# Weekly Plans Amendment Workflow - Discussion Document

## Project Context
**Date:** 2025-07-09
**Project:** The Bed Shop Stock Addon - Weekly Plans Amendment System
**Status:** Design Phase - Discussion Document

## Background
We had a long discussion on setting up a new process for weekly plans amendments. The current system only allows admin users to upload and manage weekly plans. We need to create a workflow where store users can make amendments to their assigned stores' weekly plans, which then go through an approval process.

## Current System Analysis

### ✅ What we have:
- Weekly plan Excel upload system in `/src/pages/admin/weekly-plan.tsx`
- Basic weekly plan storage with all necessary fields in `weekly_plan` table
- Admin-only upload and management via `WeeklyPlanUpload` component
- Store name, category, stock codes, quantities tracking
- User roles: 'admin' and 'customer' in users table
- Comprehensive mattress/base cart rules system

### 🔍 Key Data Fields Available in `weekly_plan` table:
- `store_name` - Critical for store-based access
- `category` - For tab navigation (mattress, furniture, accessories, foam)
- `stock_code`, `description` - For SKU identification
- `order_qty`, `act_order_qty` - Base quantities
- `add_ons_qty` - For amendments/add-ons
- `reference` - Week reference (e.g., "Week 28")
- `start_date` - Week start date
- Various quantity fields: `qty_on_hand`, `qty_in_transit`, `qty_pending_orders`

### 🔧 Existing Mattress/Base Rules (From Cart System):
Located in multiple files under `/src/components/cart/` and `/src/lib/product-utils.ts`:

1. **Quantity Synchronization**: When mattress quantities change, corresponding base quantities automatically update based on `base_qty` multiplier
2. **Base Inclusion Option**: Users can choose whether to include bases with mattresses
3. **Synthetic ID System**: Bases added with mattresses get synthetic IDs (`${mattressId}_base`)
4. **Code Relationships**: Mattresses have `mattress_code` and `base_code` properties to link to corresponding bases
5. **Product Type Differentiation**: Cart items distinguish between 'mattress' and 'base' product types
6. **Price Calculation**: Different pricing logic for mattresses with/without bases (set_price vs mattress_price)
7. **Database Lookup**: Bases are looked up dynamically using the mattress's `base_code` property

## Proposed New Workflow - UPDATED REQUIREMENTS

### Phase 1: Regional Manager & Store Allocation System

**New User Role:**
- **Regional Manager** - New role between admin and customer
- Regional Managers login and see only their allocated stores
- Only **Admin** approves all amendments (single approval level)

**New Database Tables Needed:**

1. **`stores`** - Master store list (Excel uploadable)
   ```sql
   CREATE TABLE stores (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     store_code VARCHAR(50) UNIQUE NOT NULL,
     store_name VARCHAR(200) NOT NULL,
     region VARCHAR(100),
     address TEXT,
     contact_person VARCHAR(100),
     phone VARCHAR(50),
     email VARCHAR(100),
     active BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. **`categories`** - Product categories (Excel uploadable)
   ```sql
   CREATE TABLE categories (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     category_code VARCHAR(50) UNIQUE NOT NULL,
     category_name VARCHAR(100) NOT NULL,
     description TEXT,
     sort_order INTEGER DEFAULT 0,
     active BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

3. **`regional_manager_store_allocations`** - Link regional managers to specific stores
   ```sql
   CREATE TABLE regional_manager_store_allocations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES users(id) ON DELETE CASCADE,
     store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
     allocated_by UUID REFERENCES users(id), -- Admin who made allocation
     allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     active BOOLEAN DEFAULT true,
     UNIQUE(user_id, store_id)
   );
   ```

4. **`weekly_plan_amendments`** - Track regional manager changes and admin approvals
   ```sql
   CREATE TABLE weekly_plan_amendments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     weekly_plan_id UUID REFERENCES weekly_plan(id) ON DELETE CASCADE,
     user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Regional Manager making change
     store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
     week_reference VARCHAR(50) NOT NULL, -- e.g., "Week 28"
     week_start_date DATE NOT NULL,
     amendment_type VARCHAR(50) NOT NULL, -- 'add_on', 'quantity_change', 'new_item', 'admin_edit'
     original_qty INTEGER DEFAULT 0,
     amended_qty INTEGER NOT NULL,
     justification TEXT,
     status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'admin_review', 'approved', 'rejected')),
     admin_id UUID REFERENCES users(id), -- Admin who approves/rejects
     admin_notes TEXT,
     created_by_role VARCHAR(20) NOT NULL, -- 'regional_manager', 'admin'
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

5. **`week_selections`** - Available weeks for amendment selection
   ```sql
   CREATE TABLE week_selections (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     week_reference VARCHAR(50) UNIQUE NOT NULL, -- e.g., "Week 28"
     week_start_date DATE NOT NULL,
     week_end_date DATE NOT NULL,
     year INTEGER NOT NULL,
     week_number INTEGER NOT NULL,
     is_current BOOLEAN DEFAULT false, -- Only one current week
     is_active BOOLEAN DEFAULT true, -- Available for amendments
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

### Phase 2: Excel Upload Processes

**New Excel Upload Capabilities:**

1. **Store Master Upload** (`/admin/stores-upload`)
   - Excel format: Store Code, Store Name, Region, Address, Contact Person, Phone, Email
   - Validation: Unique store codes, required fields
   - Bulk insert/update existing stores

2. **Category Master Upload** (`/admin/categories-upload`)
   - Excel format: Category Code, Category Name, Description, Sort Order
   - Validation: Unique category codes, numeric sort order
   - Integration with existing weekly plan categories

3. **Regional Manager Store Allocations Upload** (`/admin/allocations-upload`)
   - Excel format: Regional Manager Email, Store Code(s)
   - Validation: Valid user emails, existing store codes
   - Bulk allocation assignment

### Phase 3: User Interface Flow

**Regional Manager Experience:**
1. **Week Selection** - Choose current/available week for amendments
2. **Store Selection View** - See only allocated stores from their assignments
3. **Category Tabs** - Navigation by uploaded categories (mattress, furniture, accessories, foam)
4. **SKU Management** - Grid view with:
   - Original planned quantities for selected week
   - Amendment fields for add-ons
   - **Mattress/Base Rules Applied** - When mattress quantities change, base quantities auto-adjust
5. **Submit for Approval** - Changes go to admin with status tracking

**Admin Experience:**
1. **Week Management** - Set current week, activate/deactivate weeks for amendments
2. **Store & Category Management** - Excel uploads for master data
3. **Regional Manager Allocation** - Assign stores to regional managers
4. **Amendment Dashboard** - View all pending amendments by store/regional manager
5. **Amendment Approval Interface** - Accept/reject/modify individual amendments (single approval level)
6. **Amendment Management Only** - Admins work ONLY with amendment records:
   - Review regional manager amendment requests
   - Approve/reject/modify amendment quantities  
   - NO direct editing of base weekly plan data
   - Original weekly plan data remains unchanged by admin
   - Approved amendments update `weekly_plan.add_ons_qty` field only
7. **Excel Export Capabilities**:
   - Download final amended weekly plans (original + approved amendments)
   - Export amendment summary reports by store/week
   - Export pending amendments for review
   - Export amendment audit trail

### Phase 4: Mattress/Base Rules Integration

**Key Rules to Apply from Existing Cart System:**
- When regional manager increases mattress quantities, system auto-calculates base requirements
- Base quantities sync with mattress changes using `base_qty` multiplier
- Price calculations for mattresses with/without bases
- Validation for mattress-base combinations
- Use existing utilities from `/src/lib/product-utils.ts`:
  - `fetchBaseInfoByCode()` function
  - Base product lookup logic
  - Product type differentiation

## UPDATED Requirements Summary

### ✅ **CONFIRMED REQUIREMENTS:**

1. **New User Role**: Regional Manager (between admin and customer)
2. **Store Allocation**: Individual stores assigned to regional managers via Excel upload
3. **Single Approval**: Only admins approve amendments (no multi-level)
4. **Week Selection**: Current week selection for amendments
5. **Excel Uploads**: 
   - Store master data
   - Category master data  
   - Regional manager allocations
6. **Admin Editing**: Admins can edit weekly plans directly (same interface, immediate save)

### 🔧 **Technical Architecture CONFIRMED:**

- **Separate amendments table** for audit trail (Option A)
- **Regional managers see only allocated stores**
- **Week-based amendment system**
- **Integration with existing mattress/base rules**
- **Excel upload validation and bulk operations**

## RESOLVED Discussion Points

### 1. ✅ Store Assignment Strategy - RESOLVED
- **Individual store assignments** to regional managers
- **Excel upload process** for bulk allocation
- **Multiple stores per regional manager** supported

### 2. ✅ Amendment Approval Levels - RESOLVED  
- **Single admin approval** only
- **No quantity limits specified** (can be added later)
- **Manual approval for all changes**

### 3. ✅ User Roles - RESOLVED
- **Add 'regional_manager' role** to existing admin/customer structure

### 4. ✅ Status Workflow - SIMPLIFIED
**Confirmed Flow:**
```
pending → submitted → admin_review → approved/rejected → applied_to_plan
```

- **Regional managers can edit** amendments before submission
- **Bulk approvals** supported for admin efficiency  
- **No time limits** on approval processes initially

### 5. ✅ Data Synchronization - RESOLVED
- **Approved amendments update original weekly_plan records**
- **Full audit trail maintained** in amendments table
- **Real-time processing** of individual amendments
- **Approved amendments modify existing weekly_plan.add_ons_qty** field

### 6. ✅ UI/UX Approach - DEFINED
- **Interface similar to current cart system** for consistency
- **Category-based data loading** for performance with large datasets
- **Desktop-focused interface** (mobile can be added later)
- **Filtering/search capabilities** included

## ✅ CONFIRMED Technical Implementation

### 1. ✅ Database Structure - DECIDED
**Selected:** Separate amendments table (Option A)
- ✅ Full audit trail maintained
- ✅ Track multiple amendments per item
- ✅ Complex queries acceptable for audit capability

### 2. ✅ Mattress/Base Logic - DECIDED  
**Approach:** Mirror exact cart logic
- ✅ Reuse existing cart logic from `/src/components/cart/cart-provider.tsx`
- ✅ Apply same quantity synchronization rules
- ✅ Handle edge cases for partial base requirements

### 3. ✅ Performance - DECIDED
**Strategy:** Category-based data loading + Server-side filtering
- ✅ Category-based data loading for large datasets
- ✅ Server-side filtering and search
- ✅ Pagination where needed
- ✅ Caching for weekly plan data

### 4. ✅ Permissions - DECIDED
**Model:** Role-based access
- ✅ Regional managers see all categories for their stores
- ✅ Store-specific data isolation via RLS
- ✅ Admin override capabilities for all data

## Related Files and Components

### Current Weekly Plans System:
- `/src/pages/admin/weekly-plan.tsx` - Main management dashboard
- `/src/components/admin/weekly-plan-upload.tsx` - Upload component
- `/src/types/weekly-plan.ts` - TypeScript definitions
- `/supabase/migrations/20250706_create_weekly_plan_table.sql` - Database schema

### Mattress/Base Rules System:
- `/src/components/cart/cart-provider.tsx` - Core cart logic with mattress/base rules
- `/src/components/cart/cart-sheet.tsx` - Cart display and checkout
- `/src/lib/product-utils.ts` - Product utilities and base lookup functions
- `/src/types/product.ts` - Product type definitions
- `/src/pages/mattresses/index.tsx` - Mattress catalog with base inclusion

### User Management:
- `/supabase/migrations/20250306195346_floating_tooth.sql` - User table with roles
- Current roles: 'admin', 'customer'
- RLS policies for role-based access

## Next Steps

1. **Finalize Store Assignment Strategy** - Decide on store grouping approach
2. **Design Database Schema** - Create detailed schema for new tables
3. **Define Approval Workflow** - Establish status transitions and business rules
4. **Plan UI Components** - Design store user interface with category tabs
5. **Integration Planning** - How to integrate with existing mattress/base rules

## 🔄 UPDATED MULTI-LEVEL HIERARCHY REQUIREMENTS (2025-07-15)

### CORRECTED 4-Level Hierarchy Structure with Proper Relationships:
1. **Store Manager** - Individual store credentials (lowest level)
2. **Area Manager** - Manages subset of stores (**1:many AM→Stores**)
3. **Regional Manager** - Manages area managers (**1:many RM→AM**)
4. **Admin** - Top level with full access

### Relationship Model:
- **Regional Manager** → **Area Managers** (1:many)
- **Area Manager** → **Stores** (1:many)  
- **Store Manager** → **Store** (1:1)

### Key Design Decisions:

#### A. Amendment Approval Workflow - HYBRID APPROACH:
- **Store Manager amendments** → Require Area Manager approval
- **Area Manager direct amendments** → Go straight to final plan (no approval needed)
- **Regional Manager direct amendments** → Go straight to final plan (no approval needed)
- **Admin amendments** → Direct edit capability (immediate save)

#### B. Deadline Management - DASHBOARD DRIVEN:
- **No strict system deadlines**
- **Manual process management** through dashboards
- Each level has visibility dashboards showing:
  - Who has submitted
  - Who has pending work
  - Amendment status tracking

#### C. Data Visibility - FULL ACCESS WITH SUMMARIES:
- **All levels see all store data**
- **Role-appropriate summaries and dashboards**:
  - Store Manager: Own store focus
  - Area Manager: Area summary + store details
  - Regional Manager: Regional summary + area breakdowns
  - Admin: Full organizational view

#### D. Upload Structure - SEPARATE MANAGEMENT LEVELS:
- **Store Master Upload**: Code, Name, Region, Store Size (optional), Email (optional)
- **Area Manager Assignment Upload**: Area managers assigned to stores
- **Regional Manager Assignment Upload**: Regional managers assigned to area managers
- **Direct Regional-Store Assignment**: When no area manager exists
- **Validation Dashboards**:
  - Unassigned stores (no area manager)
  - Unassigned area managers (no regional manager)

#### E. Enhanced User Creation Process:
- **Auto-user creation from Excel uploads**
- **Required fields**: First Name, Last Name, Email
- **Optional fields**: Contact Number
- **Password Pattern**: `[LastName]2024!` (e.g., Smith2024!, Johnson2024!)
- **Follows existing manual user setup process** in `/src/lib/clerk-admin.ts`

#### F. Additional Requirements:
- **Mandatory Store Submission**: Store managers MUST submit even with no amendments
- **Visibility of Submissions**: Area/Regional managers see submission status
- **Auto-escalation**: Stores without area managers go directly to regional manager
- **Data Caching**: Load all store data on login for performance
- **Comprehensive Validation**: All suggested validation dashboards implemented

### Updated Database Schema Requirements:

1. **Enhanced `users` table** - Add area_manager role:
   ```sql
   -- Modify role check to include:
   role VARCHAR(20) CHECK (role IN ('admin', 'regional_manager', 'area_manager', 'store_manager', 'customer'))
   ```

2. **Enhanced `stores` table** - Add size field:
   ```sql
   store_size VARCHAR(50), -- small, medium, large, etc.
   ```

3. **New `area_manager_store_assignments` table**:
   ```sql
   CREATE TABLE area_manager_store_assignments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     area_manager_id UUID REFERENCES users(id) ON DELETE CASCADE,
     store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
     assigned_by UUID REFERENCES users(id),
     assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     active BOOLEAN DEFAULT true,
     UNIQUE(area_manager_id, store_id)
   );
   ```

4. **New `regional_area_manager_assignments` table**:
   ```sql
   CREATE TABLE regional_area_manager_assignments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     regional_manager_id UUID REFERENCES users(id) ON DELETE CASCADE,
     area_manager_id UUID REFERENCES users(id) ON DELETE CASCADE,
     assigned_by UUID REFERENCES users(id),
     assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     active BOOLEAN DEFAULT true,
     UNIQUE(regional_manager_id, area_manager_id)
   );
   ```

5. **Enhanced `weekly_plan_amendments` table** - Track submission status:
   ```sql
   -- Add fields:
   submitted_by_role VARCHAR(20), -- 'store_manager', 'area_manager', etc.
   is_no_change_submission BOOLEAN DEFAULT false, -- For mandatory submissions with no changes
   approved_by_role VARCHAR(20), -- Track who approved (area_manager, regional_manager, admin)
   ```

## 📋 UPDATED IMPLEMENTATION ROADMAP

### Phase 1: Database Schema & User Role Setup
1. ✅ Add 'regional_manager' role to users table
2. 🔄 Add 'area_manager' and 'store_manager' roles
3. 🔄 Create enhanced stores table with size field
4. 🔄 Create area/regional assignment tables
5. 🔄 Update weekly_plan_amendments for multi-level tracking
6. 🔄 Setup RLS policies for all role levels
7. 🔄 Create indexes for performance

### Phase 2: Enhanced Excel Upload Infrastructure  
1. 🔄 Store master upload with size field (`/admin/stores-upload`)
2. 🔄 Category master upload (`/admin/categories-upload`) 
3. 🔄 Area manager store assignments upload
4. 🔄 Regional manager area assignments upload
5. 🔄 Auto-user creation with password pattern
6. 🔄 Validation dashboards for unassigned entities
7. 🔄 Bulk user creation from Excel

### Phase 3: Week Management System
1. ✅ Week selection interface for all levels
2. ✅ Current week designation functionality
3. ✅ Week activation/deactivation controls
4. 🔄 Mandatory submission tracking

### Phase 4: Multi-Level User Interfaces
1. 🔄 Store Manager Interface:
   - Own store view only
   - Mandatory submission process
   - Amendment entry
   - No-change submission option
2. 🔄 Area Manager Interface:
   - Area summary dashboard
   - Store submission status
   - Direct amendment capability
   - Approval queue for store amendments
3. 🔄 Regional Manager Interface:
   - Regional summary dashboard
   - Area performance tracking
   - Direct store management (where no area manager)
   - Override capabilities
4. 🔄 Enhanced Admin Interface:
   - Full organizational dashboard
   - All validation views
   - Direct edit capability

### Phase 5: Approval Workflow Implementation
1. 🔄 Store → Area approval flow
2. 🔄 Direct amendment processing (area/regional)
3. 🔄 Auto-escalation for unassigned stores
4. 🔄 Submission status tracking
5. 🔄 Dashboard-driven deadline management

### Phase 6: Integration & Testing
1. 🔄 Integration with existing weekly plan system
2. 🔄 Performance optimization with data caching
3. 🔄 Multi-level hierarchy testing
4. 🔄 Validation dashboard testing
5. 🔄 User acceptance testing for all levels

---

## 📋 IMPLEMENTATION PROGRESS UPDATE (2025-07-16)

### ✅ COMPLETED - Multi-Level Hierarchy System
- **4-Level Hierarchy**: Admin → Regional Manager → Area Manager → Store Manager ✅
- **Excel Upload Infrastructure**: Working end-to-end with comprehensive error handling ✅
- **User Creation**: All management levels with generated emails and proper assignments ✅
- **Assignment Tables**: All populated correctly with proper duplicate handling ✅
- **Database Schema**: Fixed constraints and relationships, updated store_management_hierarchy view ✅
- **Data Integrity**: All assignment types working (regional→area→store relationships) ✅

### ✅ COMPLETED - Week Management System (Phase 3)
- **Week Selection Interface**: WeekSelector component for all user levels ✅
- **Current Week Designation**: System tracks and displays current week ✅
- **Week Activation/Deactivation**: Toggle controls for amendment availability ✅
- **Week Management Dashboard**: Admin interface for week management ✅
- **React Hook**: useWeekManagement hook for state management ✅
- **Role-Based Access**: Users see only weeks they can access ✅

### 🔄 NEXT PHASE - Multi-Level User Interfaces (Phase 4)
Ready to implement role-specific dashboard interfaces:
- Store Manager Interface (own store view only)
- Area Manager Interface (area summary + store approval)
- Regional Manager Interface (regional summary + override capabilities)
- Enhanced Admin Interface (full organizational dashboard)

---

**Status:** 📝 Multi-level hierarchy COMPLETE, Week Management COMPLETE, ready for Phase 4 implementation.
**Next Action:** Implement role-specific user interfaces for amendment management.
**Key Updates:** Week Management System fully functional with role-based access control.