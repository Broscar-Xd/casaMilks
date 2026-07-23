import { userRepository } from '../repositories/user.repository';
import { AppError } from '../middlewares/errorHandler';
import { CreateUserInput, UpdateUserInput } from '../validators/auth.validator';
import bcrypt from 'bcryptjs';

export const userService = {
  list: (branchId?: string) => userRepository.list(branchId),

  getById: async (id: string) => {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('Usuario no encontrado', 404);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  create: async (input: CreateUserInput) => {
    const exists = await userRepository.findByEmail(input.email);
    if (exists) throw new AppError('El email ya está registrado');

    const hashedPassword = await bcrypt.hash(input.password, 12);
    return userRepository.create({
      ...input,
      password: hashedPassword,
      role: input.role || 'STAFF',
    });
  },

  update: async (id: string, input: UpdateUserInput) => {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('Usuario no encontrado', 404);

    const data: any = { ...input };
    if (input.password) {
      data.password = await bcrypt.hash(input.password, 12);
    }

    return userRepository.update(id, data);
  },
};
