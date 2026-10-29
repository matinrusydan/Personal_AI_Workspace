import { Module } from '@nestjs/common';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { DevicesModule } from './modules/devices/devices.module';
import { AuditModule } from './modules/audit/audit.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { RecurrenceModule } from './modules/recurrence/recurrence.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { TelegramModule } from './modules/telegram/telegram.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DevicesModule,
    AuditModule,
    ProjectsModule,
    TasksModule,
    RecurrenceModule,
    CalendarModule,
    MeetingsModule,
    RemindersModule,
    TelegramModule,
  ],
})
export class AppModule {}
