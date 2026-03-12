-- Fix email confirmation issues
-- Option 1: Confirm specific user email manually
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email = 'user@example.com';  -- ЗАМЕНИ на реальный email

-- Option 2: List unconfirmed users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;

-- Option 3: Confirm all users (use with caution!)
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW(),
--     confirmed_at = NOW()
-- WHERE email_confirmed_at IS NULL;
