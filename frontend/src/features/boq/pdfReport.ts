import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  groupPositionsIntoSections,
  isSection,
  type Position,
} from './api';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface PdfMarkupTotal {
  name: string;
  percentage: number;
  amount: number;
}

export interface PdfReportOptions {
  /** BOQ title shown in the report header. */
  boqTitle: string;
  /** Optional project name shown on the cover page. */
  projectName?: string;
  /** Optional date string (ISO or display); defaults to today. */
  date?: string;
  /** Currency symbol prepended in display (e.g. "€", "$"). */
  currency: string;
  /** Flat list of all BOQ positions (sections + items). */
  positions: Position[];
  /** Applied markups with pre-computed amounts. */
  markupTotals: PdfMarkupTotal[];
  /** Direct cost (sum of all line-item totals). */
  directCost: number;
  /** Net total after markups. */
  netTotal: number;
  /** VAT rate as decimal (e.g. 0.19 for 19%). */
  vatRate: number;
  /** VAT amount (pre-computed). */
  vatAmount: number;
  /** Gross total including VAT (pre-computed). */
  grossTotal: number;
  /** BCP-47 locale tag for number formatting (e.g. "en-US", "de-DE"). */
  locale?: string;
  /** When false, skip resource sub-rows (materials/labor/equipment breakdown). */
  includeResources?: boolean;
  /** When true, render in landscape orientation. */
  landscape?: boolean;
}

/* ── Internal section data ──────────────────────────────────────────────── */

interface SectionEntry {
  ordinal: string;
  description: string;
  subtotal: number;
  pageNumber: number; // filled after rendering
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Groups a flat positions array into sections with their children and
 * computes per-section subtotals. Also returns any ungrouped line items.
 * This is a pure function and is exported for unit testing.
 */
export function buildSectionGroups(positions: Position[]): {
  sections: Array<{ ordinal: string; description: string; children: Position[]; subtotal: number }>;
  ungrouped: Position[];
} {
  const grouped = groupPositionsIntoSections(positions);
  return {
    sections: grouped.sections.map((g) => ({
      ordinal: g.section.ordinal,
      description: g.section.description,
      children: g.children,
      subtotal: g.subtotal,
    })),
    ungrouped: grouped.ungrouped.filter((p) => !isSection(p)),
  };
}

/** Format a number with currency symbol and locale-aware separators.
 *  The symbol always goes BEFORE the amount (e.g. "S/ 1,234.56", "€ 1.234,56"). */
function formatCurrency(value: number, currency: string, locale: string): string {
  const glue = (n: string) => (currency ? `${currency} ${n}` : n);
  try {
    return glue(
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value),
    );
  } catch {
    return glue(value.toFixed(2));
  }
}

