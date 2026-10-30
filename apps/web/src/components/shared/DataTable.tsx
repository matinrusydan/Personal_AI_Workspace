'use client';

import React, { useEffect, useId, useRef } from 'react';
import { secondaryButton } from './ResourceState';
import {
  nextSort,
  pageCount,
  togglePageSelection,
  toggleRowSelection,
  type TableSort,
} from './table-model';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
}
export interface DataTableProps<T> {
  caption: string;
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  getRowLabel?: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  search?: { value: string; onChange: (value: string) => void; label?: string };
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  selection?: { selectedRowIds: readonly string[]; onChange: (ids: string[]) => void };
  /** Rows are already paginated by the server. Page numbers are one-based. */
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: readonly number[];
  };
}

function SelectPage({
  checked,
  mixed,
  disabled,
  onChange,
}: {
  checked: boolean;
  mixed: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="flex min-h-touch min-w-touch items-center">
      <input
        ref={ref}
        type="checkbox"
        aria-label="Select all rows on this page"
        aria-checked={mixed ? 'mixed' : checked}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-4 w-4 accent-action-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
      />
    </label>
  );
}

export function DataTable<T>({
  caption,
  rows,
  columns,
  getRowId,
  getRowLabel,
  loading = false,
  error,
  onRetry,
  emptyMessage = 'No records found.',
  search,
  sort,
  onSortChange,
  selection,
  pagination,
}: DataTableProps<T>) {
  const id = useId();
  const unavailable = loading || Boolean(error);
  const visibleIds = rows.map(getRowId);
  const chosen = new Set(selection?.selectedRowIds);
  const selectedCount = visibleIds.filter((rowId) => chosen.has(rowId)).length;
  const pages = pageCount(pagination.totalItems, pagination.pageSize);
  const page = Math.max(1, pagination.page);
  const disabled = unavailable || pagination.totalItems === 0;
  const sizeOptions = Array.from(
    new Set([...(pagination.pageSizeOptions ?? [10, 25, 50]), pagination.pageSize]),
  )
    .filter((size) => size > 0)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {search ? (
        <div className="max-w-md space-y-1">
          <label htmlFor={`${id}-search`} className="block text-sm font-medium text-text-primary">
            {search.label ?? 'Search records'}
          </label>
          <input
            id={`${id}-search`}
            type="search"
            value={search.value}
            onChange={(event) => {
              search.onChange(event.target.value);
              pagination.onPageChange(1);
              selection?.onChange([]);
            }}
            className="min-h-touch w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
          />
        </div>
      ) : null}
      {selection ? (
        <p id={`${id}-selection`} role="status" className="text-sm text-text-secondary">
          {unavailable
            ? 'Selection unavailable while data is loading or in error.'
            : `${selectedCount} selected on this page`}
        </p>
      ) : null}
      <div
        className="overflow-x-auto rounded-lg border border-border"
        role="region"
        aria-label={caption}
        tabIndex={0}
      >
        <table
          aria-busy={loading}
          aria-describedby={selection ? `${id}-selection` : undefined}
          className="w-full border-collapse text-left text-sm"
        >
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-subtle text-text-secondary">
            <tr>
              {selection ? (
                <th scope="col" className="p-3">
                  <SelectPage
                    checked={visibleIds.length > 0 && selectedCount === visibleIds.length}
                    mixed={selectedCount > 0 && selectedCount < visibleIds.length}
                    disabled={unavailable || visibleIds.length === 0}
                    onChange={() =>
                      selection.onChange(togglePageSelection(visibleIds, selection.selectedRowIds))
                    }
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    column.sortable
                      ? sort?.key === column.key
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                  className="px-4 py-3 font-medium"
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      disabled={unavailable}
                      onClick={() => {
                        onSortChange(nextSort(sort, column.key));
                        pagination.onPageChange(1);
                        selection?.onChange([]);
                      }}
                      className="min-h-touch rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing disabled:opacity-60"
                    >
                      {column.header}
                      {sort?.key === column.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                      <span className="sr-only">
                        , sort{' '}
                        {sort?.key === column.key && sort.direction === 'asc'
                          ? 'descending'
                          : 'ascending'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface text-text-primary">
            {unavailable || rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, columns.length + (selection ? 1 : 0))} className="p-6">
                  {loading ? (
                    <p role="status">Loading records…</p>
                  ) : error ? (
                    <div role="alert" className="space-y-3">
                      <p>{error}</p>
                      {onRetry ? (
                        <button type="button" className={secondaryButton} onClick={onRetry}>
                          Try again
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p>{emptyMessage}</p>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowId = getRowId(row);
                return (
                  <tr key={rowId}>
                    {selection ? (
                      <td className="p-3">
                        <label className="flex min-h-touch min-w-touch items-center">
                          <input
                            type="checkbox"
                            checked={chosen.has(rowId)}
                            onChange={() =>
                              selection.onChange(
                                toggleRowSelection(visibleIds, selection.selectedRowIds, rowId),
                              )
                            }
                            aria-label={`Select ${getRowLabel?.(row) ?? rowId}`}
                            className="h-4 w-4 accent-action-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
                          />
                        </label>
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3">
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
        <label htmlFor={`${id}-page-size`} className="flex items-center gap-2">
          Rows per page
          <select
            id={`${id}-page-size`}
            value={pagination.pageSize}
            disabled={unavailable}
            onChange={(event) => {
              pagination.onPageSizeChange(Number(event.target.value));
              pagination.onPageChange(1);
              selection?.onChange([]);
            }}
            className="min-h-touch rounded-md border border-border bg-surface px-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
          >
            {sizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <p role="status">
          {unavailable
            ? 'Record count unavailable'
            : `${pagination.totalItems} records · Page ${page} of ${pages}`}
        </p>
        <nav aria-label={`${caption} pagination`} className="flex flex-wrap gap-2">
          {[
            { label: 'First', target: 1, disabled: page <= 1 },
            { label: 'Previous', target: Math.max(1, page - 1), disabled: page <= 1 },
            { label: 'Next', target: Math.min(pages, page + 1), disabled: page >= pages },
            { label: 'Last', target: pages, disabled: page >= pages },
          ].map((control) => (
            <button
              key={control.label}
              type="button"
              aria-label={`${control.label} page`}
              disabled={disabled || control.disabled}
              onClick={() => {
                pagination.onPageChange(control.target);
                selection?.onChange([]);
              }}
              className={secondaryButton}
            >
              {control.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
