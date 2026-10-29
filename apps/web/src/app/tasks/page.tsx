'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TaskCard, TaskItem } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog';
import { tasksApi } from '@/lib/api';

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await tasksApi.list(filterStatus);
      setTasks(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch tasks from database';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusChange = async (taskId: string, newStatus: TaskItem['status']) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      await tasksApi.update(taskId, {
        status: newStatus,
        version: task.version,
      });
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update task status';
      alert(`Error updating task: ${msg}`);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await tasksApi.delete(taskId);
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task';
      alert(`Error deleting task: ${msg}`);
    }
  };

  const handleCreateTask = async (newTaskData: Omit<TaskItem, 'id' | 'version'>) => {
    try {
      await tasksApi.create(newTaskData);
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create task in PostgreSQL';
      alert(`Error creating task: ${msg}`);
    }
  };

  const handleUpdateTask = async (
    id: string,
    updatedData: {
      title: string;
      description?: string | null;
      priority: TaskItem['priority'];
      status: TaskItem['status'];
      dueAt?: string | null;
      tags?: string[];
      version: number;
    },
  ) => {
    await tasksApi.update(id, updatedData);
    await fetchTasks();
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const columns: { title: string; status: TaskItem['status']; countBadge: string }[] = [
    { title: 'To Do', status: 'todo', countBadge: 'bg-surface-subtle text-text-secondary' },
    {
      title: 'In Progress',
      status: 'in_progress',
      countBadge: 'bg-action-primary/10 text-action-primary',
    },
    { title: 'Blocked', status: 'blocked', countBadge: 'bg-warning/10 text-warning' },
    { title: 'Done', status: 'done', countBadge: 'bg-success/10 text-success' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Tasks & Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">
            PostgreSQL 16 authoritative task management with optimistic concurrency & outbox events
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-action-primary px-4 text-sm font-semibold text-action-foreground shadow-sm hover:bg-action-primary-hover transition-colors"
        >
          + New Task
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Failed to connect to backend: {error}</span>
          <button
            type="button"
            onClick={fetchTasks}
            className="rounded bg-destructive/20 px-2 py-1 text-xs font-semibold hover:bg-destructive/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search tasks in database..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full sm:w-64 rounded-md border border-border bg-surface-subtle px-3 text-xs text-text-primary placeholder:text-text-muted focus:border-action-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'todo', 'in_progress', 'blocked', 'done'].map((statusKey) => (
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

      {/* Kanban Board View */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface text-sm text-text-muted">
          Loading tasks from PostgreSQL database...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        onEdit={(t) => setEditingTask(t)}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <CreateTaskDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateTask}
      />

      {/* Edit Dialog */}
      <EditTaskDialog
        isOpen={!!editingTask}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleUpdateTask}
      />
    </div>
  );
}
