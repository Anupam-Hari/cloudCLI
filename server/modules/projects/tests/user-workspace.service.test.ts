import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { resolveUserWorkspacePath, ensureUserWorkspaceExists } from '@/modules/projects/services/user-workspace.service.js';
import { AppError } from '@/shared/utils.js';

describe('userWorkspaceService', () => {
  beforeEach(() => {
    // Mock environment setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should resolve user workspace path for a valid source path', async () => {
    const userId = 1;
    const sourcePath = '/workspace/Claude_Assist/Repo/fortiaiops';
    const result = await resolveUserWorkspacePath(userId, sourcePath);

    // Expected: /workspace/Claude_Assist/user-workspaces/1/fortiaiops
    assert.ok(result.startsWith('/workspace/Claude_Assist/user-workspaces/1/'));
  });

  it('should throw error for invalid source path', async () => {
    const userId = 1;
    const sourcePath = '/invalid/path';

    await assert.rejects(
      async () => await resolveUserWorkspacePath(userId, sourcePath),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        return true;
      }
    );
  });
});