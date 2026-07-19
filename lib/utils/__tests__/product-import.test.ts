import { describe, it, expect } from 'vitest';
import { parsePastedText } from '../product-import';

describe('parsePastedText', () => {
  it('parse une ligne valide collée depuis Excel (tabulations)', () => {
    const text = 'Nom\tPrix Vente\tPrix Achat\nClous 4cm\t1200\t800';
    const rows = parsePastedText(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Clous 4cm',
      sellingPrice: 1200,
      purchasePrice: 800,
      errors: [],
    });
  });

  it('détecte le CSV (virgules) quand aucune tabulation n\'est présente sur l\'en-tête', () => {
    const text = 'Nom,Prix Vente\nVis 6mm,500';
    const rows = parsePastedText(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Vis 6mm');
    expect(rows[0].sellingPrice).toBe(500);
  });

  it('lève une erreur explicite si les colonnes obligatoires sont introuvables', () => {
    const text = 'Référence\tCatégorie\nABC\tQuincaillerie';
    expect(() => parsePastedText(text)).toThrowError(/Colonnes obligatoires introuvables/);
  });

  it('reconnaît les en-têtes accentués via la normalisation (ex. "Référence" pour SKU)', () => {
    // "Référence" (accentué) doit matcher l'alias 'reference' (sans accent) pour sku,
    // et "Prix de Vente" doit matcher l'alias 'prix de vente'.
    const text = 'Référence\tNom\tPrix de Vente\nCLOU-01\tClous\t1000';
    const rows = parsePastedText(text);
    expect(rows[0].sku).toBe('CLOU-01');
    expect(rows[0].name).toBe('Clous');
  });

  it('signale un nom manquant sans faire planter le parsing des autres lignes', () => {
    const text = 'Nom\tPrix Vente\n\t1000\nVis\t500';
    const rows = parsePastedText(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].errors).toContain('Nom manquant');
    expect(rows[1].errors).toHaveLength(0);
  });

  it('signale un prix de vente manquant ou invalide (0, négatif, texte)', () => {
    const text = 'Nom\tPrix Vente\nA\t\nB\t0\nC\t-5\nD\tabc\nE\t1000';
    const rows = parsePastedText(text);
    expect(rows[0].errors).toContain('Prix de vente manquant');
    expect(rows[1].errors).toContain('Prix de vente invalide'); // 0
    expect(rows[2].errors).toContain('Prix de vente invalide'); // négatif
    expect(rows[3].errors).toContain('Prix de vente invalide'); // texte non numérique
    expect(rows[4].errors).toHaveLength(0);
  });

  it('génère un SKU à partir du nom quand la colonne SKU est absente ou vide, et le signale en warning', () => {
    const text = 'Nom\tPrix Vente\nClous à tête plate 4cm\t1200';
    const rows = parsePastedText(text);
    // Tronqué à 20 caractères par design (voir product-import.ts) : "CLOUS-A-TETE-PLATE-4CM" (22) → 20 premiers caractères.
    expect(rows[0].sku).toBe('CLOUS-A-TETE-PLATE-4');
    expect(rows[0].sku.length).toBeLessThanOrEqual(20);
    expect(rows[0].warnings.some(w => w.startsWith('SKU auto-généré'))).toBe(true);
  });

  it('respecte un SKU fourni explicitement (pas de génération, pas de warning SKU)', () => {
    const text = 'SKU\tNom\tPrix Vente\ncm-004\tClous\t1200';
    const rows = parsePastedText(text);
    expect(rows[0].sku).toBe('CM-004'); // mis en majuscules
    expect(rows[0].warnings.some(w => w.startsWith('SKU auto-généré'))).toBe(false);
  });

  it('filtre les lignes entièrement vides', () => {
    const text = 'Nom\tPrix Vente\nClous\t1200\n\t\nVis\t500';
    const rows = parsePastedText(text);
    expect(rows).toHaveLength(2);
  });

  it('applique les valeurs par défaut (unité, seuil alerte, TVA) quand les colonnes sont absentes', () => {
    const text = 'Nom\tPrix Vente\nClous\t1200';
    const rows = parsePastedText(text);
    expect(rows[0].unit).toBe('piece');
    expect(rows[0].alertThreshold).toBe(10);
    expect(rows[0].taxRate).toBe(0);
  });

  it('accepte les nombres au format français (virgule décimale, espaces)', () => {
    const text = 'Nom\tPrix Vente\tPrix Achat\nSac ciment\t12 500,50\t9000';
    const rows = parsePastedText(text);
    expect(rows[0].sellingPrice).toBeCloseTo(12500.5, 1);
  });

  it('retourne un tableau vide pour un texte vide', () => {
    expect(parsePastedText('')).toEqual([]);
    expect(parsePastedText('   ')).toEqual([]);
  });

  it('assigne un rowIndex 1-based cohérent avec la ligne réelle du fichier (en-tête = ligne 1)', () => {
    const text = 'Nom\tPrix Vente\nClous\t1200\nVis\t500';
    const rows = parsePastedText(text);
    expect(rows[0].rowIndex).toBe(2);
    expect(rows[1].rowIndex).toBe(3);
  });
});
