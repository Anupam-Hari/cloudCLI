import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

import { sessionsDb } from '@/modules/database/index.js';
import {
  extractFirstValidJsonlData,
  findFilesRecursivelyCreatedAfter,
  normalizeSessionName,
  readFileTimestamps,
} from '@/shared/utils.js';
import type { IProviderSessionSynchronizer } from '@/shared/interfaces.js';

type ParsedSession = {
  sessionId: string;
  projectPath: string;
  sessionName?: string;
};

/**
 * Returns directory entries or an empty list when the folder is missing.
 */
async function listDirectoryEntriesSafe(
  directoryPath: string
): Promise<import('node:fs').Dirent[]> {
  try {
    return await fsp.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Session indexer for Cursor transcript artifacts.
 */
export class CursorSessionSynchronizer implements IProviderSessionSynchronizer {
  private readonly provider = 'cursor' as const;
  private readonly cursorHome = path.join(os.homedir(), '.cursor');

  /**
   * Scans Cursor chats and upserts discovered sessions into DB.
   */
  async synchronize(since?: Date): Promise<number> {
    const projectsDir = path.join(this.cursorHome, 'projects');

    let processed = 0;

    const files = await findFilesRecursivelyCreatedAfter(projectsDir, '.jsonl', since ?? null);

    for (const filePath of files) {
      const parsed = await this.processSessionFile(filePath);
      if (!parsed) {
        continue;
      }

      const existingSession = sessionsDb.getSessionByProviderSessionId(parsed.sessionId);
      const timestamps = await readFileTimestamps(filePath);

      // Resolve user_id from existing session or project path
      let userId: number | undefined = undefined;

      // First, try to find an existing session with this provider session ID
      if (existingSession) {
        // Use the existing session's user_id to preserve ownership
        userId = existingSession.user_id ?? undefined;
      } else {
        // Try to derive user_id from project path structure for user workspaces
        // Note: Cursor doesn't have the same workspace structure, so we pass undefined
        userId = undefined;
      }

      sessionsDb.createSession(
        parsed.sessionId,
        this.provider,
        parsed.projectPath,
        parsed.sessionName,
        timestamps.createdAt,
        timestamps.updatedAt,
        filePath,
        userId
      );
      processed += 1;
    }

    return processed;
  }

  /**
   * Parses and upserts one Cursor session JSONL file.
   */
  async synchronizeFile(filePath: string): Promise<string | null> {
    if (!filePath.endsWith('.jsonl')) {
      return null;
    }

    const parsed = await this.processSessionFile(filePath);
    if (!parsed) {
      return null;
    }

    const timestamps = await readFileTimestamps(filePath);

    // Get the existing session to preserve user_id for the project creation
    const existingSession = sessionsDb.getSessionByProviderSessionId(parsed.sessionId);
    const userId = existingSession?.user_id ?? undefined;

    return sessionsDb.createSession(
      parsed.sessionId,
      this.provider,
      parsed.projectPath,
      parsed.sessionName,
      timestamps.createdAt,
      timestamps.updatedAt,
      filePath,
      userId
    );
  }

  /**
   * Extracts project path from Cursor worker.log.
   */
  private async extractProjectPathFromWorkerLog(filePath: string): Promise<string | null> {
    try {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const lineReader = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of lineReader) {
        const match = line.match(/workspacePath=(.*)$/);
        const projectPath = match?.[1]?.trim();
        if (projectPath) {
          lineReader.close();
          fileStream.close();
          return projectPath;
        }
      }
    } catch {
      // Missing worker logs are valid for partial or incomplete session data.
    }

    return null;
  }

  /**
   * Extracts session metadata from one Cursor JSONL session file.
   */
  private async processSessionFile(filePath: string): Promise<ParsedSession | null> {
    const sessionId = path.basename(filePath, '.jsonl');
    const grandparentDir = path.dirname(path.dirname(path.dirname(filePath)));
    const workerLogPath = path.join(grandparentDir, 'worker.log');
    const projectPath = await this.extractProjectPathFromWorkerLog(workerLogPath);

    if (!projectPath) {
      return null;
    }

    return extractFirstValidJsonlData(filePath, (rawData) => {
      const data = rawData as Record<string, any>;
      if (data.role !== 'user') {
        return null;
      }

      const text = typeof data.message?.content?.[0]?.text === 'string' ? data.message.content[0].text : '';
      // Drop Cursor's `<timestamp>…</timestamp>` prefix and `<user_query>` tags
      // so the session name comes from the actual first line the user typed.
      const firstLine = text
        .replace(/<timestamp>[\s\S]*?<\/timestamp>/g, '')
        .replace(/<\/?user_query>/g, '')
        .trim()
        .split('\n')[0];

      return {
        sessionId,
        projectPath,
        sessionName: normalizeSessionName(firstLine, 'Untitled Cursor Session'),
      };
    });
  }
}
