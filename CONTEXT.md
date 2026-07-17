# GitHub PR Tracker

GitHub PR Tracker keeps a developer's authored and review-requested pull requests visible across browser surfaces.

## Language

**PR Snapshot**:
A coherent view of tracked pull requests, their seen state, and the latest synchronization result shared by every tracker surface.
_Avoid_: PR data, cache

**PR Collection**:
An ordered, repository-grouped view of pull requests prepared for quick scanning, including which entries need attention.
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
