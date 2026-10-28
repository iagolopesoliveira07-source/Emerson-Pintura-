import { formatDate, formatDateTime } from './formatters';
import { roundMoney } from './ivaCalculations';
import { getGastoValorAssinado } from './gastoDocumentoSinal';
import { getGastoDescricaoDisplay, getGastoTipoLabel } from './gastoDisplay';
import { GASTO_CATEGORIAS_DIARIA_LEGACY } from './gastoDiariaIntegration';
import { normalizeObraStatus } from './obraStatus';
import { asRecordList } from './safeCollections';
import { findFuncionarioById, isParceiroFuncionario, primeiroNomePessoa } from './funcionarioTipo';
import { filterDiariasDaObra, getDiariaQuantidadeNaObra } from './diariaObraAlocacao';
import {
  calcPartnershipSummary,
  formatPartnershipQuantidade,
  getGastoPagadorLabel,
  getPartnershipParticipants,
  resolveGastoPagadorId,
  summarizeGastosPorPagador,
  summarizePartnershipMaoDeObra,
} from './obraPartnership';
import {
  calculoFromAcertoFechado,
  getAcertosParceria,
  getReservaDisponivelParceria,
  listarPendentesAcertoParceria,
  resumoAcertoParaHistorico,
} from './obraParceriaAcertos';
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

function pctLabel(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'Não informada';
  return `${Number(value).toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%`;
}

function dataObra(obra, campo) {
  return obra?.[campo] ? formatDate(obra[campo]) : '—';
}

function descricaoGasto(gasto) {
  return getGastoDescricaoDisplay(gasto) || getGastoTipoLabel(gasto) || 'Gasto';
}

function chaveSocio(funcionario) {
  const nome = primeiroNomePessoa(funcionario?.nome);
  if (nome === 'emerson' || nome === 'fabio' || nome === 'juliano') return nome;
  if (isParceiroFuncionario(funcionario)) return nome || 'parceiro';
  return null;
}

function nomeSocio(key) {
  if (key === 'fabio') return 'Fábio';
  if (key === 'juliano') return 'Juliano';
  if (key === 'emerson') return 'Emerson';
  return key || 'Parceiro';
}

function valorRealDiaria(diaria) {
  const salvo = Number(diaria?.valorDiaria);
  return Number.isFinite(salvo) ? salvo : 0;
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
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
    doc.setFontSize(row.bold ? 9.2 : 8.2);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(row.label), 18, cy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(pdfSafe(row.value), 14 + ui.contentW - 4, cy, { align: 'right' });
    cy += rowH;
  });
  ui.y = startY + boxH + 2.4;
}

