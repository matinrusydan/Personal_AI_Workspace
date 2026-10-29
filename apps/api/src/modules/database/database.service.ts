import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, getPrismaClient } from '@paw/database';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  public readonly client: PrismaClient = getPrismaClient();

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
