import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@paw/database';

@Injectable()
export class ProjectsService {
  async listProjects(ownerId: string) {
    const projects = await prisma.project.findMany({
      where: {
        ownerId,
        archivedAt: null,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: projects.map((p) => ({
        id: p.id,
        title: p.title,
        colorToken: p.colorToken,
        taskCount: p._count.tasks,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  async createProject(ownerId: string, data: { title: string; colorToken?: string }) {
    const project = await prisma.project.create({
      data: {
        ownerId,
        title: data.title,
        colorToken: data.colorToken,
      },
    });

    return {
      data: {
        id: project.id,
        title: project.title,
        colorToken: project.colorToken,
        createdAt: project.createdAt.toISOString(),
      },
    };
  }

  async archiveProject(ownerId: string, id: string) {
    const existing = await prisma.project.findFirst({
      where: { id, ownerId },
    });

    if (!existing) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return {
      data: {
        id: updated.id,
        archivedAt: updated.archivedAt?.toISOString(),
      },
    };
  }
}
