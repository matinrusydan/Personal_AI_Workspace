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
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AiModule } from './modules/ai/ai.module';
import { AgentsModule } from './modules/agents/agents.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { StatsModule } from './modules/stats/stats.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

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
    ApprovalsModule,
    AiModule,
    AgentsModule,
    WorkflowsModule,
    StatsModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