/** Format a plain number (for quantities). */
function formatNumber(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

/** Format a date string or Date to a human-readable display string. */
function formatDate(dateInput: string | undefined, locale: string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return dateInput ?? '';
  try {
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return d.toISOString().split('T')[0] ?? '';
  }
}

/* ── Localised labels ───────────────────────────────────────────────────── */
// This client-side (jsPDF) report is what the UI uses for normal-sized BOQs;
// the server-side ReportLab report (localised separately) only runs for very
// large BOQs. Both must speak the same language. Default is Spanish; an
// explicit "en" locale renders English. Unknown languages fall back to Spanish.

type PdfLang = 'es' | 'en';

function pickPdfLang(locale?: string): PdfLang {
  const code = (locale ?? 'es').replace('_', '-').split('-')[0]?.toLowerCase();
  return code === 'en' ? 'en' : 'es';
}

const PDF_LABELS: Record<PdfLang, Record<string, string>> = {
  es: {
    date: 'Fecha',
    sections: 'Capítulos',
    positions: 'Partidas',
    resources: 'Recursos',
    directCost: 'Coste directo',
    markups: 'Márgenes',
    none: 'Ninguno',
    netTotal: 'Total neto',
    vat: 'IVA',
    grossTotal: 'Importe total',
    grossTotalUpper: 'IMPORTE TOTAL',
    preparedBy: 'Preparado por:',
    approvedBy: 'Aprobado por:',
    signatureLine: 'Nombre / Firma / Fecha',
    toc: 'Índice',
    page: 'Página',
    of: 'de',
    billOfQuantities: 'Presupuesto',
    colNo: 'Nº',
    colDescription: 'Descripción',
    colUnit: 'Ud.',
    colQty: 'Cant.',
    colUnitRate: 'Precio unit.',
    colTotal: 'Total',
    sectionSubtotal: 'Subtotal capítulo:',
    ungroupedItems: 'Partidas sin agrupar',
    costSummary: 'Resumen de costes',
    colSection: 'Capítulo',
    colSubtotal: 'Subtotal',
    colItem: 'Concepto',
    colAmount: 'Importe',
    boqReport: 'Informe de presupuesto',
  },
  en: {
    date: 'Date',
    sections: 'Sections',
    positions: 'Positions',
    resources: 'Resources',
    directCost: 'Direct Cost',
    markups: 'Markups',
    none: 'None',
    netTotal: 'Net Total',
    vat: 'VAT',
    grossTotal: 'Gross Total',
    grossTotalUpper: 'GROSS TOTAL',
    preparedBy: 'Prepared by:',
    approvedBy: 'Approved by:',
    signatureLine: 'Name / Signature / Date',
    toc: 'Table of Contents',
    page: 'Page',
    of: 'of',
    billOfQuantities: 'Bill of Quantities',
    colNo: 'No.',
    colDescription: 'Description',
    colUnit: 'Unit',
    colQty: 'Qty',
    colUnitRate: 'Unit Rate',
    colTotal: 'Total',
    sectionSubtotal: 'Section Subtotal:',
    ungroupedItems: 'Ungrouped Items',
    costSummary: 'Cost Summary',
    colSection: 'Section',
    colSubtotal: 'Subtotal',
    colItem: 'Item',
    colAmount: 'Amount',
    boqReport: 'BOQ Report',
  },
};

/* ── Brand colours ──────────────────────────────────────────────────────── */

const BRAND_DARK = [15, 23, 42] as [number, number, number];     // slate-900
const BRAND_MID = [71, 85, 105] as [number, number, number];     // slate-600
const BRAND_LIGHT = [226, 232, 240] as [number, number, number]; // slate-200
const BRAND_ACCENT = [99, 102, 241] as [number, number, number]; // indigo-500
const WHITE = [255, 255, 255] as [number, number, number];

/* ── Shared table styling ───────────────────────────────────────────────── */
// Generous inner padding + vertical centering so text is never glued to the
// cell borders, plus a minimum row height for breathing room. Reused by every
// autoTable in the report so tables look consistent and professional.
const TABLE_STYLES: NonNullable<Parameters<typeof autoTable>[1]>['styles'] = {
  cellPadding: { top: 2.2, right: 3, bottom: 2.2, left: 3 },
  valign: 'middle',
  minCellHeight: 7,
  lineColor: BRAND_LIGHT,
  lineWidth: 0.15,
  overflow: 'linebreak',
};

/* ── Cover page ─────────────────────────────────────────────────────────── */

function renderCoverPage(
  doc: jsPDF,
  options: PdfReportOptions,
  locale: string,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = PDF_LABELS[pickPdfLang(locale)];

  const labelX = 20;                 // left margin (also used by signature block)
  const rightX = pageW - labelX;     // right margin — values align here

  // ── Header band (height adapts to how many lines the title wraps to) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  const titleLines = doc.splitTextToSize(options.boqTitle || '', pageW - labelX * 2) as string[];
  const titleLineH = 9;              // ≈ 24 pt in mm
  const titleTop = 28;
  const titleBottom = titleTop + (titleLines.length - 1) * titleLineH;
  const projectY = titleBottom + 10;
  const headerH = Math.max(58, (options.projectName ? projectY : titleBottom) + 16);

  // Dark band + accent stripe at its bottom edge
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, headerH, 'F');
  doc.setFillColor(...BRAND_ACCENT);
  doc.rect(0, headerH - 2.5, pageW, 2.5, 'F');

  // Title — WHITE on the dark band (was defaulting to black = invisible)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...WHITE);
  doc.text(titleLines, labelX, titleTop);

  // Project name under the title
  if (options.projectName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...BRAND_LIGHT);
    doc.text(options.projectName, labelX, projectY);
  }

  // ── Meta block below header (labels left, values right-aligned) ───────
  const itemCount = options.positions.filter((p) => !isSection(p)).length;
  const sectionCount = buildSectionGroups(options.positions).sections.length;
  const resourceCount = options.positions.reduce((sum, p) => {
    const meta = p.metadata ?? (p as unknown as Record<string, unknown>).metadata_;
    const res = meta && Array.isArray((meta as Record<string, unknown>).resources)
      ? ((meta as Record<string, unknown>).resources as unknown[]).length : 0;
    return sum + res;
  }, 0);

  const metaItems: Array<[string, string]> = [
    [L.date, formatDate(options.date, locale)],
    [L.sections, String(sectionCount)],
    [L.positions, String(itemCount)],
    ...(resourceCount > 0 ? [[L.resources, String(resourceCount)] as [string, string]] : []),
    [L.directCost, formatCurrency(options.directCost, options.currency, locale)],
    [L.markups, options.markupTotals.map((m) => `${m.name} ${m.percentage}%`).join(', ') || L.none],
    [L.netTotal, formatCurrency(options.netTotal, options.currency, locale)],
    [L.vat, `${(options.vatRate * 100).toFixed(0)}% (${formatCurrency(options.vatAmount, options.currency, locale)})`],
  ];

  const rowH = 9;
  const labelW = 45;                 // reserved width for the label column
  let y = headerH + 18;

  // Top divider
  doc.setDrawColor(...BRAND_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(labelX, y - 5, rightX, y - 5);

  doc.setFontSize(9.5);
  for (const [label, rawValue] of metaItems) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND_MID);
    doc.text(label, labelX, y);

    doc.setTextColor(...BRAND_DARK);
    const valueLines = doc.splitTextToSize(rawValue, rightX - labelX - labelW) as string[];
    doc.text(valueLines, rightX, y, { align: 'right' });
    y += rowH + (valueLines.length - 1) * 5;
  }

  // ── Gross total — highlighted row ─────────────────────────────────────
  const grossY = y + 1;
  doc.setDrawColor(...BRAND_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(labelX, grossY - 5, rightX, grossY - 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_ACCENT);
  doc.text(L.grossTotal, labelX, grossY);
  doc.text(formatCurrency(options.grossTotal, options.currency, locale), rightX, grossY, { align: 'right' });

  // ── Signature block ─────────────────────────────────────────────────
  const sigY = pageH - 55;
  doc.setDrawColor(...BRAND_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(labelX, sigY, pageW - 20, sigY);

  doc.setFontSize(8);
  doc.setTextColor(...BRAND_MID);
  doc.setFont('helvetica', 'normal');
  doc.text(L.preparedBy, labelX, sigY + 10);
  doc.text(L.approvedBy, pageW / 2, sigY + 10);
  doc.line(labelX, sigY + 28, labelX + 60, sigY + 28);
  doc.line(pageW / 2, sigY + 28, pageW / 2 + 60, sigY + 28);
  doc.text(L.signatureLine, labelX, sigY + 33);
  doc.text(L.signatureLine, pageW / 2, sigY + 33);

  // Footer attribution
}

/* ── Table of Contents ──────────────────────────────────────────────────── */

function renderTableOfContents(
  doc: jsPDF,
  sections: SectionEntry[],
  L: Record<string, string>,
): void {
  const pageW = doc.internal.pageSize.getWidth();

  // Section heading
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(L.toc, 20, 12);

  doc.setTextColor(...BRAND_DARK);

  let y = 32;
  doc.setFontSize(9);
  for (const sec of sections) {
    doc.setFont('helvetica', 'normal');
    const label = `${sec.ordinal}  ${sec.description}`.trim();
    const lines = doc.splitTextToSize(label, pageW - 80) as string[];
    doc.text(lines, 20, y);

    // Dot leaders
    const textW = doc.getTextWidth(lines[0] ?? '');
    const dotsStart = 20 + textW + 2;
    const dotsEnd = pageW - 35;
    doc.setTextColor(...BRAND_LIGHT);
    const dotStr = '.'.repeat(Math.max(0, Math.floor((dotsEnd - dotsStart) / 2)));
    doc.text(dotStr, dotsStart, y);
    doc.setTextColor(...BRAND_DARK);

    // Page reference (filled post-render; placeholder during TOC pass)
    doc.setFont('helvetica', 'bold');
    doc.text(String(sec.pageNumber || '—'), pageW - 30, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    y += lines.length * 6 + 2;
    if (y > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      y = 20;
    }
  }
}

/* ── Page footer ────────────────────────────────────────────────────────── */

function addPageFooters(doc: jsPDF, options: PdfReportOptions): void {
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = PDF_LABELS[pickPdfLang(options.locale)];

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(15, pageH - 12, pageW - 15, pageH - 12);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND_MID);
    doc.text(options.boqTitle, 15, pageH - 7);
    doc.text(`${L.page} ${i} ${L.of} ${totalPages}`, pageW - 15, pageH - 7, { align: 'right' });
  }
}

