import { Router } from 'express';
import { signatureController } from '../controllers/signature.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const signatureSchema = z.object({
  p12Base64: z.string().min(10, 'Archivo de firma requerido (base64)'),
  password: z.string().min(1, 'Clave de la firma requerida'),
  label: z.string().optional(),
});

export const signatureRoutes = Router();

signatureRoutes.use(authenticate, authorize('ADMIN'));

signatureRoutes.get('/:branchId', signatureController.get);
signatureRoutes.put('/:branchId', validate(signatureSchema), signatureController.upsert);
