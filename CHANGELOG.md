# github-prs

## 1.3.0

### Minor Changes

- [`41f6ae3`](https://github.com/cevr/github-prs/commit/41f6ae36cb65991f00b6f57c7a0605de56156b62) Thanks [@cevr](https://github.com/cevr)! - Show stacked pull requests together. A pull request whose base branch is another's branch in the same repository joins its stack. Each stack is its own section, ahead of the status sections. Its heading shows the title of the stack's first pull request, the repository, how many pull requests it holds, the branch it merges into, and how many are at each status. Its members follow, top first, on a line through each one's status. Click the heading to fold the stack; the panel remembers it. The stack with the most urgent member comes first.

### Patch Changes

- [`c01276c`](https://github.com/cevr/github-prs/commit/c01276c1704eb179f44280ec6ad9b3c1fa85bb7f) Thanks [@cevr](https://github.com/cevr)! - Refresh pull requests each time the side panel opens. The saved list shows at once while the refresh runs.

- [`dcce664`](https://github.com/cevr/github-prs/commit/dcce66472e6f1688f9ddd3da42075a2814fa4d97) Thanks [@cevr](https://github.com/cevr)! - Refresh pull requests as soon as the extension is installed or updated, so new details such as stacks appear without waiting for the next scheduled refresh.

## 1.2.0

### Minor Changes

- [`cd5c9b8`](https://github.com/cevr/github-prs/commit/cd5c9b82efbea37ffa2b05f599cc616bddc68656) Thanks [@cevr](https://github.com/cevr)! - Fold any section by clicking its heading, in both tabs. The panel remembers folded sections, and a folded section keeps a blue dot while it hides unseen activity. Your own comments no longer show as new comments.

- [`ac0beb7`](https://github.com/cevr/github-prs/commit/ac0beb7a5a0a43d0852378ae7558d6213f5182ef) Thanks [@cevr](https://github.com/cevr)! - Remove the new-tab dashboard. New tabs open Chrome's own page again; the tracker lives in the side panel.

- [`8e610d8`](https://github.com/cevr/github-prs/commit/8e610d8f6ac97b0f5feccdee3ba3453d97859dcc) Thanks [@cevr](https://github.com/cevr)! - Order pull requests by review status. Your pull requests are grouped as changes requested, approved, reviewed, awaiting review and drafts; review requests as needing your review, reviewed by you and drafts, newest activity first within each group. Your own pull requests no longer appear under review requests, even when they are assigned to you. Pull requests load through one GitHub GraphQL search per list, which also reads the latest reviews of busy pull requests correctly. Seen state starts over once after the update.

- [`915fede`](https://github.com/cevr/github-prs/commit/915fede2ba00ea4cea0c69c27fe2e8bca29108c3) Thanks [@cevr](https://github.com/cevr)! - Redesign the side panel. Each status group has GitHub's own icon, and each pull request shows its reviewers' profile pictures ringed by their verdict, with a dashed ring for reviews still owed. Review requests show who opened them, mark a review asked for again, and show your own verdict once given. Merge conflicts and new comments are flagged. The side panel and settings follow the system's light or dark mode, and the arrow keys move between tabs.

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
