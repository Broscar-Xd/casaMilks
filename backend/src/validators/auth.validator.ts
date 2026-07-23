import { z } from 'zod';

/** Esquema de inicio de sesión. Nombre de usuario y contraseña. */
export const loginSchema = z.object({
  name: z.string().min(1, 'Nombre de usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

/** Esquema para crear un nuevo usuario. */
export const createUserSchema = z.object({
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['ADMIN', 'STAFF']).optional(),
  branchId: z.string().uuid().optional().nullable(),
});

/** Esquema para actualizar un usuario existente. */
export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  active: z.boolean().optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
