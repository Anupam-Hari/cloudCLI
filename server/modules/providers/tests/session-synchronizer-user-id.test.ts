import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionsDb } from '@/modules/database/index.js';
import { ClaudeSessionSynchronizer } from '@/modules/providers/list/claude/claude-session-synchronizer.provider.js';

// Mock the file system operations to avoid actual file I/O
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}));

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('@/shared/utils.js', () => ({
  buildLookupMap: vi.fn(),
  extractFirstValidJsonlData: vi.fn(),
  findFilesRecursivelyCreatedAfter: vi.fn(),
  normalizeSessionName: vi.fn().mockImplementation((name, fallback) => name || fallback),
  readFileTimestamps: vi.fn().mockResolvedValue({
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  }),
}));

describe('Session Synchronizer User ID Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preserve user_id when synchronizing existing sessions', async () => {
    // Setup: Create an app session with a user_id
    const appSessionId = 'c1914728-35c7-46b4-8e04-5479aa3ab82d';
    const providerSessionId = '59faae49-a4b9-422c-8bc3-4fd714e9b41e';
    const userId = 123;

    // Mock the database to return an existing session with user_id
    vi.spyOn(sessionsDb, 'getSessionByProviderSessionId').mockReturnValue({
      session_id: appSessionId,
      provider: 'claude',
      provider_session_id: null,
      project_path: '/test/project',
      jsonl_path: null,
      custom_name: 'Test Session',
      model: null,
      effort: null,
      forked_from_session_id: null,
      isArchived: 0,
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      user_id: userId,
    } as any);

    vi.spyOn(sessionsDb, 'getSessionById').mockReturnValue(null);

    // Mock createSession to capture the call parameters
    const createSessionSpy = vi.spyOn(sessionsDb, 'createSession').mockImplementation(
      (providerSessionId, provider, projectPath, customName, createdAt, updatedAt, jsonlPath, userId) => {
        // Verify that userId is passed through correctly
        expect(userId).toBe(123);
        return providerSessionId;
      }
    );

    const synchronizer = new ClaudeSessionSynchronizer();

    // This should pass the existing session's user_id to createSession
    const result = await synchronizer.synchronizeFile('/fake/path.jsonl');

    expect(createSessionSpy).toHaveBeenCalled();
    expect(result).toBe(providerSessionId);
  });

  it('should handle missing user_id gracefully', async () => {
    // Setup: Create an app session without user_id (should not break)
    const appSessionId = 'c1914728-35c7-46b4-8e04-5479aa3ab82d';
    const providerSessionId = '59faae49-a4b9-422c-8bc3-4fd714e9b41e';

    // Mock the database to return no existing session
    vi.spyOn(sessionsDb, 'getSessionByProviderSessionId').mockReturnValue(null);
    vi.spyOn(sessionsDb, 'getSessionById').mockReturnValue(null);

    // Mock createSession to capture the call parameters
    const createSessionSpy = vi.spyOn(sessionsDb, 'createSession').mockImplementation(
      (providerSessionId, provider, projectPath, customName, createdAt, updatedAt, jsonlPath, userId) => {
        // When no existing session, userId should be undefined
        expect(userId).toBeUndefined();
        return providerSessionId;
      }
    );

    const synchronizer = new ClaudeSessionSynchronizer();

    // This should handle missing user_id gracefully
    const result = await synchronizer.synchronizeFile('/fake/path.jsonl');

    expect(createSessionSpy).toHaveBeenCalled();
    expect(result).toBe(providerSessionId);
  });
});