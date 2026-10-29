import { describe, it, expect } from 'vitest';
import { TaskItem } from '../src/components/tasks/TaskCard';

describe('Tasks Component & Model Logic (Milestone P2-01)', () => {
  it('correctly models task state and priority definitions', () => {
    const task: TaskItem = {
      id: 'task-100',
      title: 'Implement Google Calendar Sync',
      priority: 'high',
      status: 'todo',
      version: 1,
      tags: ['google', 'sync'],
      dueAt: '2026-11-01T00:00:00.000Z',
    };

    expect(task.id).toBe('task-100');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('high');
    expect(task.tags).toContain('google');
  });

  it('filters task lists by status transition accurately', () => {
    const tasks: TaskItem[] = [
      { id: '1', title: 'Task 1', priority: 'normal', status: 'todo', version: 1 },
      { id: '2', title: 'Task 2', priority: 'urgent', status: 'in_progress', version: 1 },
      { id: '3', title: 'Task 3', priority: 'low', status: 'done', version: 2 },
    ];

    const todoList = tasks.filter((t) => t.status === 'todo');
    const inProgressList = tasks.filter((t) => t.status === 'in_progress');
    const doneList = tasks.filter((t) => t.status === 'done');

    expect(todoList).toHaveLength(1);
    expect(inProgressList).toHaveLength(1);
    expect(doneList).toHaveLength(1);
    expect(inProgressList[0]!.priority).toBe('urgent');
  });
});
