import path from 'path';
import fs from 'node:fs/promises';

import { validateWorkspacePath, normalizeProjectPath, WORKSPACES_ROOT } from '@/shared/utils.js';
import { AppError } from '@/shared/utils.js';

const USER_WORKSPACES_ROOT = path.join(WORKSPACES_ROOT, 'user-workspaces');

/**
 * Resolves a source repository path to a user-specific workspace path.
 *
 * @param userId - The authenticated user ID
 * @param sourcePath - The source repository path
 * @returns The user-specific workspace path
 */
export async function resolveUserWorkspacePath(userId: number, sourcePath: string): Promise<string> {
  // Validate the source path first
  const pathValidation = await validateWorkspacePath(sourcePath);
  if (!pathValidation.valid || !pathValidation.resolvedPath) {
    throw new AppError('Invalid source path', {
      code: 'INVALID_SOURCE_PATH',
      statusCode: 400,
    });
  }

  // Normalize the source path
  const normalizedSourcePath = normalizeProjectPath(pathValidation.resolvedPath);

  // Extract the repository name from the path
  const repoName = path.basename(normalizedSourcePath);

  // Create user-specific workspace path
  const userWorkspacePath = path.join(USER_WORKSPACES_ROOT, userId.toString(), repoName);

  // Validate the user workspace path
  const userPathValidation = await validateWorkspacePath(userWorkspacePath);
  if (!userPathValidation.valid || !userPathValidation.resolvedPath) {
    throw new AppError('Invalid user workspace path', {
      code: 'INVALID_USER_WORKSPACE_PATH',
      statusCode: 400,
    });
  }

  return userPathValidation.resolvedPath;
}

/**
 * Ensures a user workspace exists for the given source path.
 * If it doesn't exist, it will be provisioned from the source.
 *
 * @param userId - The authenticated user ID
 * @param sourcePath - The source repository path
 * @returns The user workspace path
 */
export async function ensureUserWorkspaceExists(userId: number, sourcePath: string): Promise<string> {
  const userWorkspacePath = await resolveUserWorkspacePath(userId, sourcePath);

  try {
    // Check if the workspace already exists
    await fs.access(userWorkspacePath);
    return userWorkspacePath;
  } catch {
    // Workspace doesn't exist, provision it
    return await provisionUserWorkspace(userId, sourcePath, userWorkspacePath);
  }
}

/**
 * Provision a new user workspace from the source repository.
 *
 * @param userId - The authenticated user ID
 * @param sourcePath - The source repository path
 * @param userWorkspacePath - The target user workspace path
 * @returns The user workspace path
 */
async function provisionUserWorkspace(userId: number, sourcePath: string, userWorkspacePath: string): Promise<string> {
  // Ensure parent directory exists
  const parentDir = path.dirname(userWorkspacePath);
  await fs.mkdir(parentDir, { recursive: true });

  // Check if source is a Git repository
  const isGitRepo = await isGitRepository(sourcePath);

  if (isGitRepo) {
    // For Git repositories, use git clone to preserve history and remotes
    await cloneGitRepository(sourcePath, userWorkspacePath);
  } else {
    // For non-Git repositories, use filesystem copy
    await copyFileSystemRepository(sourcePath, userWorkspacePath);
  }

  return userWorkspacePath;
}

/**
 * Checks if a path is a Git repository.
 *
 * @param repoPath - The repository path to check
 * @returns True if it's a Git repository
 */
async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    const gitDirPath = path.join(repoPath, '.git');
    await fs.access(gitDirPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clone a Git repository to the user workspace.
 *
 * @param sourcePath - The source Git repository path
 * @param targetPath - The target user workspace path
 */
async function cloneGitRepository(sourcePath: string, targetPath: string): Promise<void> {
  // Import spawn from cross-spawn to avoid issues with Windows
  const spawn = (await import('cross-spawn')).default;

  return new Promise((resolve, reject) => {
    const gitProcess = spawn('git', ['clone', '--no-hardlinks', sourcePath, targetPath]);

    gitProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new AppError(`Git clone failed with code ${code}`, {
          code: 'GIT_CLONE_FAILED',
          statusCode: 500,
        }));
      }
    });

    gitProcess.on('error', (error) => {
      reject(new AppError(`Git clone error: ${error.message}`, {
        code: 'GIT_CLONE_ERROR',
        statusCode: 500,
      }));
    });
  });
}

/**
 * Copy a non-Git repository to the user workspace.
 *
 * @param sourcePath - The source repository path
 * @param targetPath - The target user workspace path
 */
async function copyFileSystemRepository(sourcePath: string, targetPath: string): Promise<void> {
  // Import fs-extra for robust file copying
  const fsExtra = await import('fs-extra');

  try {
    await fsExtra.copy(sourcePath, targetPath);
  } catch (error) {
    throw new AppError(`File system copy failed: ${error}`, {
      code: 'FILE_COPY_FAILED',
      statusCode: 500,
    });
  }
}