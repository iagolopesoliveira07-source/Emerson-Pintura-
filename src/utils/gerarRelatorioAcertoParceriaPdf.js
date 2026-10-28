import { formatDate, formatDateTime } from './formatters';
import { roundMoney } from './ivaCalculations';
import { asRecordList } from './safeCollections';
import { calculoFromAcertoFechado, isAcerto1HistoricoBraga4, isAcerto2HistoricoSintra, tituloAcertoParceria } from './obraParceriaAcertos';
import {
  INK,
  LINE,
  WASH,
  createRelatorioPdfRenderer,
  loadLogoDataUrl,
  money,
  pdfSafe,
} from './pdfRelatorioLayout';

function slug(value) {
  return String(value || 'obra')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function n(value) {
  return roundMoney(Number(value) || 0);
}

function pessoasResultado(lista) {
  return asRecordList(lista).map((pessoa) => {
    const reembolso = n(pessoa.reembolso);
    const lucro = n(pessoa.lucro);
    const totalDestinado =
      pessoa.totalDestinado != null ? n(pessoa.totalDestinado) : n(reembolso + lucro);
    return {
      key: pessoa.key,
      nome: pessoa.nome || '—',
      percentagem: pessoa.percentagem,
      reembolso,
      lucro,
      totalDestinado,
    };
  });
}

function nomePessoa(key) {
  if (key === 'fabio') return 'Fábio';
  if (key === 'juliano') return 'Juliano';
  if (key === 'caixa') return 'Caixa da parceria';
  if (key === 'emerson') return 'Emerson';
  return key || '—';
}

export function buildAcertoParceriaPdfModelo({ obra, acerto, configuracoes = {} } = {}) {
  if (!obra || !acerto?.id) return null;
  const historico =
    isAcerto2HistoricoSintra(obra, acerto) ||
    isAcerto1HistoricoBraga4(obra, acerto) ||
    acerto.historicalSnapshotLocked ||
    acerto.valoresConsolidados ||
    acerto.historicalConsolidatedValues;
  const temSnapshot = acerto.snapshot && typeof acerto.snapshot === 'object';
  const calc = temSnapshot || historico ? calculoFromAcertoFechado(obra, acerto) : null;
  const snapshot = temSnapshot ? acerto.snapshot : {};
  const base = calc || snapshot;
  const fechamento = calc?.fechamento || null;
  const tipo =
    acerto.tipoHistorico ||
    snapshot.tipoHistorico ||
    (calc?.reembolsoConsolidadoHistorico ? 'reembolso-divisao' : '');
  const pessoas = pessoasResultado(base.pessoas);
  const emerson = pessoas.find((pessoa) => pessoa.key === 'emerson');
  const reembolsoEmerson =
    tipo === 'reembolso-divisao'
      ? n(base.reembolsoConsolidadoEmerson || emerson?.reembolso)
      : n(emerson?.reembolso);
  const flagDistribuir = fechamento?.distribuirLucro ?? base.distribuirLucro ?? snapshot.distribuirLucro;
  const distribuido = n(fechamento?.lucroDistribuido ?? base.lucroDistribuir);
  const distribuir =
    flagDistribuir === true ||
    tipo === 'divisao-direta' ||
    tipo === 'reembolso-divisao' ||
    (flagDistribuir !== false && (distribuido > 0.004 || pessoas.some((pessoa) => pessoa.lucro > 0.004)));
  const custosLinhas = asRecordList(base.custosDescontados);
  const consolidado = Boolean(
    calc?.valoresConsolidados || calc?.diariasJaIncluidas || acerto.valoresConsolidados || acerto.diariasJaIncluidas
  );

  return {
    empresa: configuracoes?.nomeEmpresa || 'Emerson Pinturas',
    geradoEm: formatDateTime(new Date().toISOString()),
    nomeObra: obra.nome || 'Obra',
    titulo: acerto.titulo || calc?.titulo || tituloAcertoParceria(acerto.numero),
    numero: acerto.numero || calc?.numero || 1,
    data: acerto.data ? formatDate(acerto.data) : '—',
    status: 'Concluído',
    tipo,
    distribuir,
    consolidado,
    recebido: n(fechamento?.pagamento ?? base.recebido),
    custos: n(fechamento?.custos ?? base.custos),
    restante: distribuir ? distribuido : 0,
    reserva: n(fechamento?.reservaFinal ?? base.reservaFinal ?? base.reservaCaixa),
    reservaUtilizada: n(fechamento?.reservaUtilizada ?? base.reservaUtilizada),
    reembolsoEmerson,
    pessoas,
    custosLinhas,
    linhasGastos: custosLinhas.filter((item) => item?.tipo === 'gasto'),
    linhasDiarias: custosLinhas.filter((item) => item?.tipo === 'diaria'),
    linhasMao: custosLinhas.filter((item) => item?.tipo === 'mao-de-obra'),
    nota: String(acerto.observacao || calc?.notaHistorica || snapshot.notaHistorica || '').trim(),
  };
}

function resumoCustosGravados(modelo) {
  const grupos = { gasto: 0, diaria: 0, 'mao-de-obra': 0 };
  modelo.custosLinhas.forEach((item) => {
    if (!Object.prototype.hasOwnProperty.call(grupos, item?.tipo)) return;
    grupos[item.tipo] += Number(item.valor) || 0;
  });
  const soma = n(grupos.gasto + grupos.diaria + grupos['mao-de-obra']);
  if (Math.abs(soma - modelo.custos) > 0.05) return [];
  return [
    grupos.gasto > 0.004 ? { label: 'Gastos', value: money(n(grupos.gasto)) } : null,
    grupos.diaria > 0.004 ? { label: 'Diárias', value: money(n(grupos.diaria)) } : null,
    grupos['mao-de-obra'] > 0.004
      ? { label: 'Mão de obra', value: money(n(grupos['mao-de-obra'])) }
      : null,
  ].filter(Boolean);
}

function drawStatement(doc, ui, rows) {
  const rowH = 6;
  const boxH = 5 + rows.length * rowH;
  if (!ui.need(boxH + 1)) return;
  const startY = ui.y;
  doc.setFillColor(...WASH);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.18);
  doc.roundedRect(14, startY, ui.contentW, boxH, 1.2, 1.2, 'FD');
  let cy = startY + 5.2;
  rows.forEach((row) => {
    if (row.emphasis === 'cost' || row.emphasis === 'profit' || row.emphasis === 'total') {
      const fill = row.emphasis === 'profit' ? [237, 247, 232] : row.emphasis === 'cost' ? [243, 238, 252] : WASH;
      doc.setFillColor(...fill);
      doc.rect(15, cy - 3.8, ui.contentW - 2, rowH - 0.3, 'F');
    }
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
    doc.setFontSize(row.bold ? 9.2 : 8.2);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(row.label), 18, cy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(row.color || INK));
    doc.text(pdfSafe(row.value), 14 + ui.contentW - 4, cy, { align: 'right' });
    cy += rowH;
  });
  ui.y = startY + boxH + 2.2;
}

