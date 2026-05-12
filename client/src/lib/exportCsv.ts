/**
 * PURE CSV Export Utility
 * Generates and triggers a browser download for CSV data.
 */

export interface CSVSection {
    header: string;
    rows: LooseValue[];
}

export function downloadCSV(filename: string, sections: CSVSection[]) {
    let csvContent = '';

    sections.forEach((section) => {
        // Section Header
        csvContent += `## ${section.header}\n`;

        if (section.rows.length === 0) {
            csvContent += 'No data available\n\n';
            return;
        }

        // Column Headers
        const headers = Object.keys(section.rows[0]);
        csvContent += headers.join(',') + '\n';

        // Data Rows
        section.rows.forEach((row) => {
            const values = headers.map((header) => {
                const val = row[header];
                const stringVal = val === null || val === undefined ? '' : String(val);
                // Escape quotes and wrap in quotes if contains comma
                const escaped = stringVal.replace(/"/g, '""');
                return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') 
                    ? `"${escaped}"` 
                    : escaped;
            });
            csvContent += values.join(',') + '\n';
        });

        csvContent += '\n'; // Spacer between sections
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
