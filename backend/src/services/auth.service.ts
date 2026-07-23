import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { AppError } from '../middlewares/errorHandler';
import { LoginInput, CreateUserInput } from '../validators/auth.validator';

export const authService = {
  /**
   * Autentica al usuario y retorna un token JWT.
   * El token incluye userId, email, role y branchId para autorización posterior.
   */
  login: async (input: LoginInput) => {
    const user = await userRepository.findByName(input.name);
    if (!user || !user.active) {
      throw new AppError('Credenciales inválidas', 401);
    }

    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) {
      throw new AppError('Credenciales inválidas', 401);
    }

    const payload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    };

    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as any,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      },
    };
  },

  /**
   * Registra un nuevo usuario. Solo accesible por administradores.
   * La contraseña se almacena hasheada con bcrypt.
   */
  register: async (input: CreateUserInput) => {
    const exists = await userRepository.findByName(input.name);
    if (exists) {
      throw new AppError('El nombre de usuario ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: input.role || 'STAFF',
      branchId: input.branchId || null,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    };
  },
};