function tabelaCustos(ui, titulo, linhas, vazio) {
  if (!linhas.length) return;
  ui.sectionTitle(titulo);
  ui.table(
    [
      { header: 'Data', dataKey: 'data' },
      { header: 'Quem', dataKey: 'quem' },
      { header: 'Descrição', dataKey: 'descricao' },
      { header: 'Valor', dataKey: 'valor' },
    ],
    linhas.map((item) => ({
      data: item.data ? formatDate(item.data) : '—',
      quem: item.pessoaNome || nomePessoa(item.pessoa),
      descricao: item.descricao || '—',
      valor: n(item.valor),
    })),
    {
      moneyKeys: ['valor'],
      empty: vazio,
      fontSize: 8,
      columnStyles: {
        data: { cellWidth: 24 },
        quem: { cellWidth: 32 },
        valor: { halign: 'right', cellWidth: 28 },
      },
    }
  );
}

function renderAcertoPdf(doc, modelo, logo, autoTable) {
  const ui = createRelatorioPdfRenderer(doc, autoTable, {
    logo,
    empresa: modelo.empresa,
    titulo: 'Acerto entre parceiros',
    periodoLabel: `${modelo.nomeObra} · Acerto ${modelo.numero} · ${modelo.data} · Concluído`,
    geradoEm: modelo.geradoEm,
    maxPages: 0,
  });

  ui.drawCover();
  ui.sectionTitle('Recebimento deste Acerto');
  drawStatement(doc, ui, [
    { label: 'Valor recebido neste Acerto', value: money(modelo.recebido), bold: true },
  ]);

  const mostrarCustos = modelo.custos > 0.004 || modelo.tipo === 'reembolso-divisao';
  if (mostrarCustos) {
    ui.sectionTitle('Custos considerados neste Acerto');
    const linhas = resumoCustosGravados(modelo);
    const custos = linhas.length
      ? linhas
      : [{ label: 'Custos considerados', value: money(modelo.custos), bold: true }];
    if (modelo.tipo === 'reembolso-divisao' && modelo.reembolsoEmerson > 0.004 && !linhas.length) {
      custos.splice(0, custos.length, {
        label: 'Reembolso consolidado incluído',
        value: money(modelo.reembolsoEmerson),
        bold: true,
      });
    }
    drawStatement(doc, ui, custos);
    if (modelo.consolidado) {
      ui.note(
        'Valor histórico deste Acerto. Os registos originais continuam na obra e não voltam a ser somados aqui.'
      );
    }
  }

  tabelaCustos(ui, 'Gastos incluídos', modelo.linhasGastos, 'Sem gastos detalhados neste Acerto.');
  tabelaCustos(ui, 'Diárias individuais incluídas', modelo.linhasDiarias, 'Sem diárias detalhadas neste Acerto.');
  tabelaCustos(ui, 'Mão de obra de funcionários incluída', modelo.linhasMao, 'Sem mão de obra detalhada neste Acerto.');

  const reembolsos = modelo.pessoas.filter((pessoa) => pessoa.reembolso > 0.004);
  if (reembolsos.length || modelo.reembolsoEmerson > 0.004) {
    ui.sectionTitle('Reembolsos incluídos');
    const linhasReembolso = reembolsos.length
      ? reembolsos
      : [{ nome: 'Emerson', reembolso: modelo.reembolsoEmerson }];
    drawStatement(
      doc,
      ui,
      linhasReembolso.map((pessoa) => ({
        label: pessoa.nome,
        value: money(pessoa.reembolso),
      }))
    );
    ui.note('Reembolso de valor adiantado. Não é lucro nem distribuição.');
  }

  if (modelo.reservaUtilizada > 0.004 || modelo.reserva > 0.004) {
    ui.sectionTitle('Reserva deste Acerto');
    drawStatement(doc, ui, [
      { label: 'Reserva utilizada', value: money(modelo.reservaUtilizada) },
      { label: 'Reserva criada / mantida', value: money(modelo.reserva), bold: true },
    ]);
    ui.note('A reserva fica retida nesta obra. Não é lucro distribuído.');
  }

  const resultado = [
    { label: 'Valor recebido', value: money(modelo.recebido) },
    { label: 'Custos considerados', value: money(modelo.custos) },
  ];
  if (modelo.reservaUtilizada > 0.004) {
    resultado.push({ label: 'Reserva utilizada', value: money(modelo.reservaUtilizada) });
  }
  if (modelo.reserva > 0.004) {
    resultado.push({ label: 'Reserva mantida', value: money(modelo.reserva) });
  }
  resultado.push({
    label: 'Valor distribuído',
    value: modelo.distribuir ? money(modelo.restante) : 'Não distribuído',
    bold: true,
  });
  ui.sectionTitle('Resultado deste Acerto');
  drawStatement(doc, ui, resultado);

  if (modelo.distribuir && modelo.pessoas.length) {
    ui.sectionTitle('Destino de cada parceiro');
    ui.table(
      [
        { header: 'Parceiro', dataKey: 'nome' },
        { header: '%', dataKey: 'percentagem' },
        { header: 'Distribuído', dataKey: 'lucro' },
      ],
      modelo.pessoas.map((pessoa) => ({
        nome: pessoa.nome,
        percentagem: pessoa.percentagem != null ? `${pessoa.percentagem}%` : '—',
        lucro: pessoa.lucro,
      })),
      {
        moneyKeys: ['lucro'],
        fontSize: 9,
        columnStyles: {
          percentagem: { halign: 'right', cellWidth: 28 },
          lucro: { halign: 'right', cellWidth: 42 },
        },
      }
    );
    ui.note('Estes valores são os que ficaram registados neste Acerto. Não são recalculados depois.');
  }

  if (modelo.nota) {
    ui.sectionTitle('Observação');
    ui.note(modelo.nota);
  }

  ui.drawFooters();
}

export async function gerarRelatorioAcertoParceriaPdf(params) {
  const modelo = buildAcertoParceriaPdfModelo(params);
  if (!modelo) return false;
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const logo = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  renderAcertoPdf(doc, modelo, logo, autoTableMod.default);
  doc.save(`Emerson-Pinturas-${slug(modelo.nomeObra)}-${slug(modelo.titulo)}.pdf`);
  return true;
}
