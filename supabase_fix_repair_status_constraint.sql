-- Fix equipment_repairs status constraint to allow 'returned' status
-- Run this in Supabase SQL Editor

-- First, check current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'equipment_repairs'::regclass;

-- Drop existing status check constraint if exists
ALTER TABLE equipment_repairs 
DROP CONSTRAINT IF EXISTS equipment_repairs_status_check;

-- Add new constraint with all allowed statuses
ALTER TABLE equipment_repairs 
ADD CONSTRAINT equipment_repairs_status_check 
CHECK (status IN ('in_repair', 'repaired', 'written_off', 'returned'));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'equipment_repairs'::regclass;
