# User Workspace Isolation Design

## Overview

This document outlines the design for implementing user workspace isolation to ensure each user receives their own independent working copy of repositories, solving the issue where multiple users would inadvertently access the same physical repository.

## Problem Statement

Currently, the system uses globally unique `project_path` values in the database, meaning:
- User A → `/workspace/Claude_Assist/Repo/fortiaiops` 
- User B → `/workspace/Claude_Assist/Repo/fortiaiops`

Both users reference the same physical repository, causing:
1. File conflicts between users
2. Lack of proper workspace isolation
3. Security risks when users access each other's working directories

## Requirements

### Functional Requirements
1. Each user must receive an independent physical working copy of repositories
2. User A's changes must never affect User B's working tree
3. User A must only access their own working copy
4. User B must only access their own working copy
5. Repository cloning must preserve Git history, branches, and remotes when applicable
6. The system must handle concurrent provisioning safely
7. Existing projects should be migrated gracefully

### Technical Requirements
1. Server-side isolation enforcement
2. User identity must be derived from authenticated request/session, not client-provided data
3. All paths must be validated and canonicalized
4. Security measures must prevent path traversal and symlink escapes
5. Existing database schema must be maintained where possible
6. User-specific workspace root must be respected

### Security Requirements
1. Never trust client-provided user IDs
2. Derive owner from authenticated request/session
3. Prevent User A from selecting User B's workspace path
4. Validate and canonicalize all filesystem paths
5. Prevent symlink/path traversal escapes
6. Preserve existing WORKSPACES_ROOT boundary
7. Do not allow agent access to another user's workspace
8. Do not mount host Docker socket
9. Do not weaken existing project ownership checks
10. Do not solve isolation through UI-only filtering

## Proposed Solution Architecture

### High-Level Flow

1. **User Request**: User requests access to a repository (e.g., `/workspace/Claude_Assist/Repo/fortiaiops`)
2. **Path Resolution**: System maps this to user-specific workspace path (e.g., `/workspace/Claude_Assist/user-workspaces/1/fortiaiops`)
3. **Provisioning**: If user workspace doesn't exist, create it from source repository
4. **Database Update**: Store user-specific path in database while maintaining user ownership
5. **Session Creation**: Future operations use user-specific path

### Filesystem Layout

```
/workspace/Claude_Assist/
├── Repo/                    # Source repositories (read-only)
│   └── fortiaiops/
├── user-workspaces/         # User-specific workspaces (isolated)
│   ├── 1/                   # User 1's workspace
│   │   └── fortiaiops/
│   ├── 2/                   # User 2's workspace  
│   │   └── fortiaiops/
│   └── 3/                   # User 3's workspace
│       └── fortiaiops/
```

### Implementation Approach

#### 1. Workspace Path Resolution Service

Create a new service to handle user workspace path resolution:
- Maps source repository paths to user-specific workspace paths
- Ensures proper provisioning of user workspaces
- Handles concurrent access safely
- Validates all paths for security

#### 2. Modified Project Management Flow

Modify the project creation flow to:
- Use user-specific workspace paths instead of direct source paths
- Automatically provision user workspaces when needed
- Maintain backward compatibility with existing database structure

#### 3. Session and Agent Integration

Ensure sessions and agents use the user-specific workspace paths:
- Session creation routes must resolve to user workspace
- Agent working directories must point to user workspace
- Forked sessions must maintain user isolation

## Implementation Details

### Key Files to Modify

1. `server/modules/database/repositories/projects.db.ts` - Add user workspace mapping logic
2. `server/modules/projects/services/project-management.service.ts` - Implement workspace resolution
3. `server/modules/projects/services/project-clone.service.ts` - Add user workspace provisioning
4. `server/modules/projects/services/user-workspace.service.ts` - New service for workspace management
5. `server/modules/database/repositories/sessions.db.ts` - Ensure proper path resolution for sessions

### Data Flow

1. **Project Creation Request**:
   - Client sends request with source path
   - Authentication middleware provides user ID
   - Workspace service resolves to user-specific path
   - Project is created with user-specific path in DB

2. **Session Creation**:
   - Session creation uses resolved user workspace path
   - Agent execution runs in user workspace directory

3. **Workspace Provisioning**:
   - If workspace doesn't exist, provision from source
   - For Git repos: `git clone` to user workspace
   - For non-Git repos: filesystem copy

### Security Measures

1. **Path Validation**: All paths must be validated through existing `validateWorkspacePath` function
2. **User Identity**: Always derive user ID from authenticated request, never trust client
3. **Canonicalization**: All paths are normalized using `normalizeProjectPath`
4. **Workspace Root**: All operations constrained to `WORKSPACES_ROOT`
5. **Concurrency Control**: Use file locks or atomic operations for concurrent provisioning

### Migration Strategy

1. **Existing Projects**: Existing projects in database will be migrated to use user workspaces
2. **Backward Compatibility**: Existing code paths continue to work
3. **Graceful Transition**: New logic only applies to new requests or project re-creations

## Testing Approach

### Unit Tests

1. User workspace path resolution
2. Concurrent workspace provisioning
3. Path validation and security checks
4. Git vs non-Git repository handling

### Integration Tests

1. User A and B accessing same repository
2. File changes isolation between users
3. Session creation with user workspace paths
4. Forked sessions maintain isolation

### End-to-End Tests

1. Complete user workflow from project creation to session execution
2. Multi-user simultaneous access to same repository
3. File modification isolation between users
4. Agent execution in user-specific workspaces

## Risks and Mitigations

### Risk: Concurrency Issues
**Mitigation**: Use atomic operations and file locking for workspace provisioning

### Risk: Performance Impact
**Mitigation**: Cache resolved workspace paths, optimize file system operations

### Risk: Storage Overhead
**Mitigation**: Document that this is expected behavior for proper isolation

### Risk: Migration Complexity
**Mitigation**: Implement gradual migration with backward compatibility

## Success Criteria

1. User A and User B can simultaneously access the same repository without conflicts
2. Changes made by User A are not visible to User B
3. User A cannot access User B's workspace
4. User B cannot access User A's workspace
5. All security measures are enforced
6. Existing functionality remains intact
7. Performance impact is acceptable