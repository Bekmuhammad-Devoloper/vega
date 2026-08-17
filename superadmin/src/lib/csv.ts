export function downloadCsv<T extends object>(
  filename: string,
  rows: T[],
  columns: Array<{ key: keyof T; label: string; format?: (v: unknown) => string }>,
): void {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const v = (row as Record<string, unknown>)[c.key as string];
          const str = c.format ? c.format(v) : v == null ? '' : String(v);
          return escapeCsv(str);
        })
        .join(','),
    )
    .join('\n');

  const csv = `${header}\n${body}`;
  // UTF-8 BOM for Excel compatibility
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
