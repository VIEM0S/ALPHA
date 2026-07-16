import * as XLSX from 'xlsx';

export interface ParsedProductRow {
  rowIndex: number; // 1-based, pour affichage humain (ligne du fichier)
  sku: string;
  name: string;
  categoryName: string | null;
  purchasePrice: number;
  sellingPrice: number;
  initialStock: number;
  barcode: string | null;
  unit: string;
  taxRate: number;
  alertThreshold: number;
  errors: string[];
  warnings: string[];
}

// Correspondances flexibles : plusieurs libellés de colonnes possibles par champ,
// normalisés (minuscules, sans accents) pour matcher un en-tête Excel réel.
const HEADER_ALIASES: Record<string, string[]> = {
  sku: ['sku', 'reference', 'ref', 'code'],
  name: ['nom', 'nom du produit', 'designation', 'produit', 'name'],
  categoryName: ['categorie', 'category'],
  purchasePrice: ['prix achat', "prix d'achat", 'purchase price', 'cout', 'cout achat'],
  sellingPrice: ['prix vente', 'prix de vente', 'selling price', 'prix'],
  initialStock: ['stock initial', 'stock', 'quantite', 'qty', 'quantite initiale'],
  barcode: ['code barre', 'code-barre', 'code barres', 'barcode', 'ean'],
  unit: ['unite', 'unit'],
  taxRate: ['tva', 'taxe', 'tax', 'tax rate'],
  alertThreshold: ['seuil alerte', 'seuil', 'alert threshold', "seuil d'alerte"],
};

function normalizeHeader(h: string): string {
  return h
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildColumnMap(headerRow: string[]): Record<string, number> {
  const normalized = headerRow.map(normalizeHeader);
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

function parseNumber(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const cleaned = String(raw).replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function rowsToProducts(rows: unknown[][]): ParsedProductRow[] {
  if (rows.length === 0) return [];
  const headerRow = rows[0].map(c => String(c ?? ''));
  const colMap = buildColumnMap(headerRow);

  const missing: string[] = [];
  if (colMap.name === undefined) missing.push('Nom');
  if (colMap.sellingPrice === undefined) missing.push('Prix Vente');
  if (missing.length > 0) {
    throw new Error(
      `Colonnes obligatoires introuvables dans l'en-tête : ${missing.join(', ')}. ` +
      `Vérifie que la première ligne contient bien les titres de colonnes.`
    );
  }

  const dataRows = rows.slice(1).filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));

  return dataRows.map((r, i): ParsedProductRow => {
    const get = (field: string): string => {
      const idx = colMap[field];
      return idx === undefined ? '' : String(r[idx] ?? '').trim();
    };
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = get('name');
    if (!name) errors.push('Nom manquant');

    const sellingPriceRaw = get('sellingPrice');
    const sellingPrice = parseNumber(sellingPriceRaw);
    if (!sellingPriceRaw) errors.push('Prix de vente manquant');
    else if (Number.isNaN(sellingPrice) || sellingPrice <= 0) errors.push('Prix de vente invalide');

    const purchasePrice = parseNumber(get('purchasePrice'));
    const initialStock = colMap.initialStock !== undefined ? parseNumber(get('initialStock')) : 0;
    if (Number.isNaN(initialStock)) warnings.push('Stock initial illisible, mis à 0');

    const taxRate = colMap.taxRate !== undefined ? parseNumber(get('taxRate')) : 0;
    const alertThreshold = colMap.alertThreshold !== undefined ? parseNumber(get('alertThreshold')) : 10;

    let sku = get('sku');
    if (!sku) {
      // SKU non fourni : on en génère un à partir du nom (comportement de secours,
      // signalé en warning pour que l'utilisateur sache qu'il a été auto-généré).
      sku = name
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20) || `PROD${i + 1}`;
      warnings.push(`SKU auto-généré : ${sku}`);
    }

    return {
      rowIndex: i + 2, // +2 : ligne 1 = en-tête, index humain commence à 1
      sku: sku.toUpperCase(),
      name,
      categoryName: colMap.categoryName !== undefined ? (get('categoryName') || null) : null,
      purchasePrice: Number.isNaN(purchasePrice) ? 0 : purchasePrice,
      sellingPrice: Number.isNaN(sellingPrice) ? 0 : sellingPrice,
      initialStock: Number.isNaN(initialStock) ? 0 : Math.max(0, Math.floor(initialStock)),
      barcode: colMap.barcode !== undefined ? (get('barcode') || null) : null,
      unit: (colMap.unit !== undefined ? get('unit') : '') || 'piece',
      taxRate: Number.isNaN(taxRate) ? 0 : taxRate,
      alertThreshold: Number.isNaN(alertThreshold) || alertThreshold <= 0 ? 10 : Math.floor(alertThreshold),
      errors,
      warnings,
    };
  });
}

/** Parse un fichier .xlsx, .xls ou .csv */
export async function parseProductFile(file: File): Promise<ParsedProductRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, blankrows: false });
  return rowsToProducts(rows);
}

/** Parse du texte collé depuis Excel (délimité par tabulations) ou un CSV collé (virgules) */
export function parsePastedText(text: string): ParsedProductRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/);
  // Excel copie toujours en tabulations ; on ne bascule sur la virgule que si
  // aucune tabulation n'est présente sur la ligne d'en-tête (cas CSV collé).
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
  return rowsToProducts(rows);
}

/** Modèle d'exemple à télécharger, pour que l'utilisateur sache quel format préparer */
export function buildTemplateWorkbook(): Blob {
  const headers = ['SKU', 'Nom', 'Catégorie', 'Prix Achat', 'Prix Vente', 'Stock Initial', 'Code Barre', 'Unité', 'TVA', 'Seuil Alerte'];
  const example = ['CLOU-4CM', 'Clous 4cm (boîte)', 'Quincaillerie', 800, 1200, 50, '', 'piece', 0, 10];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produits');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/octet-stream' });
}
