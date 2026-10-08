import type { HistoryItem } from "./storage";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Download history as quickscan-history.csv (date,type,format,value,favorite). */
export function exportHistoryCsv(items: HistoryItem[]): void {
  const header = "date,type,format,value,favorite";
  const rows = items.map((i) =>
    [
      new Date(i.updatedAt).toISOString(),
      i.type,
      i.format,
      i.value,
      i.favorite ? "true" : "false",
    ]
      .map(escapeCsv)
      .join(",")
  );
  const csv = [header, ...rows].join("\r\n") + "\r\n";

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quickscan-history.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
