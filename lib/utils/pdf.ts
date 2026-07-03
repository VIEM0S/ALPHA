/**
 * Générateur de factures PDF — ProAlpha ERP
 * Utilise jsPDF + jspdf-autotable
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  // Entreprise
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyCity?: string;
  companyRccm?: string;
  companyNif?: string;
  currency?: string;

  // Facture
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  type?: 'FACTURE' | 'DEVIS' | 'REÇU';

  // Client
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;

  // Articles
  items: InvoiceItem[];

  // Totaux
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  tax?: number;
  total: number;

  // Paiement
  paymentMethod?: string;
  amountReceived?: number;
  change?: number;
  soldeCredit?: number;

  // Notes
  notes?: string;
}

const PM_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte bancaire',
  CREDIT: 'Crédit client',
};

function formatCFA(amount: number, currency = 'FCFA'): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' ' + currency;
}

export function generateInvoicePDF(data: InvoiceData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const currency = data.currency || 'FCFA';
  const type = data.type || 'FACTURE';
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;

  // ─── Couleurs ─────────────────────────────────────────────────────────────
  const PRIMARY = [37, 99, 235] as [number, number, number];     // blue-600
  const DARK    = [17, 24, 39] as [number, number, number];      // gray-900
  const GRAY    = [107, 114, 128] as [number, number, number];   // gray-500
  const LIGHT   = [249, 250, 251] as [number, number, number];   // gray-50
  const WHITE   = [255, 255, 255] as [number, number, number];

  // ─── Header ───────────────────────────────────────────────────────────────
  // Bandeau bleu en haut
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 35, 'F');

  // Nom entreprise
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName.toUpperCase(), margin, 16);

  // Type de document (FACTURE / DEVIS / REÇU)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(type, pageW - margin, 16, { align: 'right' });

  // Numéro document
  doc.setFontSize(9);
  doc.text(`N° ${data.invoiceNumber}`, pageW - margin, 23, { align: 'right' });

  // Contact entreprise sous le bandeau
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  let y = 42;
  const companyInfo = [
    data.companyPhone,
    data.companyEmail,
    [data.companyAddress, data.companyCity].filter(Boolean).join(', '),
    data.companyRccm ? `RCCM: ${data.companyRccm}` : null,
    data.companyNif ? `NIF: ${data.companyNif}` : null,
  ].filter(Boolean) as string[];

  companyInfo.forEach(line => {
    doc.text(line, margin, y);
    y += 4.5;
  });

  // ─── Infos facture (droite) ──────────────────────────────────────────────
  const infoY = 42;
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Date :', pageW - margin - 50, infoY);
  doc.text('Échéance :', pageW - margin - 50, infoY + 6);

  doc.setFont('helvetica', 'normal');
  doc.text(data.date, pageW - margin, infoY, { align: 'right' });
  doc.text(data.dueDate || data.date, pageW - margin, infoY + 6, { align: 'right' });

  // ─── Bloc client ─────────────────────────────────────────────────────────
  y = Math.max(y + 4, 75);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, y, contentW / 2 - 5, 28, 2, 2, 'F');

  doc.setTextColor(...PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURÉ À', margin + 4, y + 7);

  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.text(data.customerName, margin + 4, y + 14);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  let clientY = y + 20;
  if (data.customerPhone) { doc.text(data.customerPhone, margin + 4, clientY); clientY += 5; }
  if (data.customerEmail) { doc.text(data.customerEmail, margin + 4, clientY); }

  // ─── Tableau des articles ────────────────────────────────────────────────
  const tableY = y + 36;

  autoTable(doc, {
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [['Description', 'Qté', 'Prix unitaire', 'Total']],
    body: data.items.map(item => [
      item.description,
      item.quantity.toString(),
      formatCFA(item.unitPrice, currency),
      formatCFA(item.total, currency),
    ]),
    headStyles: {
      fillColor: PRIMARY,
      textColor: WHITE,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
    },
    bodyStyles: { fontSize: 9, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    styles: { cellPadding: 4 },
  });

  // ─── Totaux ───────────────────────────────────────────────────────────────
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const totalsX = pageW - margin - 75;
  let totY = finalY;

  const addTotalLine = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...(color || GRAY));
    doc.text(label, totalsX, totY);
    doc.setTextColor(...(bold ? PRIMARY : GRAY));
    doc.text(value, pageW - margin, totY, { align: 'right' });
    totY += 6;
  };

  addTotalLine('Sous-total', formatCFA(data.subtotal, currency));

  if (data.discountAmount && data.discountAmount > 0) {
    addTotalLine(
      `Remise (${data.discountPercent || 0}%)`,
      `-${formatCFA(data.discountAmount, currency)}`,
      false, [34, 197, 94] as [number, number, number]
    );
  }
  if (data.tax && data.tax > 0) {
    addTotalLine('TVA', formatCFA(data.tax, currency));
  }

  // Ligne séparatrice
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.3);
  doc.line(totalsX, totY - 2, pageW - margin, totY - 2);

  // Total final en grand
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(totalsX - 4, totY - 1, pageW - margin - totalsX + 4, 10, 2, 2, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', totalsX, totY + 6);
  doc.text(formatCFA(data.total, currency), pageW - margin, totY + 6, { align: 'right' });
  totY += 16;

  // Détail paiement
  if (data.paymentMethod) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Mode de paiement : ${PM_LABELS[data.paymentMethod] || data.paymentMethod}`, margin, totY);
    totY += 5;
    if (data.paymentMethod === 'CASH' && data.amountReceived) {
      doc.text(`Montant reçu : ${formatCFA(data.amountReceived, currency)}`, margin, totY); totY += 5;
      if (data.change) doc.text(`Monnaie rendue : ${formatCFA(data.change, currency)}`, margin, totY);
    }
    if (data.paymentMethod === 'CREDIT' && data.soldeCredit) {
      doc.setTextColor(234, 179, 8); // amber
      doc.setFont('helvetica', 'bold');
      doc.text(`Solde en crédit : ${formatCFA(data.soldeCredit, currency)}`, margin, totY);
    }
  }

  // ─── Notes ────────────────────────────────────────────────────────────────
  if (data.notes) {
    const noteY = totY + 12;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, noteY, contentW, 14, 2, 2, 'F');
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes :', margin + 4, noteY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(data.notes, margin + 20, noteY + 6);
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  const footerY = 285;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, footerY, pageW, 12, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${data.companyName} · ${[data.companyPhone, data.companyEmail].filter(Boolean).join(' · ')}`,
    pageW / 2, footerY + 7, { align: 'center' }
  );

  // ─── Téléchargement ───────────────────────────────────────────────────────
  const filename = `${type.toLowerCase()}-${data.invoiceNumber.replace(/[^a-z0-9]/gi, '-')}.pdf`;
  doc.save(filename);
}

export type { InvoiceData };
