import { formatCurrency } from './formatters';

export const INK = [46, 26, 71];
export const ACCENT = [122, 62, 177];
export const GREEN = [67, 176, 42];
export const RED = [229, 57, 53];
export const MUTED = [107, 114, 128];
export const LINE = [229, 231, 235];
export const WASH = [245, 247, 250];
export const WHITE = [255, 255, 255];
export const AMBER = [180, 120, 40];

export const MARGIN = 14;
export const FOOTER = 11;

export function money(value) {
  return formatCurrency(value).replace(/\u00a0|\u202f|\u2009/g, ' ');
}

export function moneyOrDash(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return money(value);
}

export function pdfSafe(value) {
  return String(value ?? '')
    .replace(/\u00a0|\u202f|\u2009/g, ' ')
    .replace(/\u2013|\u2014/g, '-');
}

export function moneyColor(value) {
  if (value > 0.004) return GREEN;
  if (value < -0.004) return RED;
  return INK;
}

export function ellipsize(doc, text, maxW) {
  const value = pdfSafe(text);
  if (doc.getTextWidth(value) <= maxW) return value;
  let t = value;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxW) {
    t = t.slice(0, -1);
  }
  return `${t}...`;
}

export async function loadLogoDataUrl() {
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Motor visual do primeiro PDF da empresa: capa, KPIs, tabelas e cartões.
 * maxPages limita quebras; 0 = sem limite.
 */
export function createRelatorioPdfRenderer(doc, autoTable, options = {}) {
  const {
    logo,
    empresa = 'Emerson Pinturas',
    titulo = 'Relatório da Empresa',
    periodoLabel = '',
    geradoEm = '',
    qualidade = null,
    maxPages = 0,
  } = options;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  let y = 0;
  const bottomLimit = () => pageH - FOOTER - 3;

  function remaining() {
    return bottomLimit() - y;
  }

  function addPage() {
    if (maxPages && doc.getNumberOfPages() >= maxPages) return false;
    doc.addPage();
    y = 16;
    return true;
  }

  function need(height) {
    if (y + height <= bottomLimit()) return true;
    return addPage();
  }

  function sectionTitle(title) {
    need(8);
    if (y > 20) y += 1.6;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, MARGIN + contentW, y);
    y += 4.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(title), MARGIN, y);
    y += 4.4;
  }

  function note(text) {
    const lines = doc.splitTextToSize(pdfSafe(text), contentW);
    need(lines.length * 3.4 + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(lines, MARGIN, y);
    y += lines.length * 3.2 + 1.2;
  }

  function kpis(items, cols = 3, h = 12) {
    const gap = 3;
    const w = (contentW - gap * (cols - 1)) / cols;
    const rows = Math.ceil(items.length / cols);
    need(rows * (h + 1.5) + 1);
    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = MARGIN + col * (w + gap);
      const cy = y + row * (h + 1.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(ellipsize(doc, pdfSafe(item.label), w - 1), x, cy + 3.2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...(item.color || INK));
      doc.text(ellipsize(doc, item.value, w - 1), x, cy + 8.4);
    });
    y += rows * (h + 1.5) + 1.5;
  }

  function kv(label, value, x, cy, w, color = INK) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(label), x, cy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...color);
    doc.text(pdfSafe(value), x + w, cy, { align: 'right' });
  }

  function table(columns, body, opts = {}) {
    const {
      moneyKeys = [],
      signKey = null,
      empty = 'Sem dados.',
      fontSize = 8,
      columnStyles = {},
    } = opts;
    if (!body.length) {
      note(empty);
      return;
    }
    need(14);
    autoTable(doc, {
      startY: y,
      columns,
      body,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize,
        cellPadding: { top: 1.35, bottom: 1.35, left: 1.5, right: 1.5 },
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.12,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: WASH,
        textColor: INK,
        fontStyle: 'bold',
        fontSize,
        lineColor: LINE,
        lineWidth: 0.15,
      },
      alternateRowStyles: { fillColor: WASH },
      columnStyles: {
        ...Object.fromEntries(
          moneyKeys.map((key) => [key, { halign: 'right', cellWidth: moneyKeys.length > 4 ? 22 : 28 }])
        ),
        ...columnStyles,
      },
      margin: { left: MARGIN, right: MARGIN, top: 14, bottom: FOOTER + 2 },
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const key = data.column.dataKey;
        if (moneyKeys.includes(key)) {
          const raw = data.cell.raw;
          if (raw == null || raw === '') {
            data.cell.text = ['—'];
            return;
          }
          const n = Number(raw) || 0;
          data.cell.text = [money(n)];
          if (signKey && key === signKey) data.cell.styles.textColor = moneyColor(n);
        }
      },
    });
    y = (doc.lastAutoTable?.finalY || y) + 2.4;
  }

  function drawCover() {
    let textX = MARGIN;
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', MARGIN, 8, 11, 11);
        textX = MARGIN + 14;
      } catch {
        textX = MARGIN;
      }
    }
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(pdfSafe(empresa).toUpperCase(), textX, 12);
    doc.setTextColor(...INK);
    doc.setFontSize(13);
    doc.text(pdfSafe(titulo), textX, 18.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const meta = [periodoLabel, geradoEm && `Emitido em ${geradoEm}`, qualidade === 'Parcial' ? 'Dados parciais' : '']
      .filter(Boolean)
      .join('   ·   ');
    if (meta) doc.text(pdfSafe(meta), textX, 23.2);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 27, pageW - MARGIN, 27);
    y = 32;
  }

  function drawResultadoBox(rows, resultLabel, resultValue) {
    const rowH = 5.8;
    const boxH = 8 + rows.length * rowH + 12;
    need(boxH + 2);
    const startY = y;
    doc.setFillColor(...WASH);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN, startY, contentW, boxH, 1.4, 1.4, 'FD');
    let cy = startY + 6.5;
    rows.forEach((row, index) => {
      doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(`${row.subtract ? '- ' : ''}${pdfSafe(row.label)}`, MARGIN + 4, cy);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(row.color || INK));
      doc.text(pdfSafe(row.value), MARGIN + contentW - 4, cy, { align: 'right' });
      cy += rowH;
    });
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.35);
    doc.line(MARGIN + 4, cy - 1.2, MARGIN + contentW - 4, cy - 1.2);
    cy += 5.4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(resultLabel), MARGIN + 4, cy);
    doc.setTextColor(...moneyColor(resultValue));
    doc.text(money(resultValue), MARGIN + contentW - 4, cy, { align: 'right' });
    y = startY + boxH + 2.2;
  }

  function drawFooters() {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      if (i > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(`${pdfSafe(empresa)}  ·  ${pdfSafe(titulo)}`, MARGIN, 8);
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, 10.5, pageW - MARGIN, 10.5);
      }
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, pageH - 9, pageW - MARGIN, pageH - 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(pdfSafe(empresa), MARGIN, pageH - 5.2);
      doc.text(`Página ${i} de ${totalPages}`, pageW - MARGIN, pageH - 5.2, { align: 'right' });
    }
  }

  function capPages() {
    if (!maxPages) return;
    while (doc.getNumberOfPages() > maxPages) {
      doc.deletePage(doc.getNumberOfPages());
    }
  }

  return {
    pageW,
    pageH,
    contentW,
    get y() {
      return y;
    },
    set y(value) {
      y = value;
    },
    remaining,
    addPage,
    need,
    sectionTitle,
    note,
    kpis,
    kv,
    table,
    drawCover,
    drawResultadoBox,
    drawFooters,
    capPages,
    bottomLimit,
  };
}
