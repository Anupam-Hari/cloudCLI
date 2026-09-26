import express from 'express';
import type { RequestHandler } from 'express';

import type { createAuthService } from './auth.service.js';
import { AppError } from '@/shared/utils.js';

type AuthenticatedRequest = express.Request & { user?: unknown };

/**
 * Creates the Auth transport adapter. Handlers only parse request data and
 * delegate authentication behavior to the injected application service.
 */
export function createAuthRouter(
  service: ReturnType<typeof createAuthService>,
  authenticateToken: RequestHandler,
): express.Router {
  const router = express.Router();

  router.get('/status', (_req, res, next) => {
    try {
      res.json(service.getStatus());
    } catch (error) {
      next(error);
    }
  });

  router.post('/register', async (req, res, next) => {
    try {
      const body = req.body as { username?: unknown; password?: unknown };
      res.json(await service.register(body.username, body.password));
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const body = req.body as { username?: unknown; password?: unknown };
      res.json(await service.login(body.username, body.password));
    } catch (error) {
      next(error);
    }
  });

  router.get('/user', authenticateToken, (req, res) => {
    res.json(service.getCurrentUser((req as AuthenticatedRequest).user));
  });

  router.post('/refresh', authenticateToken, (req, res) => {
    res.json(service.refreshSession((req as AuthenticatedRequest).user));
  });

  router.post('/logout', authenticateToken, (_req, res) => {
    res.json(service.logout());
  });

    router.get('/admin/users', authenticateToken, (req, res, next) => {
    try {
      res.json(
        service.listUsers((req as AuthenticatedRequest).user)
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch('/admin/users/:userId/approval', authenticateToken, (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      const body = req.body as {
        approvalStatus?: unknown;
      };

      if (!Number.isInteger(userId) || userId <= 0) {
        throw new AppError('Invalid user ID', {
          code: 'AUTH_INVALID_USER_ID',
          statusCode: 400,
        });
      }

      if (
        body.approvalStatus !== 'pending'
        && body.approvalStatus !== 'approved'
        && body.approvalStatus !== 'rejected'
      ) {
        throw new AppError('Invalid approval status', {
          code: 'AUTH_INVALID_APPROVAL_STATUS',
          statusCode: 400,
        });
      }

      res.json(
        service.updateUserApproval(
          (req as AuthenticatedRequest).user,
          userId,
          body.approvalStatus
        )
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
