-- Migration to align order_history table with Clerk's text-based user IDs (v6)
-- This version explicitly drops all known RLS policies by name to resolve dependency errors.

-- Step 1: Drop all known RLS policies on order_history to remove dependencies.
-- This includes the policy "Users can view their own order history" which was blocking the change.
DROP POLICY IF EXISTS admin_read_all_order_history ON public.order_history;
DROP POLICY IF EXISTS user_read_own_order_history ON public.order_history;
DROP POLICY IF EXISTS "Users can view their own order history" ON public.order_history; -- Explicitly drop the blocking policy

-- Step 2: Drop the foreign key constraint on the user_id column.
-- We try to drop the constraint by its likely names to be safe.
ALTER TABLE public.order_history DROP CONSTRAINT IF EXISTS order_history_changed_by_fkey;
ALTER TABLE public.order_history DROP CONSTRAINT IF EXISTS order_history_user_id_fkey;

-- Step 3: Change the column type from UUID to TEXT to store Clerk user IDs.
-- This should now succeed as all dependencies have been dropped.
ALTER TABLE public.order_history ALTER COLUMN user_id TYPE TEXT;

-- Step 4: Update trigger functions to be compatible with the new TEXT user_id.
-- For system-generated events, user_id will be NULL.
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_history (
      order_id,
      user_id,
      change_type,
      previous_status,
      new_status,
      notes
    ) VALUES (
      NEW.id,
      NULL, -- Set to NULL as this is a system-level change
      'status_change',
      OLD.status,
      NEW.status,
      'Status changed via application trigger'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_order_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_history (
    order_id,
    user_id,
    change_type,
    new_status,
    notes
  ) VALUES (
    NEW.id,
    NULL, -- Set to NULL as this is a system-level change
    'order_created',
    NEW.status,
    'Order created via trigger'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: All RLS policies on order_history have been dropped.
-- They must be recreated to work with Clerk's authentication model.
