import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async listProjects(@Req() req: { user: AuthenticatedUser }) {
    return this.projectsService.listProjects(req.user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: { title: string; colorToken?: string },
  ) {
    return this.projectsService.createProject(req.user.userId, body);
  }

  @Delete(':id')
  async archiveProject(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.projectsService.archiveProject(req.user.userId, id);
  }
}
