import { prisma } from '../config/prisma.js';

export const userRepository = {
  ping: () => prisma.$queryRaw`SELECT 1`
};
