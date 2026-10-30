'use client';

import React, { useState, useEffect } from 'react';
import { TaskItem } from './TaskCard';

interface EditTaskDialogProps {
  isOpen: boolean;
  task: TaskItem | null;
  onClose: () => void;
  onSubmit: (
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
  ) => Promise<void>;
}

export function EditTaskDialog({ isOpen, task, onClose, onSubmit }: EditTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskItem['priority']>('normal');
  const [status, setStatus] = useState<TaskItem['status']>('todo');
  const [dueAt, setDueAt] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setDueAt(task.dueAt ? task.dueAt.substring(0, 10) : '');
      setTagInput(task.tags ? task.tags.join(', ') : '');
      setError(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await onSubmit(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        tags,
        version: task.version,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update task';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-lg font-bold text-text-primary">Edit Task</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:text-text-primary"
          ></button>
        </div>

        {error && (
          <div className="mt-3 rounded border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskItem['status'])}
                className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskItem['priority'])}
                className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Due Date
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-action-primary px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-primary-hover shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Update Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
