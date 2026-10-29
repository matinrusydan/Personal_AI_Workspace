import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService, CreateTaskDto, UpdateTaskDto } from './tasks.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async listTasks(
    @Req() req: { user: AuthenticatedUser },
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('dueBefore') dueBefore?: string,
  ) {
    return this.tasksService.listTasks(req.user.userId, {
      status,
      projectId,
      dueBefore,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: CreateTaskDto,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.tasksService.createTask(req.user.userId, body, traceId);
  }

  @Get(':id')
  async getTask(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.tasksService.getTask(req.user.userId, id);
  }

  @Patch(':id')
  async updateTask(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: UpdateTaskDto,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    const versionFromHeader = ifMatch ? parseInt(ifMatch, 10) : undefined;
    return this.tasksService.updateTask(req.user.userId, id, body, versionFromHeader, traceId);
  }

  @Delete(':id')
  async deleteTask(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.tasksService.deleteTask(req.user.userId, id, traceId);
  }
}
