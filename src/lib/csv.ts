/**
 * Convert an array of objects to a CSV string.
 */
export function toCSV(data: Record<string, unknown>[], columns?: string[]): string {
  if (data.length === 0) return "";

  const headers = columns || Object.keys(data[0]);

  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Create a Response with CSV content and download headers.
 */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
