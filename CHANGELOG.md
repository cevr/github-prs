# github-prs

## 1.1.0

### Minor Changes

- [`8b9d529`](https://github.com/cevr/github-prs/commit/8b9d5292722b9c424917e7eead8659bb77b929de) Thanks [@cevr](https://github.com/cevr)! - Show review status and comment activity for tracked pull requests. Pull request rows now surface approved, changes-requested, reviewed, or awaiting-review state together with the latest commenter and a new-comment indicator.

### Patch Changes

- [`ac960aa`](https://github.com/cevr/github-prs/commit/ac960aad7e43b5b889380af9169d7800a65193b7) Thanks [@cevr](https://github.com/cevr)! - Compute the inactive pull-request cutoff with Effect DateTime. The one-month
  cutoff now uses UTC calendar math with end-of-month clamping instead of
  local-time `Date#setMonth` overflow, so the boundary can shift by a few days
  around month ends.

## 1.0.3

### Patch Changes

- [`3445096`](https://github.com/cevr/github-prs/commit/34450962504dec175ddd50cafb2afbe25bf0a096) Thanks [@cevr](https://github.com/cevr)! - Recover interrupted and legacy cached synchronization state, preserve local snapshots during
  refresh failures, and stop mark-seen actions from issuing redundant GitHub requests.
