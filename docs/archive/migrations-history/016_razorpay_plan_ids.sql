-- ============================================
-- ADD: Razorpay plan ID columns for caching
-- Migration: 016_razorpay_plan_ids
-- ============================================

ALTER TABLE plans ADD COLUMN IF NOT EXISTS razorpay_plan_id_monthly TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS razorpay_plan_id_yearly TEXT;
