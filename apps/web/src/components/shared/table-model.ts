export interface TableSort {
  key: string;
  direction: 'asc' | 'desc';
}

export function nextSort(current: TableSort | undefined, key: string): TableSort {
  return { key, direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc' };
}

export function pageCount(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalItems) / Math.max(1, pageSize)));
}

/** Selection is scoped to visible rows, never to unseen server pages. */
export function togglePageSelection(ids: readonly string[], selected: readonly string[]): string[] {
  const chosen = new Set(selected);
  return ids.length > 0 && ids.every((id) => chosen.has(id)) ? [] : [...ids];
}

export function toggleRowSelection(
  ids: readonly string[],
  selected: readonly string[],
  id: string,
): string[] {
  const chosen = new Set(selected);
  if (chosen.has(id)) chosen.delete(id);
  else chosen.add(id);
  return ids.filter((visible) => chosen.has(visible));
}
