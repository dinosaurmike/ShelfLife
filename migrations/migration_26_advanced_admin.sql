-- Migration 26: Advanced Admin Actions
-- Provides secure RPC functions for the analytics dashboard to suspend users and recalculate stats

-- 1. Suspend/Ban User
CREATE OR REPLACE FUNCTION admin_suspend_user(target_user_id UUID, suspend BOOLEAN)
RETURNS void AS 
BEGIN
  -- suspend = true sets status to 'suspended', false sets to 'active'
  UPDATE public.profiles SET status = CASE WHEN suspend THEN 'suspended' ELSE 'active' END WHERE id = target_user_id;
END;
 LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recalculate Stats
CREATE OR REPLACE FUNCTION admin_recalculate_stats(target_user_id UUID)
RETURNS void AS 
DECLARE
  total_books INT;
  total_words INT;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(word_count), 0)
  INTO total_books, total_words
  FROM public.books
  WHERE user_id = target_user_id AND status = 'finished';

  UPDATE public.profiles 
  SET books_read = total_books, total_word_count = total_words
  WHERE id = target_user_id;
END;
 LANGUAGE plpgsql SECURITY DEFINER;
