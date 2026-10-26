# GitHub PR Tracker

GitHub PR Tracker keeps a developer's authored and review-requested pull requests visible across browser surfaces.

## Language

**PR Snapshot**:
A coherent view of tracked pull requests, their seen state, and the latest synchronization result shared by every tracker surface.
_Avoid_: PR data, cache

**PR Collection**:
One perspective's pull requests in sections by stage, the user's next move first and newest activity first within a stage, including which entries need attention.

**Stack**:
Pull requests in one repository where each one's base branch is another's head branch, as gh-stack, Graphite and spr build them. A Stack stays together in a PR Collection, top first, in the section of its most urgent member; each member keeps its own Stage. Its header names the base branch and counts the members at each Stage.

**Perspective**:
The user's side of a pull request: its author (authored) or a reviewer (reviewing). The user's own pull requests never appear in the reviewing perspective, even when assigned to the user.

**Stage**:
Where a pull request stands from the user's perspective: changes requested, approved, reviewed, awaiting review or draft for authored work; review requested, reviewed by you or draft for review work.
_Avoid_: PR list, grouped PRs

**Tracker Settings**:
The account connection and refresh preferences that govern which pull requests the tracker keeps current.
_Avoid_: Options, config

**PR Synchronization**:
The serialized process that refreshes a PR Snapshot from GitHub and reconciles seen state and attention across tracker surfaces.
_Avoid_: Refresh, poll

**PR Snapshot Publication**:
The coherent release of a changed PR Snapshot and its attention state to every tracker surface.
_Avoid_: PR update, notification
