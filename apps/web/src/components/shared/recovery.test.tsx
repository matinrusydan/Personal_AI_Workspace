import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTable } from './DataTable';
import { ToastProvider } from './ToastProvider';
import { ResourceNotice, readList } from './ResourceState';
import { isUnauthorized, loginRedirectPath, readAccount } from './SessionContext';
import { dayKey, dueTasks, todaysAgenda, upcomingMeetings } from './agenda';
import { nextSort, pageCount, togglePageSelection, toggleRowSelection } from './table-model';

const columns = [
  {
    key: 'title',
    header: 'Title',
    sortable: true,
    render: (row: { id: string; title: string }) => row.title,
  },
];
const pagination = {
  page: 2,
  pageSize: 10,
  totalItems: 31,
  onPageChange: () => {},
  onPageSizeChange: () => {},
};

function table(extra = {}) {
  return renderToStaticMarkup(
    <DataTable
      caption="Test records"
      rows={[{ id: 'stable-id', title: 'Record title' }]}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.title}
      columns={columns}
      pagination={pagination}
      selection={{ selectedRowIds: ['stable-id'], onChange: () => {} }}
      sort={{ key: 'title', direction: 'asc' }}
      onSortChange={() => {}}
      {...extra}
    />,
  );
}

describe('Recovery table', () => {
  it('renders table semantics, mixed-selection control, sorting and server pagination', () => {
    const markup = table();
    expect(markup).toContain('<caption class="sr-only">Test records</caption>');
    expect(markup).toContain('aria-sort="ascending"');
    expect(markup).toContain('Select all rows on this page');
    expect(markup).toContain('Select Record title');
    expect(markup).toContain('31 records');
    expect(markup).toContain('Page 2 of 4');
    for (const label of ['First', 'Previous', 'Next', 'Last'])
      expect(markup).toContain(`${label} page`);
    // The caller's already-paginated row must not be sliced again for page 2.
    expect(markup).toContain('Record title');
  });
  it('hides stale records and counts during errors and loading', () => {
    const failed = table({ error: 'Device list unavailable' });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Record count unavailable');
    expect(failed).not.toContain('Record title');
    expect(failed).not.toContain('31 records');
    const loading = table({ loading: true });
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('Loading records');
    expect(loading).not.toContain('Record title');
  });
  it('has an explicit empty state and disables empty-page navigation', () => {
    const markup = table({ rows: [], pagination: { ...pagination, page: 1, totalItems: 0 } });
    expect(markup).toContain('No records found.');
    expect(markup).toContain('0 records');
    expect(markup).toContain('Page 1 of 1');
    expect(markup).toMatch(/aria-label="Next page" disabled/);
  });
  it('scopes selection to this page rather than unseen rows', () => {
    expect(togglePageSelection(['a', 'b'], ['a', 'elsewhere'])).toEqual(['a', 'b']);
    expect(togglePageSelection(['a', 'b'], ['a', 'b', 'elsewhere'])).toEqual([]);
    expect(toggleRowSelection(['a', 'b'], ['a', 'elsewhere'], 'b')).toEqual(['a', 'b']);
    expect(toggleRowSelection(['a', 'b'], ['a', 'b'], 'a')).toEqual(['b']);
  });
  it('computes remote page counts and toggles sorting', () => {
    expect(pageCount(31, 10)).toBe(4);
    expect(pageCount(0, 25)).toBe(1);
    expect(nextSort(undefined, 'title')).toEqual({ key: 'title', direction: 'asc' });
    expect(nextSort({ key: 'title', direction: 'asc' }, 'title').direction).toBe('desc');
  });
});

describe('Honest resource and session states', () => {
  it('distinguishes failed list responses from empty lists', () => {
    expect(readList({ data: [] })).toEqual([]);
    expect(() => readList({})).toThrow();
    const markup = renderToStaticMarkup(
      <ResourceNotice status="error" noun="tasks" onRetry={() => {}} />,
    );
    expect(markup).toContain('Data is unavailable, not empty.');
  });
  it('recognizes 401 by status, not an error message', () => {
    expect(isUnauthorized({ status: 401 })).toBe(true);
    expect(isUnauthorized({ status: 500 })).toBe(false);
    expect(isUnauthorized(new Error('401'))).toBe(false);
    expect(() => readAccount({ data: { email: 'invented@example.test' } })).toThrow();
  });
  it('builds a same-origin login redirect and rejects unsafe return paths', () => {
    expect(loginRedirectPath('/settings')).toBe('/login?redirect=%2Fsettings');
    expect(loginRedirectPath('//attacker.invalid')).toBe('/login?redirect=%2F');
    expect(loginRedirectPath('/\\\\attacker.invalid')).toBe('/login?redirect=%2F');
  });
  it('creates persistent polite and assertive announcement containers', () => {
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <p>Content</p>
      </ToastProvider>,
    );
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-live="assertive"');
  });
});

describe('Real agenda derivation', () => {
  const now = Date.parse('2026-10-30T02:00:00Z');
  it('uses the account timezone and excludes midnight end boundaries', () => {
    expect(dayKey('2026-10-29T18:00:00Z', 'Asia/Jakarta')).toBe('2026-10-30');
    const events = [
      {
        id: 'overnight',
        title: 'Overnight',
        startsAt: '2026-10-29T16:00:00Z',
        endsAt: '2026-10-30T03:00:00Z',
      },
      {
        id: 'midnight',
        title: 'Previous day',
        startsAt: '2026-10-29T15:00:00Z',
        endsAt: '2026-10-29T17:00:00Z',
      },
    ];
    expect(todaysAgenda(events, now, 'Asia/Jakarta').map((event) => event.id)).toEqual([
      'overnight',
    ]);
  });
  it('sorts due open tasks and excludes completed or undated tasks', () => {
    expect(
      dueTasks(
        [
          { id: 'overdue', title: 'Overdue', status: 'todo', dueAt: '2026-10-29T00:00:00Z' },
          { id: 'done', title: 'Done', status: 'done', dueAt: '2026-10-29T00:00:00Z' },
          { id: 'undated', title: 'Undated', status: 'todo', dueAt: null },
        ],
        now,
      ).map((task) => task.id),
    ).toEqual(['overdue']);
  });
  it('does not invent meeting dates for orphan meeting records', () => {
    expect(
      upcomingMeetings(
        [{ id: 'orphan', provider: 'zoom', provisioningStatus: 'requested', calendarEvent: null }],
        now,
      ),
    ).toEqual([]);
  });
});
