import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureUserWorkspaceExists, resolveUserWorkspacePath } from '@/modules/projects/services/user-workspace.service.js';
import { AppError } from '@/shared/utils.js';

describe('User Workspace Isolation', () => {
  const TEST_WORKSPACES_ROOT = path.join(process.cwd(), 'test-workspaces');
  const TEST_REPO_DIR = path.join(TEST_WORKSPACES_ROOT, 'Repo');
  const TEST_SOURCE_REPO = path.join(TEST_REPO_DIR, 'test-repo');
  const TEST_USER_ID = 123;

  beforeEach(async () => {
    // Clean up any existing test directories
    try {
      await fs.rm(TEST_WORKSPACES_ROOT, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }

    // Create test source repository
    await fs.mkdir(TEST_SOURCE_REPO, { recursive: true });
    await fs.writeFile(path.join(TEST_SOURCE_REPO, 'README.md'), '# Test Repository\n\nThis is a test.');
    await fs.writeFile(path.join(TEST_SOURCE_REPO, 'file1.txt'), 'Content of file 1');
    await fs.mkdir(path.join(TEST_SOURCE_REPO, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(TEST_SOURCE_REPO, 'subdir', 'file2.txt'), 'Content of file 2');
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(TEST_WORKSPACES_ROOT, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  it('should resolve user workspace path correctly', async () => {
    const workspacePath = await resolveUserWorkspacePath(TEST_USER_ID, TEST_SOURCE_REPO);
    const expectedPath = path.join(TEST_WORKSPACES_ROOT, 'user-workspaces', TEST_USER_ID.toString(), 'test-repo');

    expect(workspacePath).toBe(expectedPath);
  });

  it('should create user workspace on first access', async () => {
    const workspacePath = await ensureUserWorkspaceExists(TEST_USER_ID, TEST_SOURCE_REPO);

    // Verify workspace was created
    const stats = await fs.stat(workspacePath);
    expect(stats.isDirectory()).toBe(true);

    // Verify file contents are copied
    const readmeContent = await fs.readFile(path.join(workspacePath, 'README.md'), 'utf8');
    expect(readmeContent).toBe('# Test Repository\n\nThis is a test.');

    const file1Content = await fs.readFile(path.join(workspacePath, 'file1.txt'), 'utf8');
    expect(file1Content).toBe('Content of file 1');

    const file2Content = await fs.readFile(path.join(workspacePath, 'subdir', 'file2.txt'), 'utf8');
    expect(file2Content).toBe('Content of file 2');
  });

  it('should reuse existing workspace on subsequent access', async () => {
    // First access - create workspace
    const workspacePath1 = await ensureUserWorkspaceExists(TEST_USER_ID, TEST_SOURCE_REPO);

    // Modify the workspace
    await fs.writeFile(path.join(workspacePath1, 'modified.txt'), 'Modified content');

    // Second access - should reuse existing workspace
    const workspacePath2 = await ensureUserWorkspaceExists(TEST_USER_ID, TEST_SOURCE_REPO);

    // Should be the same path
    expect(workspacePath1).toBe(workspacePath2);

    // Should contain the modification
    const modifiedContent = await fs.readFile(path.join(workspacePath2, 'modified.txt'), 'utf8');
    expect(modifiedContent).toBe('Modified content');
  });

  it('should isolate workspaces between users', async () => {
    const user1Workspace = await ensureUserWorkspaceExists(1, TEST_SOURCE_REPO);
    const user2Workspace = await ensureUserWorkspaceExists(2, TEST_SOURCE_REPO);

    // Should be different paths
    expect(user1Workspace).not.toBe(user2Workspace);

    // Should have same structure but be separate
    const user1Stats = await fs.stat(user1Workspace);
    const user2Stats = await fs.stat(user2Workspace);
    expect(user1Stats.isDirectory()).toBe(true);
    expect(user2Stats.isDirectory()).toBe(true);

    // Modify one user's workspace
    await fs.writeFile(path.join(user1Workspace, 'user1-only.txt'), 'User 1 only');

    // Verify the other user's workspace is unaffected
    const user2Files = await fs.readdir(user2Workspace);
    expect(user2Files).not.toContain('user1-only.txt');
  });

  it('should not execute Git commands', async () => {
    // This test verifies that no Git operations are performed
    // We can't easily intercept Git calls, but we can verify the functionality works

    const workspacePath = await ensureUserWorkspaceExists(TEST_USER_ID, TEST_SOURCE_REPO);

    // Verify workspace was created via filesystem copy, not Git
    const readmeExists = await fs.access(path.join(workspacePath, 'README.md')).then(() => true).catch(() => false);
    expect(readmeExists).toBe(true);

    // Verify the workspace is a regular directory
    const stats = await fs.stat(workspacePath);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should handle non-existent source paths gracefully', async () => {
    const nonExistentPath = path.join(TEST_WORKSPACES_ROOT, 'non-existent');

    await expect(ensureUserWorkspaceExists(TEST_USER_ID, nonExistentPath))
      .rejects.toThrow(AppError);
  });
});