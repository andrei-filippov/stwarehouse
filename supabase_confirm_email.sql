-- Confirm user email manually
-- Replace with actual email
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email = 'your-email@example.com';

-- Verify it worked
SELECT email, email_confirmed_at, confirmed_at 
FROM auth.users 
WHERE email = 'your-email@example.com';
