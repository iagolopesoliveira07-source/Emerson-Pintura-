import { formatCurrency } from './formatters';
import { buildRelatorioExecutivo } from './relatorioExecutivo';

const INK = [46, 26, 71];
const ACCENT = [122, 62, 177];
const GREEN = [67, 176, 42];
const RED = [229, 57, 53];
const MUTED = [107, 114, 128];
const LINE = [226, 228, 233];
const WASH = [247, 246, 250];
const WHITE = [255, 255, 255];
const AMBER = [176, 112, 36];

const MARGIN = 13;
const FOOTER = 10;
const MAX_PAGES = 3;

function money(value) {
  return formatCurrency(value).replace(/\u00a0|\u202f|\u2009/g, ' ');
}

function moneyOrDash(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return money(value);
}

function pdfSafe(value) {
  return String(value ?? '')
    .replace(/\u00a0|\u202f|\u2009/g, ' ')
    .replace(/\u2013|\u2014/g, '-');
}

function moneyColor(value) {
  if (value > 0.004) return GREEN;
  if (value < -0.004) return RED;
  return INK;
}

function ellipsize(doc, text, maxW) {
  const value = pdfSafe(text);
  if (doc.getTextWidth(value) <= maxW) return value;
  let t = value;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxW) t = t.slice(0, -1);
  return `${t}...`;
}

function fileStamp(period) {
  const inicio = period?.range?.inicio;
  const fim = period?.range?.fim;
  if (inicio && fim) return `${inicio}_a_${fim}`;
  if (inicio) return inicio;
  return `todos_${new Date().toISOString().slice(0, 10)}`;
}

async function loadLogoDataUrl() {
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

function linhaEmpresa(modelo, id) {
  return (modelo.empresaGastos.linhas || []).find((item) => item.id === id)?.total || 0;
}

function resultadoObraTexto(obra) {
  const valor = money(obra.resultadoValor);
  if (obra.resultadoTipo === 'parcial') return `Resultado parcial  ${valor}`;
  if (obra.resultadoTipo === 'lucro') return `Lucro  ${valor}`;
  if (obra.resultadoTipo === 'prejuizo') return `Prejuízo  ${valor}`;
  return `${obra.resultadoLabel}  ${valor}`;
}

export async function gerarRelatorioEmpresaPdf(params) {
  const modelo = buildRelatorioExecutivo(params);
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableMod.default || autoTableMod;
  const logo = await loadLogoDataUrl();
  const limits = {
    maxObras: Math.max(3, (modelo.obras || []).length),
    maxFunc: Math.max(3, (modelo.funcionarios.tabela || []).length),
  };

  function make() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    render(doc, modelo, logo, autoTable, limits);
    return doc;
  }

  let doc = make();
  for (let i = 0; i < 6 && doc.getNumberOfPages() > MAX_PAGES; i += 1) {
    limits.maxObras = Math.max(3, Math.ceil(limits.maxObras * 0.65));
    limits.maxFunc = Math.max(3, Math.ceil(limits.maxFunc * 0.65));
    doc = make();
  }
  while (doc.getNumberOfPages() > MAX_PAGES) doc.deletePage(doc.getNumberOfPages());
  doc.save(`Emerson-Pinturas-Relatorio-${fileStamp(params.period)}.pdf`);
}

