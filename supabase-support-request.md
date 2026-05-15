Subject: Request to unblock organization - critical bug fix deployed

Hi Supabase Support Team,

My organization (andrei-filippov's Org, project: stwarehouse) was blocked due to exceeding the egress quota. I want to explain the situation and request temporary reactivation.

What happened:
- We migrated our frontend to Yandex Cloud (Russia) due to Supabase being temporarily blocked in Russia
- To compensate for the lack of WebSocket/Realtime support through the proxy, we added polling as a fallback
- Unfortunately, the polling interval was set to 5 seconds instead of 60+ seconds
- This caused a massive spike in database requests (158k+ per day) and egress usage (25+ GB/day)
- The grace period ended on May 14, and our organization is now blocked

What we have fixed (deployed on May 13-14):
1. Reduced polling intervals from 5 seconds to 60 seconds
2. Added 2-minute query caching to prevent redundant fetches
3. Added document.hidden check to block ALL background requests when tab is not active
4. Disabled night-time polling (23:00-08:00)
5. Fixed N+1 query problem (was making 20+ requests per poll, now 1-2)
6. Added force-reload mechanism so all users get the fixed code immediately
7. Completely disabled autoRefreshToken to prevent background auth requests

Expected traffic after fixes:
- Before: ~25 GB/day, ~158k requests/day
- After: ~200-500 MB/day, ~2-5k requests/day

We are a small warehouse management app for event equipment rental. We have only 5 active users. The high traffic was entirely caused by the polling bug, not by actual usage.

Request:
Please temporarily unblock our organization for 48 hours so we can verify the fixes are working. We are confident the egress will drop to well under the 5GB free tier limit.

If the traffic does not normalize within 48 hours, we will immediately upgrade to Pro or migrate away.

Thank you for your understanding!

Project: stwarehouse
Organization: andrei-filippov's Org
Email: [your email]
