---
"github-prs": patch
---

Compute the inactive pull-request cutoff with Effect DateTime. The one-month
cutoff now uses UTC calendar math with end-of-month clamping instead of
local-time `Date#setMonth` overflow, so the boundary can shift by a few days
around month ends.
