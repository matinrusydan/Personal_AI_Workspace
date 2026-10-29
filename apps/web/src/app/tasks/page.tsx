'use client';

import React, { useState } from 'react';
import { TaskCard, TaskItem } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';

const initialTasks: TaskItem[] = [
  {
    id: 'demo-task-1',
    title: 'Review Chapter 5 of KP Report',
    description: 'Verify system architecture diagrams and results discussion.',
    priority: 'high',
    status: 'in_progress',
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    tags: ['thesis', 'urgent'],
    version: 1,
  },
  {
    id: 'demo-task-2',
    title: 'Setup Google Calendar API Scopes',
    description: 'Configure OAuth consent screen and minimum required calendar scopes.',
    priority: 'normal',
    status: 'todo',
    dueAt: new Date(Date.now() + 172800000).toISOString(),
    tags: ['backend', 'integrations'],
    version: 1,
  },
  {
    id: 'demo-task-3',
    title: 'Platform Core Monorepo & Database Setup',
    description: 'Phase 1 milestones P1-01 to P1-04 fully implemented and verified.',
    priority: 'high',
    status: 'done',
    dueAt: new Date().toISOString(),
    tags: ['monorepo', 'core'],
    version: 2,
  },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleStatusChange = (taskId: string, newStatus: TaskItem['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, version: t.version + 1 } : t)),
    );
  };

  const handleDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleCreateTask = (newTaskData: Omit<TaskItem, 'id' | 'version'>) => {
    const newTask: TaskItem = {
      ...newTaskData,
      id: `task-${Date.now()}`,
      version: 1,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const columns: { title: string; status: TaskItem['status']; countBadge: string }[] = [
    { title: 'To Do', status: 'todo', countBadge: 'bg-surface-subtle text-text-secondary' },
    {
      title: 'In Progress',
      status: 'in_progress',
      countBadge: 'bg-action-primary/10 text-action-primary',
    },
    { title: 'Done', status: 'done', countBadge: 'bg-success/10 text-success' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Tasks & Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage personal projects, subtasks, priorities, and deadlines
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-action-primary px-4 text-sm font-semibold text-action-foreground shadow-sm hover:bg-action-primary-hover transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full sm:w-64 rounded-md border border-border bg-surface-subtle px-3 text-xs text-text-primary placeholder:text-text-muted focus:border-action-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'todo', 'in_progress', 'done'].map((statusKey) => (
            <button
              key={statusKey}
              type="button"
              onClick={() => setFilterStatus(statusKey)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filterStatus === statusKey
                  ? 'bg-action-primary/15 text-action-primary font-semibold'
                  : 'text-text-muted hover:bg-surface-subtle hover:text-text-primary'
              }`}
            >
              {statusKey.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Board View */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.status);

          return (
            <div
              key={col.status}
              className="flex flex-col rounded-xl border border-border bg-surface-subtle/50 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-text-primary">{col.title}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${col.countBadge}`}
                  >
                    {colTasks.length}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3">
                {colTasks.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
                    No tasks in {col.title.toLowerCase()}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CreateTaskDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateTask}
      />
    </div>
  );
}
