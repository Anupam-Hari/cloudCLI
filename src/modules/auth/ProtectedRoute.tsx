import type { ReactNode } from 'react';

import { IS_PLATFORM } from '@/shared/utils';
import { useAuth } from '@/modules/auth/context/AuthContext';
import AuthLoadingScreen from '@/modules/auth/AuthLoadingScreen';
import LoginForm from '@/modules/auth/LoginForm';

type ProtectedRouteProps = {
  children: ReactNode;
};

/** Used by App to gate the routed application behind authentication. */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (IS_PLATFORM) {
    return <>{children}</>;
  }

  if (!user) {
    return <LoginForm />;
  }

  return <>{children}</>;
}