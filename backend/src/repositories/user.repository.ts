import { prisma } from '../config/database';

export const userRepository = {
  findByName: (name: string) =>
    prisma.user.findUnique({ where: { name } }),

  findByEmail: (email: string) =>
    prisma.user.findFirst({ where: { email } }),

  findById: (id: string) =>
    prisma.user.findUnique({ where: { id } }),

  list: (branchId?: string) =>
    prisma.user.findMany({
      where: branchId ? { branchId } : undefined,
      select: { id: true, name: true, email: true, role: true, active: true, branchId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),

  create: (data: { name: string; email: string; password: string; role?: string; branchId?: string | null }) => {
    const createData: any = {
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
    };
    if (data.branchId !== undefined) {
      createData.branchId = data.branchId;
    }
    return prisma.user.create({ data: createData });
  },

  update: (id: string, data: { name?: string; email?: string; password?: string; active?: boolean; branchId?: string | null }) => {
    const updateData: any = { ...data };
    if (data.branchId === undefined) {
      delete updateData.branchId;
    }
    return prisma.user.update({ where: { id }, data: updateData });
  },
};
