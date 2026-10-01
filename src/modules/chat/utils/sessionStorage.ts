/**
 * Utilities for managing session data in localStorage.
 *
 * This is a client-side cache for UI state that persists between page refreshes.
 * The backend is the source of truth for actual session data.
 */

import { SessionSlot } from '@/modules/chat/hooks/useSessionStore';
import { NormalizedMessage } from '@/shared/types';

// Key prefix for session storage, scoped by user
const STORAGE_KEY_PREFIX = 'cloudcli-session-cache';

// Maximum age for cached sessions (1 hour)
const MAX_CACHE_AGE_MS = 60 * 60 * 1000;

// Helper to get the localStorage key for a specific session
export function getSessionStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}-${sessionId}`;
}

// Helper to get a scoped localStorage key for the current user
export function getScopedStorageKey(sessionId: string): string {
  const authToken = localStorage.getItem('auth-token');
  const userId = authToken ? extractUserIdFromToken(authToken) : 'anonymous';
  return `${STORAGE_KEY_PREFIX}-${userId}-${sessionId}`;
}

// Debug function to check what's in localStorage
export function debugLocalStorageSessions(): void {
  try {
    console.log('=== DEBUG: localStorage sessions ===');
    let found = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        console.log(`Found key: ${key}`);
        found = true;
      }
    }
    if (!found) {
      console.log('No session cache found in localStorage');
    }
    console.log('====================================');
  } catch (error) {
    console.error('Error debugging localStorage:', error);
  }
}

// Extract user ID from JWT token (second part of the token)
function extractUserIdFromToken(token: string): string {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 'unknown';

    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(decoded);
    return claims.sub || claims.userId || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Helper to safely parse JSON from localStorage
export function safeParseJSON<T>(jsonString: string | null): T | null {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

// Helper to safely stringify data for localStorage
export function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return '{}';
  }
}

// Serialize a SessionSlot for storage
export function serializeSessionSlot(slot: SessionSlot): string {
  // Remove non-serializable properties
  const serializableSlot = {
    serverMessages: slot.serverMessages,
    realtimeMessages: slot.realtimeMessages,
    merged: slot.merged,
    status: slot.status,
    fetchedAt: slot.fetchedAt,
    total: slot.total,
    hasMore: slot.hasMore,
    offset: slot.offset,
    tokenUsage: slot.tokenUsage,
  };

  return safeStringify(serializableSlot);
}

// Deserialize a SessionSlot from storage
export function deserializeSessionSlot(data: string): SessionSlot | null {
  const parsed = safeParseJSON<Partial<SessionSlot>>(data);
  if (!parsed) return null;

  // Ensure required fields exist
  return {
    serverMessages: Array.isArray(parsed.serverMessages) ? parsed.serverMessages : [],
    realtimeMessages: Array.isArray(parsed.realtimeMessages) ? parsed.realtimeMessages : [],
    merged: Array.isArray(parsed.merged) ? parsed.merged : [],
    _lastServerRef: [],
    _lastRealtimeRef: [],
    _historyMutationQueue: Promise.resolve(),
    status: parsed.status || 'idle',
    fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0,
    total: typeof parsed.total === 'number' ? parsed.total : 0,
    hasMore: Boolean(parsed.hasMore),
    offset: typeof parsed.offset === 'number' ? parsed.offset : 0,
    tokenUsage: parsed.tokenUsage,
  };
}

// Check if cached session is still valid
export function isSessionCacheValid(cachedAt: number): boolean {
  return Date.now() - cachedAt < MAX_CACHE_AGE_MS;
}

// Clear expired sessions from localStorage
export function clearExpiredSessions(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = safeParseJSON<{ cachedAt: number }>(item);
          if (parsed && parsed.cachedAt && !isSessionCacheValid(parsed.cachedAt)) {
            keysToRemove.push(key);
          }
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    // Silently ignore errors in cleanup
  }
}

// Hydrate the session store from localStorage
export function hydrateSessionStoreFromStorage(): Map<string, SessionSlot> {
  const store = new Map<string, SessionSlot>();

  try {
    // Clear expired sessions first
    clearExpiredSessions();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX) && !key.includes('auth-token')) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = safeParseJSON<{ sessionId: string; data: string; cachedAt: number }>(item);
          if (parsed && parsed.sessionId && parsed.data) {
            const slot = deserializeSessionSlot(parsed.data);
            if (slot) {
              store.set(parsed.sessionId, slot);
            }
          }
        }
      }
    }
  } catch (error) {
    // Silently ignore errors during hydration
  }

  return store;
}

// Save session data to localStorage
export function saveSessionToStorage(sessionId: string, slot: SessionSlot): void {
  try {
    const data = serializeSessionSlot(slot);
    const storageKey = getScopedStorageKey(sessionId);
    const item = {
      sessionId,
      data,
      cachedAt: Date.now(),
    };

    localStorage.setItem(storageKey, safeStringify(item));
  } catch (error) {
    // Silently ignore errors in storage
  }
}

// Remove session data from localStorage
export function removeSessionFromStorage(sessionId: string): void {
  try {
    const storageKey = getScopedStorageKey(sessionId);
    localStorage.removeItem(storageKey);
  } catch (error) {
    // Silently ignore errors
  }
}