function buildParceriaModelo(params) {
  const {
    obra,
    gastos = [],
    gastosEmpresa = [],
    diarias = [],
    pagamentos = [],
    funcionarios = [],
    fechamentosPagamento = [],
    configuracoes = {},
  } = params;
  const summary = calcPartnershipSummary(obra, {
    gastos,
    diarias,
    pagamentos,
    gastosEmpresa,
    funcionarios,
    fechamentosPagamento,
  });
  if (!summary) return null;

  const gastosObra = asRecordList(gastos).filter(
    (gasto) => gasto && gasto.obraId === obra.id && !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(gasto.categoria)
  );
  const pagadores = summarizeGastosPorPagador(gastosObra, obra);
  const linhasGastos = [...gastosObra]
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
    .map((gasto) => {
      const pagadorId = resolveGastoPagadorId(gasto, obra);
      return {
        data: gasto.data ? formatDate(gasto.data) : '—',
        descricao: descricaoGasto(gasto),
        categoria: getGastoTipoLabel(gasto) || '—',
        pagador: getGastoPagadorLabel(pagadorId),
        pagadorId,
        valor: getGastoValorAssinado(gasto),
        observacao: String(gasto.observacao || '').trim(),
      };
    });

  const diariasObra = filterDiariasDaObra(diarias, obra.id);
  const gruposDiarias = { emerson: [], fabio: [], juliano: [], outros: [] };
  diariasObra.forEach((diaria) => {
    const func = findFuncionarioById(funcionarios, diaria.funcionarioId);
    const socio = chaveSocio(func);
    if (!socio) return;
    const quantidade = getDiariaQuantidadeNaObra(diaria, obra.id);
    const unitario = valorRealDiaria(diaria);
    const linha = {
      data: diaria.data ? formatDate(diaria.data) : '—',
      dataOrdem: diaria.data || '',
      nome: func?.nome || '—',
      quantidade,
      valor: unitario,
      total: n(quantidade * unitario),
      observacao: String(diaria.observacao || '').trim(),
    };
    if (gruposDiarias[socio]) gruposDiarias[socio].push(linha);
    else gruposDiarias.outros.push(linha);
  });
  Object.values(gruposDiarias).forEach((lista) => lista.sort((a, b) => String(a.dataOrdem).localeCompare(String(b.dataOrdem))));

  const totalDiarias = (lista) => n(lista.reduce((sum, item) => sum + item.total, 0));
  const qtyDiarias = (lista) => n(lista.reduce((sum, item) => sum + item.quantidade, 0));
  const maoResumo = summarizePartnershipMaoDeObra(obra.id, diarias, funcionarios, obra).filter((item) => !item.socio);
  const totalMao = n(maoResumo.reduce((sum, item) => sum + (Number(item.totalNoCusto) || 0), 0));

  const acertos = getAcertosParceria(obra).map((acerto) => {
    const resumo = resumoAcertoParaHistorico(acerto, obra);
    const calc = calculoFromAcertoFechado(obra, acerto);
    const pessoas = asRecordList(calc?.pessoas).map((pessoa) => ({
      key: pessoa.key,
      nome: pessoa.nome || nomeSocio(pessoa.key),
      percentagem: pessoa.percentagem,
      lucro: resumo.distribuirLucro === false ? 0 : n(pessoa.lucro),
      reembolso: n(pessoa.reembolso),
    }));
    return {
      numero: acerto.numero || 1,
      titulo: acerto.titulo || `Acerto ${acerto.numero || 1}`,
      data: acerto.data ? formatDate(acerto.data) : '—',
      recebido: resumo.recebido,
      custos: resumo.custos,
      reservaUtilizada: resumo.reservaUtilizada,
      reserva: resumo.reservaDeixada,
      distribuido: resumo.dividido,
      pessoas,
    };
  });

  const somaPessoa = (key) => n(acertos.reduce((sum, acerto) => {
    const pessoa = acerto.pessoas.find((item) => item.key === key);
    return sum + (pessoa ? pessoa.lucro : 0);
  }, 0));
  const distribuido = {
    total: n(acertos.reduce((sum, acerto) => sum + acerto.distribuido, 0)),
    recebido: n(acertos.reduce((sum, acerto) => sum + acerto.recebido, 0)),
    emerson: somaPessoa('emerson'),
    fabio: somaPessoa('fabio'),
    juliano: somaPessoa('juliano'),
  };

  const pendentes = listarPendentesAcertoParceria(obra, {
    gastos: gastosObra,
    gastosEmpresa,
    diarias,
    pagamentos,
    funcionarios,
  });
  const custosPendentes = n(
    asRecordList(pendentes.diarias).reduce((sum, item) => sum + (Number(item.valorCusto) || Number(item.valorReembolso) || 0), 0) +
      asRecordList(pendentes.gastos).reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
  );
  const recebidoForaDeAcerto = n(Math.max(0, (summary.recebidoTotal || 0) - distribuido.recebido));

  const percentagens = getPartnershipParticipants(obra).map((parte) => ({
    nome: parte.nome || (parte.role === 'empresa' ? 'Emerson' : 'Parceiro'),
    percentagem: parte.percentagem,
  }));

  const pessoaBloco = (key, gastosTotal) => {
    const dias = gruposDiarias[key] || [];
    return {
      key,
      nome: nomeSocio(key),
      gastos: gastosTotal,
      diarias: totalDiarias(dias),
      quantidadeDiarias: qtyDiarias(dias),
      maoDeObra: key === 'emerson' ? totalMao : 0,
      linhas: dias,
    };
  };

  return {
    empresa: configuracoes?.nomeEmpresa || 'Emerson Pinturas',
    geradoEm: formatDateTime(new Date().toISOString()),
    nome: obra.nome || 'Obra',
    cliente: obra.cliente || '—',
    inicio: dataObra(obra, 'dataInicio'),
    fim: obra?.dataPrevistaTermino ? dataObra(obra, 'dataPrevistaTermino') : dataObra(obra, 'dataTermino'),
    status: normalizeObraStatus(obra.estado),
    percentagens,
    valorTotal: summary.receitaContratada || summary.valorOriginal || 0,
    recebido: summary.recebidoTotal || 0,
    aReceber: summary.aReceberTotal || 0,
    gastosTotal: pagadores.total,
    maoDeObra: totalMao,
    diariasParceiros: n(
      totalDiarias(gruposDiarias.emerson) + totalDiarias(gruposDiarias.fabio) + totalDiarias(gruposDiarias.juliano) + totalDiarias(gruposDiarias.outros)
    ),
    pessoas: [
      pessoaBloco('emerson', pagadores.totalEmerson),
      pessoaBloco('fabio', pagadores.totalFabio),
      pessoaBloco('juliano', pagadores.totalJuliano),
    ],
    caixaGastos: pagadores.totalCaixa,
    gruposDiarias,
    maoResumo,
    linhasGastos,
    acertos,
    distribuido,
    reservaAtual: getReservaDisponivelParceria(obra),
    reservaUtilizada: n(acertos.reduce((sum, acerto) => sum + acerto.reservaUtilizada, 0)),
    custosPendentes,
    recebidoForaDeAcerto,
    custosAcertados: n(acertos.reduce((sum, acerto) => sum + acerto.custos, 0)),
  };
}

