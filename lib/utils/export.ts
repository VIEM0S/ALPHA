/**
 * Export CSV générique — Kafora
 * -------------------------------------
 * Pas de dépendance externe : génère le CSV en JS pur (Excel/LibreOffice le
 * lisent nativement) et déclenche le téléchargement côté navigateur.
 * Utilisable depuis n'importe quelle page (sales, inventory, credits...).
 *
 * Exemple :
 *   exportToCsv('ventes-juillet-2026', sales, [
 *     { key: 'reference', label: 'Référence' },
 *     { key: 'createdAt', label: 'Date', format: (v) => formatDate(v) },
 *     { key: 'total', label: 'Total (FCFA)' },
 *   ]);
 */

export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  /** Transforme la valeur brute avant écriture (dates, montants, lookups...) */
  format?: (value: unknown, row: T) => string | number;
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Si la valeur contient un séparateur, un guillemet ou un saut de ligne,
  // on l'entoure de guillemets et on double les guillemets internes.
  if (/[",;\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getValue<T>(row: T, key: keyof T | string): unknown {
  return (row as Record<string, unknown>)[key as string];
}

/**
 * Convertit un tableau d'objets en chaîne CSV (séparateur `;`, standard en
 * France/Afrique francophone pour un import direct dans Excel sans souci
 * de locale — le point-virgule évite le conflit avec les décimales à virgule).
 */
export function toCsvString<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map(c => escapeCsvValue(c.label)).join(';');
  const lines = rows.map(row =>
    columns
      .map(c => {
        const raw = getValue(row, c.key);
        const value = c.format ? c.format(raw, row) : raw;
        return escapeCsvValue(value);
      })
      .join(';')
  );
  // \uFEFF (BOM UTF-8) pour qu'Excel affiche correctement les accents français
  return '\uFEFF' + [header, ...lines].join('\r\n');
}

/** Génère le CSV et déclenche le téléchargement dans le navigateur. */
export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = toCsvString(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', safeName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Formatte une Date/Timestamp Firestore en JJ/MM/AAAA pour l'export. */
export function formatDateForCsv(value: unknown): string {
  if (!value) return '';
  const date = (value as { toDate?: () => Date }).toDate
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string | number);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR');
}
