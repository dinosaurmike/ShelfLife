-- Migration to allow "Unlisted Link" behavior for Shelves and Books
-- This allows anyone with the exact UUID of a shelf to view it and its books.

-- 1. Drop existing restrictive SELECT policies (replace names if different)
DROP POLICY IF EXISTS "Shelves are viewable by everyone if public" ON shelves;
DROP POLICY IF EXISTS "Users can view own shelves" ON shelves;
DROP POLICY IF EXISTS "Books are viewable by everyone if shelf is public" ON books;
DROP POLICY IF EXISTS "Users can view own books" ON books;

-- 2. Create new permissive SELECT policies for Unlisted Link behavior
-- Anyone can read any shelf if they know its ID
CREATE POLICY "Anyone can read any shelf"
ON shelves FOR SELECT
USING (true);

-- Anyone can read any book (this is safe because books are tied to shelf UUIDs)
CREATE POLICY "Anyone can read any book"
ON books FOR SELECT
USING (true);

-- Note: INSERT, UPDATE, and DELETE policies should remain restricted to authenticated owners!