function renderParceriaPdf(doc, modelo, logo, autoTable) {
  const ui = createRelatorioPdfRenderer(doc, autoTable, {
    logo,
    empresa: modelo.empresa,
    titulo: 'Relatório geral da obra',
    periodoLabel: modelo.nome,
    geradoEm: modelo.geradoEm,
    maxPages: 0,
  });

  ui.drawCover();
  ui.sectionTitle('Resumo da obra');
  drawStatement(doc, ui, [
    { label: 'Cliente', value: modelo.cliente },
    { label: 'Início', value: modelo.inicio },
    { label: 'Data prevista / final', value: modelo.fim },
    { label: 'Estado', value: modelo.status },
    { label: 'Valor total da obra', value: money(modelo.valorTotal), bold: true },
  ]);
  ui.note('O valor total é o valor contratado. Não significa que esse dinheiro já entrou.');
  if (modelo.percentagens.length) {
    ui.table(
      [
        { header: 'Parceiro', dataKey: 'nome' },
        { header: 'Percentagem da obra', dataKey: 'percentagem' },
      ],
      modelo.percentagens.map((parte) => ({
        nome: parte.nome,
        percentagem: pctLabel(parte.percentagem),
      })),
      { fontSize: 8, columnStyles: { percentagem: { halign: 'right', cellWidth: 42 } } }
    );
  }

  ui.sectionTitle('Situação financeira');
  drawStatement(doc, ui, [
    { label: 'Valor total da obra', value: money(modelo.valorTotal) },
    { label: 'Total recebido do cliente', value: money(modelo.recebido), bold: true },
    { label: 'Total ainda por receber', value: money(modelo.aReceber) },
    { label: 'Gastos / compras registados', value: money(modelo.gastosTotal) },
    { label: 'Mão de obra dos funcionários', value: money(modelo.maoDeObra) },
    { label: 'Diárias dos parceiros', value: money(modelo.diariasParceiros) },
    { label: 'Custos já incluídos em Acertos', value: money(modelo.custosAcertados) },
    { label: 'Total já distribuído', value: money(modelo.distribuido.total) },
    { label: 'Reserva atual', value: money(modelo.reservaAtual) },
  ]);
  ui.note('Recebido, gastos, reembolso, distribuição e reserva são movimentos diferentes. Não se somam como se fossem lucro.');

  ui.sectionTitle('Gastos e valores por responsável');
  modelo.pessoas.forEach((pessoa) => {
    const linhas = [
      { label: 'Gastos / compras', value: money(pessoa.gastos) },
      { label: 'Diárias individuais', value: money(pessoa.diarias) },
    ];
    if (pessoa.key === 'emerson') {
      linhas.push({ label: 'Mão de obra dos funcionários', value: money(pessoa.maoDeObra) });
    }
    linhas.push({
      label: 'Total relacionado',
      value: money(n(pessoa.gastos + pessoa.diarias + pessoa.maoDeObra)),
      bold: true,
    });
    ui.note(pessoa.nome);
    drawStatement(doc, ui, linhas);
  });
  if (modelo.caixaGastos > 0.004) {
    ui.note('Caixa da parceria');
    drawStatement(doc, ui, [
      { label: 'Gastos pagos pelo caixa', value: money(modelo.caixaGastos), bold: true },
    ]);
  }
  ui.note('A mão de obra dos funcionários fica na parte do Emerson quando é responsabilidade económica dele. Não é diária de parceiro nem lucro.');

  ui.sectionTitle('Diárias dos parceiros');
  const socios = ['emerson', 'fabio', 'juliano'];
  const algumaDiaria = socios.some((key) => (modelo.gruposDiarias[key] || []).length);
  if (!algumaDiaria && !(modelo.gruposDiarias.outros || []).length) {
    ui.note('Sem diárias de parceiros registadas nesta obra.');
  }
  socios.forEach((key) => {
    const linhas = modelo.gruposDiarias[key] || [];
    if (!linhas.length) return;
    ui.table(
      [
        { header: 'Parceiro', dataKey: 'nome' },
        { header: 'Data', dataKey: 'data' },
        { header: 'Valor', dataKey: 'valor' },
        { header: 'Qtd.', dataKey: 'quantidade' },
        { header: 'Total', dataKey: 'total' },
        { header: 'Observação', dataKey: 'observacao' },
      ],
      linhas.map((item) => ({
        nome: nomeSocio(key),
        data: item.data,
        valor: item.valor,
        quantidade: formatPartnershipQuantidade(item.quantidade),
        total: item.total,
        observacao: item.observacao || '—',
      })),
      {
        moneyKeys: ['valor', 'total'],
        fontSize: 7.5,
        columnStyles: {
          data: { cellWidth: 22 },
          valor: { halign: 'right', cellWidth: 22 },
          quantidade: { halign: 'right', cellWidth: 18 },
          total: { halign: 'right', cellWidth: 22 },
        },
      }
    );
    ui.note(`${nomeSocio(key)} · ${formatPartnershipQuantidade(linhas.reduce((sum, item) => sum + item.quantidade, 0))} · total ${money(linhas.reduce((sum, item) => sum + item.total, 0))}`);
  });
  ui.note('Cada linha usa o valor gravado nessa diária. €130 é só o valor inicial de uma diária nova, não um valor obrigatório. Não é salário de funcionário.');

  ui.sectionTitle('Mão de obra dos funcionários');
  ui.table(
    [
      { header: 'Funcionário', dataKey: 'nome' },
      { header: 'Quantidade', dataKey: 'quantidade' },
      { header: 'Valor considerado', dataKey: 'valorConsiderado' },
      { header: 'Total', dataKey: 'total' },
    ],
    modelo.maoResumo.map((item) => ({
      nome: item.nome,
      quantidade: formatPartnershipQuantidade(item.quantidade),
      valorConsiderado: item.valorConsiderado,
      total: item.totalNoCusto || item.total || 0,
    })),
    {
      moneyKeys: ['valorConsiderado', 'total'],
      empty: 'Sem mão de obra de funcionários nesta obra.',
      fontSize: 8,
      columnStyles: {
        quantidade: { halign: 'right', cellWidth: 28 },
        valorConsiderado: { halign: 'right', cellWidth: 32 },
        total: { halign: 'right', cellWidth: 28 },
      },
    }
  );
  drawStatement(doc, ui, [{ label: 'Total da mão de obra', value: money(modelo.maoDeObra), bold: true }]);

  ui.sectionTitle('Gastos detalhados');
  ['emerson', 'fabio', 'juliano', 'caixa'].forEach((id) => {
    const linhas = modelo.linhasGastos.filter((item) => item.pagadorId === id || (id === 'emerson' && item.pagadorId === 'empresa'));
    if (!linhas.length) return;
    ui.note(id === 'caixa' ? 'Caixa da parceria' : nomeSocio(id));
    ui.table(
      [
        { header: 'Data', dataKey: 'data' },
        { header: 'Descrição', dataKey: 'descricao' },
        { header: 'Categoria', dataKey: 'categoria' },
        { header: 'Quem pagou', dataKey: 'pagador' },
        { header: 'Valor', dataKey: 'valor' },
        { header: 'Observação', dataKey: 'observacao' },
      ],
      linhas.map((item) => ({ ...item, observacao: item.observacao || '—' })),
      {
        moneyKeys: ['valor'],
        fontSize: 7,
        columnStyles: {
          data: { cellWidth: 20 },
          categoria: { cellWidth: 28 },
          pagador: { cellWidth: 24 },
          valor: { halign: 'right', cellWidth: 22 },
        },
      }
    );
  });
  if (!modelo.linhasGastos.length) ui.note('Sem gastos registados nesta obra.');

  ui.sectionTitle('Histórico de Acertos');
  if (!modelo.acertos.length) ui.note('Sem Acertos concluídos nesta obra.');
  modelo.acertos.forEach((acerto) => {
    drawStatement(doc, ui, [
      { label: `${acerto.titulo} · ${acerto.data}`, value: money(acerto.recebido), bold: true },
      { label: 'Custos considerados', value: money(acerto.custos) },
      { label: 'Reserva utilizada', value: money(acerto.reservaUtilizada) },
      { label: 'Reserva deixada', value: money(acerto.reserva) },
      { label: 'Valor distribuído', value: money(acerto.distribuido), bold: true },
      ...acerto.pessoas.map((pessoa) => ({
        label: pessoa.nome,
        value: money(pessoa.lucro),
      })),
    ]);
  });
  ui.note('Cada Acerto mostra o registo da altura em que foi confirmado. Este relatório não altera esses valores.');

  ui.sectionTitle('Já distribuído');
  drawStatement(doc, ui, [
    { label: 'Total recebido nos Acertos concluídos', value: money(modelo.distribuido.recebido) },
    { label: 'Total já distribuído', value: money(modelo.distribuido.total), bold: true },
    { label: 'Emerson', value: money(modelo.distribuido.emerson) },
    { label: 'Fábio', value: money(modelo.distribuido.fabio) },
    { label: 'Juliano', value: money(modelo.distribuido.juliano) },
  ]);
  ui.note('Só entram Acertos concluídos. Reembolso de custos não entra neste total.');

  ui.sectionTitle('Reserva da obra');
  drawStatement(doc, ui, [
    { label: 'Total utilizado da reserva', value: money(modelo.reservaUtilizada) },
    { label: 'Saldo atual da reserva', value: money(modelo.reservaAtual), bold: true },
  ]);
  ui.note('A reserva é dinheiro retido desta obra. Não é lucro distribuído. O saldo é o que o último Acerto deixou.');

  ui.sectionTitle('Situação atual');
  const situacao = [
    { label: 'Valor total da obra', value: money(modelo.valorTotal) },
    { label: 'Total recebido', value: money(modelo.recebido) },
    { label: 'Total ainda por receber', value: money(modelo.aReceber) },
    { label: 'Gastos registados', value: money(modelo.gastosTotal) },
    { label: 'Mão de obra', value: money(modelo.maoDeObra) },
    { label: 'Diárias dos parceiros', value: money(modelo.diariasParceiros) },
    { label: 'Total já distribuído', value: money(modelo.distribuido.total) },
    { label: 'Reserva atual', value: money(modelo.reservaAtual), bold: true },
  ];
  if (modelo.custosPendentes > 0.004) {
    situacao.push({ label: 'Custos ainda não incluídos em Acerto', value: money(modelo.custosPendentes) });
  }
  if (modelo.recebidoForaDeAcerto > 0.004) {
    situacao.push({ label: 'Recebido ainda não incluído em Acerto', value: money(modelo.recebidoForaDeAcerto) });
  }
  drawStatement(doc, ui, situacao);

  ui.drawFooters();
}

export async function gerarRelatorioObraParceriaPdf(params) {
  const modelo = buildParceriaModelo(params);
  if (!modelo) return false;
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const logo = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  renderParceriaPdf(doc, modelo, logo, autoTableMod.default);
  doc.save(`Emerson-Pinturas-Relatorio-Geral-${slug(modelo.nome)}.pdf`);
  return true;
}

export { buildParceriaModelo };