function render(doc, modelo, logo, autoTable, limits = {}) {
  const maxObrasLimit = limits.maxObras ?? 99;
  const maxFuncLimit = limits.maxFunc ?? 99;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  let y = 0;
  const bottom = () => pageH - FOOTER - 2;

  function remaining() {
    return bottom() - y;
  }

  function addPage() {
    if (doc.getNumberOfPages() >= MAX_PAGES) return false;
    doc.addPage();
    y = 16;
    return true;
  }

  function need(h) {
    if (y + h <= bottom()) return true;
    return addPage();
  }

  function fitRows(count, rowH, reserved) {
    const pagesLeft = Math.max(0, MAX_PAGES - doc.getNumberOfPages());
    let space = remaining() - 8;
    if (pagesLeft > 0) space += pagesLeft * 242;
    space -= reserved;
    return Math.max(3, Math.min(count, Math.floor(Math.max(space, rowH) / rowH)));
  }

  function section(title) {
    const first = y < 36;
    need(first ? 7 : 10);
    if (!first) {
      y += 1.6;
      doc.setDrawColor(...INK);
      doc.setLineWidth(0.55);
      doc.line(MARGIN, y, MARGIN + contentW, y);
      y += 3.6;
    }
    doc.setFillColor(...ACCENT);
    doc.rect(MARGIN, y, 2, 5.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(title), MARGIN + 5, y + 4.2);
    y += 8;
  }

  function note(text) {
    const lines = doc.splitTextToSize(pdfSafe(text), contentW);
    need(lines.length * 3.3 + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(lines, MARGIN, y);
    y += lines.length * 3.2 + 1.2;
  }

  function cards(items, cols = 3, h = 16.5) {
    const gap = 2.4;
    const w = (contentW - gap * (cols - 1)) / cols;
    const rows = Math.ceil(items.length / cols);
    need(rows * (h + gap));
    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MARGIN + col * (w + gap);
      const cy = y + row * (h + gap);
      doc.setFillColor(...WASH);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.16);
      doc.roundedRect(x, cy, w, h, 1.1, 1.1, 'FD');
      doc.setFillColor(...(item.bar || ACCENT));
      doc.rect(x, cy, 1.5, h, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(...MUTED);
      doc.text(ellipsize(doc, pdfSafe(item.label).toUpperCase(), w - 6), x + 4, cy + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...(item.color || INK));
      doc.text(ellipsize(doc, item.value, w - 6), x + 4, cy + 12.2);
    });
    y += rows * (h + gap);
  }

  function table(columns, body, opts = {}) {
    const { moneyKeys = [], empty = 'Sem dados neste período.', fontSize = 7.2, columnStyles = {} } = opts;
    if (!body.length) {
      note(empty);
      return;
    }
    need(16);
    autoTable(doc, {
      startY: y,
      columns,
      body,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
        textColor: INK,
        overflow: 'ellipsize',
        valign: 'middle',
      },
      headStyles: {
        fillColor: WASH,
        textColor: INK,
        fontStyle: 'bold',
        fontSize,
      },
      alternateRowStyles: { fillColor: WASH },
      columnStyles: {
        ...Object.fromEntries(moneyKeys.map((key) => [key, { halign: 'right' }])),
        ...columnStyles,
      },
      margin: { left: MARGIN, right: MARGIN, top: 16, bottom: FOOTER + 2 },
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (!moneyKeys.includes(data.column.dataKey)) return;
        const raw = data.cell.raw;
        if (raw == null || raw === '') {
          data.cell.text = ['—'];
          return;
        }
        data.cell.text = [money(Number(raw) || 0)];
      },
    });
    y = (doc.lastAutoTable?.finalY || y) + 2.2;
  }

  function pairList(x, top, width, title, rows, totalLabel, totalValue) {
    const rowH = 5.15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(title), x, top + 1);
    rows.forEach((row, i) => {
      const cy = top + 6.4 + i * rowH;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...INK);
      doc.text(ellipsize(doc, row.label, width - 32), x, cy);
      doc.setFont('helvetica', 'bold');
      doc.text(money(row.total), x + width, cy, { align: 'right' });
    });
    const ty = top + 6.4 + rows.length * rowH + 1.6;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(x, ty - 2.4, x + width, ty - 2.4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.text(pdfSafe(totalLabel), x, ty + 2.2);
    doc.text(money(totalValue), x + width, ty + 2.2, { align: 'right' });
    return 7 + rows.length * rowH + 7.2;
  }

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
  doc.text(pdfSafe(modelo.empresa || 'Emerson Pinturas').toUpperCase(), textX, 12);
  doc.setTextColor(...INK);
  doc.setFontSize(13);
  doc.text('Relatório da empresa', textX, 18.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(pdfSafe(`${modelo.periodoLabel} · Emitido em ${modelo.geradoEm}`), textX, 23.2);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 27, pageW - MARGIN, 27);
  y = 32;

  const interno = modelo.interno || {};
  cards([
    { label: 'Entradas reais', value: money(interno.entradasReais || 0), bar: INK },
    { label: 'Parte da Emerson', value: money(interno.parteEmerson || 0), bar: ACCENT },
    { label: 'Gastos da empresa', value: money(interno.gastosInternos || 0) },
    {
      label: 'Resultado interno',
      value: money(interno.resultadoInterno || 0),
      color: moneyColor(interno.resultadoInterno || 0),
      bar: (interno.resultadoInterno || 0) < -0.004 ? RED : (interno.resultadoInterno || 0) > 0.004 ? GREEN : ACCENT,
    },
    {
      label: 'Ainda por receber',
      value: money(modelo.resumo.aReceber),
      color: modelo.resumo.aReceber > 0.004 ? AMBER : INK,
      bar: modelo.resumo.aReceber > 0.004 ? AMBER : ACCENT,
    },
    { label: 'IVA dedutível', value: moneyOrDash(modelo.resumo.ivaDedutivel) },
  ]);

  if (modelo.parcerias?.quantidade) {
    section('Obras em parceria');
    note('Nas parcerias, a parte da Emerson vem do Acerto concluído. Reembolso não é lucro. Recebimento ainda sem Acerto não entra no resultado.');
    cards(
      [
        { label: 'Parte econômica da Emerson', value: money(interno.parteEmerson || 0), bar: INK },
        {
          label: 'Reembolsos, não são lucro',
          value: money(interno.reembolsosEmerson || 0),
          bar: ACCENT,
        },
        {
          label: 'Ainda não acertado',
          value: money(interno.parceriaPendente || 0),
          color: (interno.parceriaPendente || 0) > 0.004 ? AMBER : INK,
          bar: (interno.parceriaPendente || 0) > 0.004 ? AMBER : ACCENT,
        },
      ],
      3,
      16.5
    );
  }

  section('Obras');
  const obrasRows = (modelo.obras || []).map((obra) => ({
    nome: `${obra.credito ? `${obra.nome} (crédito)` : obra.nome}${obra.parceria ? ' (parceria)' : ''}`,
    status: obra.status,
    valor: obra.valorObraInformado ? obra.valorObra : null,
    recebido: obra.recebido,
    aReceber: obra.aReceber == null || !obra.valorObraInformado ? null : obra.aReceber,
    gastos: obra.totalGasto,
    resultado: resultadoObraTexto(obra),
  }));
  if (!obrasRows.length) {
    note('Nenhuma obra com movimento neste período.');
  } else {
    const max = Math.min(maxObrasLimit, fitRows(obrasRows.length, 6.3, 128));
    let shown = obrasRows;
    if (obrasRows.length > max) {
      const rest = obrasRows.slice(max - 1);
      shown = [
        ...obrasRows.slice(0, max - 1),
        {
          nome: `Outras (${rest.length})`,
          status: '—',
          valor: null,
          recebido: rest.reduce((s, o) => s + (Number(o.recebido) || 0), 0),
          aReceber: rest.reduce((s, o) => s + (Number(o.aReceber) || 0), 0),
          gastos: rest.reduce((s, o) => s + (Number(o.gastos) || 0), 0),
          resultado: 'Ver PDF individual',
        },
      ];
    }
    table(
      [
        { header: 'Obra', dataKey: 'nome' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Valor', dataKey: 'valor' },
        { header: 'Recebido', dataKey: 'recebido' },
        { header: 'A receber', dataKey: 'aReceber' },
        { header: 'Gastos', dataKey: 'gastos' },
        { header: 'Resultado', dataKey: 'resultado' },
      ],
      shown,
      {
        moneyKeys: ['valor', 'recebido', 'aReceber', 'gastos'],
        fontSize: 6.9,
        columnStyles: {
          nome: { cellWidth: 36 },
          status: { cellWidth: 22 },
          resultado: { cellWidth: 38 },
        },
      }
    );
  }

  section('Funcionários e diárias');
  cards(
    [
      { label: 'Total de diárias', value: String(modelo.funcionarios.diarias) },
      { label: 'Total gasto com mão de obra', value: money(modelo.funcionarios.custoDiarias) },
      { label: 'Total pago', value: money(modelo.funcionarios.pago), color: GREEN, bar: GREEN },
      {
        label: 'Total pendente',
        value: money(modelo.funcionarios.pendente),
        color: modelo.funcionarios.pendente > 0.004 ? AMBER : INK,
        bar: modelo.funcionarios.pendente > 0.004 ? AMBER : ACCENT,
      },
    ],
    4,
    15.2
  );
  const funcRows = (modelo.funcionarios.tabela || []).map((row) => ({
    nome: row.nome,
    quantidade: row.quantidade,
    total: row.total,
    pago: Math.max(0, (Number(row.total) || 0) - (Number(row.pendente) || 0)),
    pendente: row.pendente || 0,
  }));
  const maxFunc = Math.min(maxFuncLimit, fitRows(funcRows.length, 5.5, 96));
  let funcShown = funcRows;
  if (funcRows.length > maxFunc) {
    const rest = funcRows.slice(maxFunc - 1);
    funcShown = [
      ...funcRows.slice(0, maxFunc - 1),
      {
        nome: `Outros (${rest.length})`,
        quantidade: rest.reduce((s, r) => s + (Number(r.quantidade) || 0), 0),
        total: rest.reduce((s, r) => s + (Number(r.total) || 0), 0),
        pago: rest.reduce((s, r) => s + (Number(r.pago) || 0), 0),
        pendente: rest.reduce((s, r) => s + (Number(r.pendente) || 0), 0),
      },
    ];
  }
  table(
    [
      { header: 'Funcionário', dataKey: 'nome' },
      { header: 'N.º de diárias', dataKey: 'quantidade' },
      { header: 'Valor total', dataKey: 'total' },
      { header: 'Pago', dataKey: 'pago' },
      { header: 'Pendente', dataKey: 'pendente' },
    ],
    funcShown,
    {
      moneyKeys: ['total', 'pago', 'pendente'],
      empty: 'Sem diárias neste período.',
      columnStyles: { quantidade: { halign: 'right', cellWidth: 26 } },
    }
  );

  section('Gastos');
  const obrasGastos = [
    { label: 'Materiais', total: modelo.gastosObras.materiais },
    { label: 'Mão de obra', total: modelo.gastosObras.maoDeObra },
    { label: 'Outros custos de obra', total: modelo.gastosObras.outros },
    { label: 'Sem obra específica', total: modelo.gastosObras.semObra.total },
  ].filter((item) => Math.abs(item.total) > 0.004);
  const empresaGastos = [
    { label: 'Gastos fixos', total: linhaEmpresa(modelo, 'fixos') },
    { label: 'Combustível', total: linhaEmpresa(modelo, 'combustivel') },
    { label: 'Via Verde', total: linhaEmpresa(modelo, 'viaVerde') },
    { label: 'Seguros', total: linhaEmpresa(modelo, 'seguros') },
    { label: 'Garagem / aluguel', total: linhaEmpresa(modelo, 'aluguel') },
    {
      label: 'Viaturas / manutenção',
      total: (linhaEmpresa(modelo, 'viaturas') || 0) + (linhaEmpresa(modelo, 'manutencao') || 0),
    },
    {
      label: 'Outros gastos relevantes',
      total: (linhaEmpresa(modelo, 'outros') || 0) + (linhaEmpresa(modelo, 'agua') || 0),
    },
  ].filter((item) => Math.abs(item.total) > 0.004);
  const totalObras =
    modelo.gastosObras.materiais +
    modelo.gastosObras.maoDeObra +
    modelo.gastosObras.outros +
    modelo.gastosObras.semObra.total;
  const totalEmpresa = modelo.resumo.gastosEmpresa;
  const colGap = 8;
  const colW = (contentW - colGap) / 2;
  const leftH = 7 + Math.max(obrasGastos.length, 1) * 5.15 + 7.2;
  const rightH = 7 + Math.max(empresaGastos.length, 1) * 5.15 + 7.2;
  const blockH = Math.max(leftH, rightH);
  if (remaining() < blockH + 12) addPage();
  const top = y;
  if (obrasGastos.length) {
    pairList(MARGIN, top, colW, 'GASTOS DAS OBRAS', obrasGastos, 'Total gastos das obras', totalObras);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(...INK);
    doc.text('GASTOS DAS OBRAS', MARGIN, top + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('Sem gastos neste período.', MARGIN, top + 7);
  }
  if (empresaGastos.length) {
    pairList(
      MARGIN + colW + colGap,
      top,
      colW,
      'GASTOS DA EMPRESA',
      empresaGastos,
      'Total gastos da empresa',
      totalEmpresa
    );
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(...INK);
    doc.text('GASTOS DA EMPRESA', MARGIN + colW + colGap, top + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('Sem gastos neste período.', MARGIN + colW + colGap, top + 7);
  }
  y = top + blockH + 2;
  need(10);
  doc.setFillColor(...INK);
  doc.roundedRect(MARGIN, y, contentW, 8.2, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...WHITE);
  doc.text('Total geral', MARGIN + 3.5, y + 5.4);
  doc.text(money(modelo.resumo.gastosTotais), MARGIN + contentW - 3.5, y + 5.4, { align: 'right' });
  y += 11;

  section('IVA');
  if (!modelo.iva.disponivel) {
    note('Dados não disponíveis para parte deste período.');
  } else {
    const nc = modelo.iva.notasCredito;
    cards(
      [
        { label: 'IVA registado', value: moneyOrDash(modelo.iva.total) },
        { label: 'IVA dedutível', value: moneyOrDash(modelo.iva.dedutivel), color: GREEN, bar: GREEN },
        { label: 'IVA não dedutível', value: moneyOrDash(modelo.iva.naoDedutivel) },
        {
          label: nc.quantidade ? `Notas de crédito (${nc.quantidade})` : 'Notas de crédito',
          value: nc.quantidade ? money(nc.total) : 'Nenhuma',
        },
      ],
      4,
      15.2
    );
    if (modelo.iva.incompleto) {
      note('Dados não disponíveis para parte deste período.');
    }
  }

  section('Resultado interno');
  const resultadoInterno = interno.resultadoInterno || 0;
  const resultRows = [
    { label: 'Entradas das obras da Emerson', value: money(interno.entradasNormais || 0) },
    { label: 'Parte da Emerson nos acertos', value: money(interno.parteEmerson || 0), tone: 'received' },
    { label: 'Gastos da empresa', value: money(interno.gastosInternos || 0), dim: true },
  ];
  const rowH = 6;
  const boxH = 10 + resultRows.length * rowH + 14;
  need(boxH + 2);
  doc.setFillColor(46, 26, 71);
  doc.roundedRect(MARGIN, y, contentW, boxH, 1.6, 1.6, 'F');
  let cy = y + 7.2;
  resultRows.forEach((row, i) => {
    doc.setFont('helvetica', row.dim ? 'normal' : 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...(row.dim ? [196, 186, 214] : WHITE));
    doc.text(pdfSafe(row.label), MARGIN + 5, cy);
    doc.setFont('helvetica', 'bold');
    let valueColor = WHITE;
    if (row.tone === 'received') valueColor = GREEN;
    if (row.tone === 'pending' && modelo.resumo.aReceber > 0.004) valueColor = [255, 196, 120];
    doc.setTextColor(...valueColor);
    doc.text(pdfSafe(row.value), MARGIN + contentW - 5, cy, { align: 'right' });
    cy += rowH;
  });
  doc.setFillColor(...(resultadoInterno < -0.004 ? RED : GREEN));
  doc.roundedRect(MARGIN + 4, cy - 1, contentW - 8, 10, 1.1, 1.1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text('RESULTADO INTERNO', MARGIN + 7, cy + 5.6);
  doc.setFontSize(11);
  doc.text(money(resultadoInterno), MARGIN + contentW - 7, cy + 5.8, { align: 'right' });
  y += boxH + 2;

  while (doc.getNumberOfPages() > MAX_PAGES) doc.deletePage(doc.getNumberOfPages());
  const totalPages = Math.min(doc.getNumberOfPages(), MAX_PAGES);
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`${pdfSafe(modelo.empresa || 'Emerson Pinturas')}  ·  Relatório da empresa`, MARGIN, 8);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, 10.5, pageW - MARGIN, 10.5);
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageH - 8.2, pageW - MARGIN, pageH - 8.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(modelo.empresa || 'Emerson Pinturas'), MARGIN, pageH - 4.6);
    doc.text(`Página ${i} de ${totalPages}`, pageW - MARGIN, pageH - 4.6, { align: 'right' });
  }
}
