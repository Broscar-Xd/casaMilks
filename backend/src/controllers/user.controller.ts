import { Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { AuthenticatedRequest } from '../types';

const p = (params: Record<string, string | string[]>, key: string): string =>
  Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string);

export const userController = {
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const users = await userService.list(branchId as string | undefined);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getById(p(req.params, 'id'));
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await userService.create(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await userService.update(p(req.params, 'id'), req.body);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },
};