/* ── BOQ table per section ──────────────────────────────────────────────── */

function renderBOQTables(
  doc: jsPDF,
  options: PdfReportOptions,
  locale: string,
  sectionEntries: SectionEntry[],
): void {
  const { sections, ungrouped } = buildSectionGroups(options.positions);
  const pageW = doc.internal.pageSize.getWidth();
  const L = PDF_LABELS[pickPdfLang(locale)];

  // Section heading bar
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(L.billOfQuantities, 20, 12);
  doc.setTextColor(...BRAND_DARK);

  let currentY = 26;

  const headerStyles: Parameters<typeof autoTable>[1]['headStyles'] = {
    fillColor: BRAND_DARK,
    textColor: WHITE,
    fontStyle: 'bold',
    fontSize: 8,
  };

  const renderSection = (
    ordinal: string,
    description: string,
    children: Position[],
    subtotal: number,
  ) => {
    // Section title row
    const sectionLabel = `${ordinal}  ${description}`.trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_ACCENT);

    const labelLines = doc.splitTextToSize(sectionLabel, pageW - 40) as string[];
    doc.text(labelLines, 15, currentY);
    currentY += labelLines.length * 5 + 4;

    const body: string[][] = [];
    for (const p of children) {
      body.push([
        p.ordinal,
        p.description,
        p.unit,
        formatNumber(p.quantity, locale),
        formatCurrency(p.unit_rate, options.currency, locale),
        formatCurrency(p.total, options.currency, locale),
      ]);
      // Add resource sub-rows (skip when includeResources is explicitly false)
      if (options.includeResources !== false) {
      const meta = p.metadata ?? (p as unknown as Record<string, unknown>).metadata_;
      const resources = (meta && Array.isArray((meta as Record<string, unknown>).resources))
        ? (meta as Record<string, unknown>).resources as Array<{ name: string; type: string; unit: string; quantity: number; unit_rate: number; total?: number }>
        : [];
      for (const r of resources) {
        const rTotal = r.total ?? r.quantity * r.unit_rate;
        body.push([
          '',
          `  \u2514 ${r.name}`,
          r.unit,
          formatNumber(r.quantity, locale),
          formatCurrency(r.unit_rate, options.currency, locale),
          formatCurrency(rTotal, options.currency, locale),
        ]);
      }
      }
    }

    autoTable(doc, {
      startY: currentY,
      head: [[L.colNo, L.colDescription, L.colUnit, L.colQty, L.colUnitRate, L.colTotal]],
      body,
      styles: TABLE_STYLES,
      headStyles: headerStyles,
      bodyStyles: { fontSize: 8, textColor: BRAND_DARK },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 15, right: 15 },
      theme: 'grid',
      tableLineColor: BRAND_LIGHT,
      tableLineWidth: 0.2,
      didDrawPage: () => {
        // Reset current Y after page break inside autoTable
      },
    });

    const tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // Subtotal row — kept clear of the table above (was gluing to the header
    // row when a section had few/no line items).
    const subtotalY = tableEndY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND_MID);
    const subtotalText = `${L.sectionSubtotal} ${formatCurrency(subtotal, options.currency, locale)}`;
    doc.text(subtotalText, pageW - 15, subtotalY, { align: 'right' });
    doc.setDrawColor(...BRAND_ACCENT);
    doc.setLineWidth(0.4);
    doc.line(pageW - 15 - doc.getTextWidth(subtotalText) - 2, subtotalY + 1.5, pageW - 15, subtotalY + 1.5);

    currentY = subtotalY + 13;
    if (currentY > doc.internal.pageSize.getHeight() - 35) {
      doc.addPage();
      currentY = 20;
    }
  };

  // Record page numbers for TOC
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]!;
    const entry = sectionEntries[i];
    if (entry) {
      entry.pageNumber = (doc.internal as unknown as { getCurrentPageInfo: () => { pageNumber: number } }).getCurrentPageInfo().pageNumber;
    }
    renderSection(sec.ordinal, sec.description, sec.children, sec.subtotal);
  }

  // Ungrouped positions (if any)
  if (ungrouped.length > 0) {
    const ungroupedSubtotal = ungrouped.reduce((sum, p) => sum + p.total, 0);
    renderSection('', L.ungroupedItems, ungrouped, ungroupedSubtotal);
  }
}

