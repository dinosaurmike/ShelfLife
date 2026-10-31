-- Migration 27: Add username to user_profiles
-- This ensures all users have a unique username for discovery.

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Create an index for faster lookups during search
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
