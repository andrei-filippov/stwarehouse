-- Option 1: Disable email confirmation requirement (allow login without confirmation)
-- Go to Authentication → Providers → Email
-- Turn OFF "Confirm email" toggle in UI

-- Option 2: Manually confirm all pending users
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Option 3: Check which users are unconfirmed
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;
