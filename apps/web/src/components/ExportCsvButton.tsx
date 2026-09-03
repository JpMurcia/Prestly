import { Button } from '@repo/ui/web';

export interface ExportCsvButtonProps {
  filename: string;
  headers: string[];
  rows: string[][];
  className?: string;
}

/** Serialización manual + descarga vía Blob (FR-007, research.md §5) — sin librería, dado el
 * volumen pequeño de filas de esta cartera. */
function toCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [headers, ...rows].map((line) => line.map(escape).join(','));
  return lines.join('\n');
}

export function ExportCsvButton({ filename, headers, rows, className }: ExportCsvButtonProps) {
  function handleExport() {
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return <Button label="Exportar CSV" variant="secondary" onPress={handleExport} className={className} />;
}
