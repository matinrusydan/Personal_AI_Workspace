import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { DevicesModule } from './modules/devices/devices.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [AuthModule, DevicesModule, AuditModule],
})
export class AppModule {}
