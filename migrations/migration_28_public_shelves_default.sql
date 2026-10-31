-- Migration 28: Make All Shelves Public by Default
-- Sets the default value of the public column on the shelves table to TRUE,
-- and updates all existing shelves so any visitor with a link or QR code
-- can view the shelf in read-only mode without logging in.

-- 1. Ensure public column defaults to true for all newly created shelves
ALTER TABLE public.shelves 
ALTER COLUMN public SET DEFAULT true;

-- 2. Update existing shelves where public is null or false to true
UPDATE public.shelves 
SET public = true 
WHERE public IS NULL OR public = false;

-- 3. Ensure RLS allows anonymous (unauthenticated) users to read shelves where public is true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shelves' AND policyname = 'Allow public read of public shelves'
  ) THEN
    CREATE POLICY "Allow public read of public shelves" 
    ON public.shelves 
    FOR SELECT 
    USING (public = true OR auth.uid() = user_id);
  END IF;
END $$;
