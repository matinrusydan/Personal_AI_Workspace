import { PrismaClient } from '@prisma/client';

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!global.__prismaClient) {
    global.__prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }
  return global.__prismaClient;
}

export const prisma = getPrismaClient();
export { PrismaClient };
export type * from '@prisma/client';
