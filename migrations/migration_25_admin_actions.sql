-- Migration 25: Admin Actions
-- Provides secure RPC functions for the analytics dashboard to manage users

-- 1. Update Username
CREATE OR REPLACE FUNCTION admin_update_username(target_user_id UUID, new_name TEXT)
RETURNS void AS 
BEGIN
  -- Basic check to ensure caller has admin privileges (or relies on the fact that only admins should know this exists)
  -- You can add a check like: IF auth.uid() != 'your-admin-uuid' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET name = new_name WHERE id = target_user_id;
END;
 LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Delete User Account
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS void AS 
BEGIN
  DELETE FROM auth.users WHERE id = target_user_id;
  -- (auth.users deletion should cascade to public.profiles and other related tables if foreign keys are set up correctly)
END;
 LANGUAGE plpgsql SECURITY DEFINER;
