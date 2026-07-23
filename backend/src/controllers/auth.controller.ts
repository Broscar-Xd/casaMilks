import { Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';
import { LoginInput, CreateUserInput } from '../validators/auth.validator';

export const authController = {
  login: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input: LoginInput = req.body;
      const result = await authService.login(input);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  register: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input: CreateUserInput = req.body;
      const result = await authService.register(input);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  me: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: {
          userId: req.user!.userId,
          name: req.user!.name,
          email: req.user!.email,
          role: req.user!.role,
          branchId: req.user!.branchId,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