/* ── Summary page ───────────────────────────────────────────────────────── */

function renderSummary(
  doc: jsPDF,
  options: PdfReportOptions,
  locale: string,
): void {
  doc.addPage();
  const pageW = doc.internal.pageSize.getWidth();
  const L = PDF_LABELS[pickPdfLang(locale)];

  // Heading
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(L.costSummary, 20, 12);

  // Section subtotals table
  const { sections, ungrouped } = buildSectionGroups(options.positions);
  const sectionRows = sections.map((s) => [
    `${s.ordinal}  ${s.description}`.trim(),
    formatCurrency(s.subtotal, options.currency, locale),
  ]);
  if (ungrouped.length > 0) {
    const ungroupedTotal = ungrouped.reduce((sum, p) => sum + p.total, 0);
    sectionRows.push([L.ungroupedItems, formatCurrency(ungroupedTotal, options.currency, locale)]);
  }

  if (sectionRows.length > 0) {
    autoTable(doc, {
      startY: 24,
      head: [[L.colSection, L.colSubtotal]],
      body: sectionRows,
      styles: TABLE_STYLES,
      headStyles: { fillColor: BRAND_MID, textColor: WHITE, fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: BRAND_DARK },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
      theme: 'grid',
      tableLineColor: BRAND_LIGHT,
      tableLineWidth: 0.2,
    });
  }

  const afterSectionsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 24;

  // Financial summary table
  const summaryRows: [string, string][] = [
    [L.directCost, formatCurrency(options.directCost, options.currency, locale)],
  ];

  for (const m of options.markupTotals) {
    summaryRows.push([
      `${m.name} (${m.percentage}%)`,
      formatCurrency(m.amount, options.currency, locale),
    ]);
  }

  const vatLabel = `${L.vat} (${(options.vatRate * 100).toFixed(0)}%)`;

  autoTable(doc, {
    startY: afterSectionsY + 10,
    head: [[L.colItem, L.colAmount]],
    body: [
      ...summaryRows,
      [L.netTotal, formatCurrency(options.netTotal, options.currency, locale)],
      [vatLabel, formatCurrency(options.vatAmount, options.currency, locale)],
    ],
    styles: TABLE_STYLES,
    headStyles: { fillColor: BRAND_MID, textColor: WHITE, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: BRAND_DARK },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
    theme: 'grid',
    tableLineColor: BRAND_LIGHT,
    tableLineWidth: 0.2,
  });

  const afterSummaryY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? afterSectionsY + 10;

  // Gross total highlight box — text vertically centred in the box
  const boxY = afterSummaryY + 8;
  const boxH = 18;
  doc.setFillColor(...BRAND_DARK);
  doc.roundedRect(15, boxY, pageW - 30, boxH, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  const boxMidY = boxY + boxH / 2;
  doc.text(L.grossTotalUpper, 22, boxMidY, { baseline: 'middle' });
  doc.text(formatCurrency(options.grossTotal, options.currency, locale), pageW - 22, boxMidY, { align: 'right', baseline: 'middle' });
}

/* ── Main export function ───────────────────────────────────────────────── */

/**
 * Generates a professional A4 PDF report for a BOQ and triggers a browser
 * download. The report includes:
 *  - Cover page with project name, BOQ title, date, and key metrics
 *  - Table of Contents (when there are multiple sections)
 *  - BOQ tables grouped by section with subtotals
 *  - Cost summary: Direct Cost, Markups (itemised), Net Total, VAT, Gross Total
 *  - Page footers with "Page X of Y"
 */
export function generateBOQPdf(options: PdfReportOptions): void {
  const locale = options.locale ?? 'es-ES';
  const L = PDF_LABELS[pickPdfLang(locale)];

  const doc = new jsPDF({
    orientation: options.landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // PDF metadata — embedded identity markers
  doc.setProperties({
    title: options.projectName || L.boqReport,
    subject: L.billOfQuantities,
  });

  // ── 1. Cover page ──────────────────────────────────────────────────────
  renderCoverPage(doc, options, locale);

  // ── 2. Prepare section entries for TOC ────────────────────────────────
  const { sections } = buildSectionGroups(options.positions);
  const sectionEntries: SectionEntry[] = sections.map((s) => ({
    ordinal: s.ordinal,
    description: s.description,
    subtotal: s.subtotal,
    pageNumber: 0,
  }));

  // ── 3. Table of Contents (only if there are multiple sections) ─────────
  const hasTOC = sections.length > 1;
  if (hasTOC) {
    doc.addPage();
    // TOC is rendered with placeholder page numbers first; we re-render
    // it after the BOQ tables to fill in correct page references.
    renderTableOfContents(doc, sectionEntries, L);
  }

  // ── 4. BOQ tables ──────────────────────────────────────────────────────
  doc.addPage();
  renderBOQTables(doc, options, locale, sectionEntries);

  // ── 5. Re-render TOC with actual page numbers ─────────────────────────
  if (hasTOC) {
    // TOC is on page 2 (cover is page 1)
    doc.setPage(2);
    // Clear the page by drawing white rectangle
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...WHITE);
    doc.rect(0, 0, pageW, pageH, 'F');
    renderTableOfContents(doc, sectionEntries, L);
  }

  // ── 6. Summary page ────────────────────────────────────────────────────
  renderSummary(doc, options, locale);

  // ── 7. Page footers ────────────────────────────────────────────────────
  addPageFooters(doc, options);

  // ── 8. Download ───────────────────────────────────────────────────────
  const safeName = options.boqTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'BOQ';
  doc.save(`${safeName}.pdf`);
}
