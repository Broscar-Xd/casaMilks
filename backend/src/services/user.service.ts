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
    const exists = await userRepository.findByName(input.name);
    if (exists) throw new AppError('El nombre de usuario ya está registrado');

    const hashedPassword = await bcrypt.hash(input.password, 12);
    return userRepository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: input.role || 'STAFF',
      branchId: input.branchId || null,
    });
  },

  update: async (id: string, input: UpdateUserInput) => {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('Usuario no encontrado', 404);

    const data: any = { ...input };
    if (data.branchId === '' || data.branchId === undefined) {
      data.branchId = null;
    }
    if (input.password) {
      data.password = await bcrypt.hash(input.password, 12);
    }

    return userRepository.update(id, data);
  },
};
