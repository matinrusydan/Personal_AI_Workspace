'use client';

import React, { useState } from 'react';
import { TaskItem } from './TaskCard';

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<TaskItem, 'id' | 'version'>) => void;
}

export function CreateTaskDialog({ isOpen, onClose, onSubmit }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskItem['priority']>('normal');
  const [dueAt, setDueAt] = useState('');
  const [tagInput, setTagInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: 'todo',
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      tags,
    });

    setTitle('');
    setDescription('');
    setPriority('normal');
    setDueAt('');
    setTagInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-lg font-bold text-text-primary">Create New Task</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:text-text-primary"
          ></button>
        </div>

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
              placeholder="e.g. Complete review for chapter 5"
              className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-action-primary focus:outline-none"
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
              placeholder="Add optional notes or acceptance criteria..."
              className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-action-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. backend, thesis, report"
              className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-action-primary focus:outline-none"
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
              className="rounded-md bg-action-primary px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-primary-hover shadow-sm"
            >
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
