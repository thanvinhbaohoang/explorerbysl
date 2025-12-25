/**
 * Utility functions for CSV export functionality
 */

/**
 * Escapes a value for CSV format
 * Handles quotes, commas, and newlines
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Check if the value needs to be quoted
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Converts an array of objects to CSV format
 * @param data - Array of objects to convert
 * @param columns - Array of column definitions with key and header
 * @returns CSV string
 */
export function convertToCSV<T>(
  data: T[],
  columns: { key: string; header: string; getValue?: (item: T) => unknown }[]
): string {
  if (data.length === 0) {
    return columns.map(col => col.header).join(',');
  }

  // Create header row
  const headerRow = columns.map(col => escapeCSVValue(col.header)).join(',');

  // Create data rows
  const dataRows = data.map(item => {
    return columns.map(col => {
      let value: unknown;
      if (col.getValue) {
        value = col.getValue(item);
      } else {
        value = (item as Record<string, unknown>)[col.key];
      }
      return escapeCSVValue(value);
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Triggers a download of a CSV file in the browser
 * @param csvContent - The CSV content as a string
 * @param filename - The name of the file to download
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Exports data to CSV and triggers download
 * @param data - Array of objects to export
 * @param columns - Column definitions
 * @param filename - Name of the file (without extension)
 */
export function exportToCSV<T>(
  data: T[],
  columns: { key: string; header: string; getValue?: (item: T) => unknown }[],
  filename: string
): void {
  const csvContent = convertToCSV(data, columns);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csvContent, `${filename}_${timestamp}.csv`);
}
