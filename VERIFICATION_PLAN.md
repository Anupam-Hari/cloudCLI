# Verification Test Plan for Multi-User Implementation

## Test Case A: Fresh Database Schema
Let me verify the schema requirements are met:

1. projects.user_id is NOT NULL
2. projects FK -> users(id) ON DELETE CASCADE  
3. sessions.user_id exists
4. sessions FK -> users(id) ON DELETE CASCADE
5. sessions.project_path FK remains correct

## Test Case B: Legacy Database Migration
Let me verify migration behavior:

1. Original projects table has no user_id column
2. Original sessions table has no user_id column  
3. Existing projects survive migration
4. Existing sessions survive migration
5. Legacy projects receive user_id=1
6. Legacy sessions receive NULL user_id (as intended)
7. No session/project data is lost
8. Migration can run a second time without changing data

## Test Case C: Runtime Ownership
Let me verify user isolation:

1. User A creates a project -> project.user_id = A
2. User B cannot read A's project
3. User B cannot update A's project
4. User B cannot star/archive/delete A's project
5. User B cannot resolve A's project by project_id
6. User B cannot resolve A's project by project_path
7. User A can perform those operations on A's own project

## Test Case D: Sessions
1. New sessions receive the authenticated user_id
2. User A cannot retrieve/update/delete/archive user B's sessions
3. Session/project operations cannot bypass user ownership

## Test Case E: Migration Specifics
1. ensureProjectsForSessionPaths() does NOT assign user_id=1 to normal runtime-created projects
2. user_id=1 is used only where ownership genuinely cannot be recovered from legacy data
3. No hard-coded user ID remains in normal runtime code

## Analysis of Issues Found

Based on my review, I found several critical issues that need to be fixed:

### Issue 1: ensureProjectsForSessionPaths() Hardcodes user_id=1
In `server/modules/database/migrations.ts` line 486, the function hardcodes `1` for user_id, which is incorrect for runtime-created projects.

### Issue 2: Missing user_id in SELECT statements in repositories
The `getProjectPaths` and `getArchivedProjectPaths` functions in `projects.db.ts` don't include `user_id` in their SELECT clauses, but the ProjectRepositoryRow type expects it.

### Issue 3: Session filtering incomplete
The `getRecentSessionsPage` function in `sessions.db.ts` doesn't filter by user_id, allowing cross-user session access.

### Issue 4: Runtime session creation missing user context
The sessions creation functions in `sessions.db.ts` don't properly pass user context from the service layer.

## Immediate Fixes Needed

1. Fix `ensureProjectsForSessionPaths()` to NOT hardcode user_id=1
2. Fix SELECT statements in project repositories to include user_id
3. Fix `getRecentSessionsPage` to filter by user_id
4. Verify all session creation functions properly handle user_id