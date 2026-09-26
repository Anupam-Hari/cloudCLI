import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, ShieldCheck, UserRound, X } from 'lucide-react';

import { api } from '@/shared/api';
import SettingsCard from '@/modules/settings/SettingsCard';
import SettingsSection from '@/modules/settings/SettingsSection';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

type AdminUser = {
  id: number;
  username: string;
  created_at: string;
  last_login: string | null;
  approval_status: ApprovalStatus;
};

function statusClasses(status: ApprovalStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'rejected':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }
}

function statusLabel(status: ApprovalStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminSettingsTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.auth.adminUsers();

      if (!response.ok) {
        throw new Error('Unable to load users');
      }

      const payload = await response.json();
      setUsers(Array.isArray(payload) ? payload : []);
    } catch (caughtError) {
      console.error('Failed to load admin users:', caughtError);
      setError('Unable to load users.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const updateApproval = async (
    userId: number,
    approvalStatus: ApprovalStatus,
  ) => {
    setUpdatingUserId(userId);
    setError(null);

    try {
      const response = await api.auth.updateUserApproval(userId, approvalStatus);

      if (!response.ok) {
        throw new Error('Unable to update user');
      }

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId
            ? { ...user, approval_status: approvalStatus }
            : user,
        ),
      );
    } catch (caughtError) {
      console.error('Failed to update user approval:', caughtError);
      setError('Unable to update user approval.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const pendingCount = users.filter(
    (user) => user.approval_status === 'pending',
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Administration
          </h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Manage user access and account approvals.
        </p>
      </div>

      <SettingsSection
        title="User Management"
        description="Review registered users and control access to CloudCLI."
      >
        <SettingsCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>

                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Registered users
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {users.length} user{users.length === 1 ? '' : 's'}
                    {pendingCount > 0
                      ? ` · ${pendingCount} awaiting approval`
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                No registered users.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="divide-y divide-border">
                  {users.map((user) => {
                    const isUpdating = updatingUserId === user.id;

                    return (
                      <div
                        key={user.id}
                        className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <UserRound className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {user.username}
                              </span>

                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(user.approval_status)}`}
                              >
                                {statusLabel(user.approval_status)}
                              </span>
                            </div>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Registered{' '}
                              {new Date(user.created_at).toLocaleDateString()}
                              {user.last_login
                                ? ` · Last login ${new Date(user.last_login).toLocaleDateString()}`
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {user.approval_status !== 'approved' && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                void updateApproval(user.id, 'approved')
                              }
                              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                          )}

                          {user.approval_status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                void updateApproval(user.id, 'rejected')
                              }
                              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          )}

                          {user.approval_status === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock3 className="h-3.5 w-3.5" />
                              Awaiting review
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}