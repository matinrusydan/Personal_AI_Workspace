'use client';

import React from 'react';

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  dueAt?: string | null;
  tags?: string[];
  version: number;
}

interface TaskCardProps {
  task: TaskItem;
  onStatusChange?: (taskId: string, newStatus: TaskItem['status']) => void;
  onEdit?: (task: TaskItem) => void;
  onDelete?: (taskId: string) => void;
}

const priorityStyles: Record<TaskItem['priority'], { label: string; badge: string }> = {
  low: { label: 'Low', badge: 'bg-surface-subtle text-text-muted border-border' },
  normal: {
    label: 'Normal',
    badge: 'bg-action-primary/10 text-action-primary border-action-primary/20',
  },
  high: { label: 'High', badge: 'bg-warning/10 text-warning border-warning/20 font-semibold' },
  urgent: {
    label: 'Urgent',
    badge: 'bg-destructive/10 text-destructive border-destructive/20 font-bold',
  },
};

export function TaskCard({ task, onStatusChange, onEdit, onDelete }: TaskCardProps) {
  const priorityInfo = priorityStyles[task.priority] || priorityStyles.normal;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-all hover:border-action-primary/40">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-text-primary leading-snug">{task.title}</h4>
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border ${priorityInfo.badge}`}
        >
          {priorityInfo.label}
        </span>
      </div>

      {task.description && (
        <p className="mt-1.5 text-xs text-text-secondary line-clamp-2">{task.description}</p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-text-muted border border-border-subtle"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer & Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-text-muted">
        <div>
          {task.dueAt ? (
            <span className="flex items-center gap-1 text-[11px]">
              📅{' '}
              {new Date(task.dueAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
            </span>
          ) : (
            <span className="text-[11px] text-text-muted/60">No due date</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onStatusChange && (
            <select
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value as TaskItem['status'])}
              className="rounded border border-border bg-surface-subtle px-2 py-1 text-xs text-text-primary focus:border-action-primary focus:outline-none cursor-pointer"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="rounded p-1 text-text-muted hover:bg-surface-subtle hover:text-text-primary transition-colors"
              title="Edit task"
            >
              ✏️
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="rounded p-1 text-text-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Delete task"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
