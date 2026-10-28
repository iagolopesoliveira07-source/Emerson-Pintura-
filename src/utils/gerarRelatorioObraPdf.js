import { formatDate, formatDateTime } from './formatters';
import { isDiariaDeParceiro } from './funcionarioTipo';
import { RECEBIMENTO_STATUS, getPagamentoStatus } from './debtCalculations';
import { isObraConcluida } from './obraStatus';
import { isMaterialGasto } from './obraCustos';
import { isObraComDadosParciais, getDataInicioControle } from './controlDate';
import { hasIvaInfo, roundMoney } from './ivaCalculations';
import {
  getGastoValorAssinado,
  isNotaCredito,
  summarizeGastosIvaAssinado,
} from './gastoDocumentoSinal';
import { gastosEmpresaParaIva } from './gastoEmpresaCalculations';
import { GASTO_CATEGORIAS_DIARIA_LEGACY } from './gastoDiariaIntegration';
import {
  extrasDoFechamento,
  posicaoFinanceiraObra,
} from './relatorioExecutivo';
import {
  calcPartnershipSummary,
  calcPartnershipMaoDeObra,
  formatPartnershipQuantidade,
  isPartnershipObra,
  isObraParceriaComDiariasJaIncluidas,
  summarizeGastosPorPagador,
} from './obraPartnership';
import {
  getExtraStatusLabel,
  getObraExtras,
} from './obraExtras';
import {
  filterDiariasDaObra,
  getDiariaCustoNaObra,
  getDiariaQuantidadeNaObra,
} from './diariaObraAlocacao';
import {
  calcPrepaidCreditSummary,
  CONTROLE_CUSTOS,
  getIntervencaoNome,
  getIntervencaoStatusLabel,
  isPrepaidCreditObra,
} from './obraPrepaidCredit';
import {
  AMBER,
  GREEN,
  INK,
  createRelatorioPdfRenderer,
  loadLogoDataUrl,
  money,
  moneyColor,
  moneyOrDash,
} from './pdfRelatorioLayout';

function somar(lista, getValor) {
  return roundMoney((lista || []).reduce((sum, item) => sum + (getValor(item) || 0), 0));
}

function nomeFuncionario(id, funcionarios) {
  if (!id) return 'Sem funcionário';
  return funcionarios.find((item) => item.id === id)?.nome || 'Funcionário';
}

function fornecedorNome(gasto) {
  return (
    String(gasto?.fornecedorNome || gasto?.fornecedor || gasto?.nomeFornecedor || '').trim() ||
    'Sem fornecedor'
  );
}

function gastosObrasReais(gastos = []) {
  return gastos.filter((gasto) => !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(gasto.categoria));
}

function resultadoServicoTexto(row) {
  if (row.resultadoExibicaoTipo === 'historico') return row.resultadoExibicaoLabel;
  if (row.resultadoExibicaoValor == null) return `${row.resultadoExibicaoLabel}  —`;
  return `${row.resultadoExibicaoLabel}  ${money(row.resultadoExibicaoValor)}`;
}

function buildServicosPdf(obra, ctx) {
  if (!isPrepaidCreditObra(obra)) return null;
  const summary = calcPrepaidCreditSummary(obra, ctx);
  if (!summary) return null;
  const ativos = (summary.historico || []).filter(
    (row) => row.controleCustos !== CONTROLE_CUSTOS.HISTORICO
  );
  const historicos = (summary.historico || []).filter(
    (row) => row.controleCustos === CONTROLE_CUSTOS.HISTORICO
  );
  const nao = summary.custosNaoAtribuidos || {};
  return {
    ativos: ativos.map((row) => ({
      nome: getIntervencaoNome(row),
      status: getIntervencaoStatusLabel(row),
      diarias: row.quantidadeDiarias || 0,
      funcionarios: row.funcionariosEnvolvidos || 0,
      maoDeObra: row.totalDiarias || 0,
      gastos: row.totalGastos || 0,
      total: row.custoTotal || 0,
      orcamento: row.valorDefinido || row.valorOrcamentado,
      abatido: row.abatidoNoCredito ? row.valorAbatido : null,
      resultado: resultadoServicoTexto(row),
    })),
    historicos: historicos.map((row) => ({
      nome: getIntervencaoNome(row),
      orcamento: row.valorOrcamentado,
    })),
    semServico:
      (nao.total || 0) > 0.004 || (nao.quantidadeDiarias || 0) > 0
        ? {
            nome: 'Sem serviço definido',
            diarias: nao.quantidadeDiarias || 0,
            funcionarios: nao.funcionariosEnvolvidos || 0,
            maoDeObra: nao.totalDiarias || 0,
            gastos: nao.totalGastos || 0,
            total: nao.total || 0,
          }
        : null,
  };
}

function slug(value) {
  return String(value || 'obra')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function buildRelatorioObra({
  obra,
  gastos = [],
  gastosEmpresa = [],
  diarias = [],
  pagamentos = [],
  funcionarios = [],
  fechamentosPagamento = [],
  configuracoes = {},
} = {}) {
  const posicao = posicaoFinanceiraObra(obra, pagamentos, { gastos, diarias, gastosEmpresa });
  const creditSummary = isPrepaidCreditObra(obra)
    ? calcPrepaidCreditSummary(obra, { diarias, gastos, gastosEmpresa })
    : null;
  const dataInicioControle = getDataInicioControle(configuracoes);
  const diariasObra = filterDiariasDaObra(diarias, obra.id);
  const gastosObra = gastosObrasReais(gastos.filter((item) => item.obraId === obra.id));
  const empresaObra = gastosEmpresaParaIva(
    (gastosEmpresa || []).filter((item) => item.obraId === obra.id)
  );
  const todosGastos = [...gastosObra, ...empresaObra];

  const materiais = somar(gastosObra.filter(isMaterialGasto), getGastoValorAssinado);
  const outros = roundMoney(
    somar(gastosObra.filter((item) => !isMaterialGasto(item)), getGastoValorAssinado) +
      somar(empresaObra, getGastoValorAssinado)
  );
  const labor = isPartnershipObra(obra)
    ? calcPartnershipMaoDeObra(obra.id, diarias, funcionarios, obra)
    : somar(diariasObra, (item) => getDiariaCustoNaObra(item, obra.id, funcionarios));
  const totalGasto = roundMoney(materiais + labor + outros);
  const qtdDiarias = diariasObra.reduce((sum, item) => sum + getDiariaQuantidadeNaObra(item, obra.id), 0);

  const extrasPorFunc = new Map();
  const diariaIdsObra = new Set(diariasObra.map((item) => item.id));
  (fechamentosPagamento || []).forEach((fechamento) => {
    const ids = fechamento.diariaIds || [];
    if (!ids.length) return;
    if (!ids.every((id) => diariaIdsObra.has(id))) return;
    const extra = extrasDoFechamento(fechamento);
    const valor = roundMoney(extra.extras + extra.gratificacoes - extra.ajustes);
    if (!valor) return;
    const funcId = fechamento.funcionarioId;
    extrasPorFunc.set(funcId, roundMoney((extrasPorFunc.get(funcId) || 0) + valor));
  });

  const porPessoa = new Map();
  diariasObra.forEach((diaria) => {
    if (isDiariaDeParceiro(diaria, funcionarios)) return;
    const id = diaria.funcionarioId || 'sem-funcionario';
    const current = porPessoa.get(id) || {
      id,
      nome: nomeFuncionario(diaria.funcionarioId, funcionarios),
      quantidade: 0,
      custo: 0,
      extras: extrasPorFunc.get(id) || 0,
    };
    current.quantidade += getDiariaQuantidadeNaObra(diaria, obra.id);
    current.custo = roundMoney(current.custo + getDiariaCustoNaObra(diaria, obra.id, funcionarios));
    porPessoa.set(id, current);
  });
  extrasPorFunc.forEach((valor, id) => {
    if (porPessoa.has(id)) return;
    porPessoa.set(id, {
      id,
      nome: nomeFuncionario(id, funcionarios),
      quantidade: 0,
      custo: 0,
      extras: valor,
    });
  });
  const pessoas = [...porPessoa.values()]
    .map((item) => ({ ...item, total: roundMoney(item.custo + item.extras) }))
    .sort((a, b) => b.total - a.total);

  const categoriasMap = new Map();
  todosGastos.forEach((gasto) => {
    const label = isMaterialGasto(gasto) ? 'Materiais' : String(gasto.categoria || 'Outros').trim() || 'Outros';
    categoriasMap.set(label, roundMoney((categoriasMap.get(label) || 0) + getGastoValorAssinado(gasto)));
  });
  const categorias = [...categoriasMap.entries()]
    .map(([label, total]) => ({ label, total }))
    .filter((item) => Math.abs(item.total) > 0.004)
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const fornecedorMap = new Map();
  todosGastos.forEach((gasto) => {
    const nome = fornecedorNome(gasto);
    fornecedorMap.set(nome, roundMoney((fornecedorMap.get(nome) || 0) + getGastoValorAssinado(gasto)));
  });
  const fornecedores = [...fornecedorMap.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  const principaisFornecedores = fornecedores.slice(0, 6);
  if (fornecedores.length > 6) {
    principaisFornecedores.push({
      nome: `Outros (${fornecedores.length - 6})`,
      total: somar(fornecedores.slice(6), (row) => row.total),
    });
  }

  const docsComIva = todosGastos.filter(hasIvaInfo);
  const notas = todosGastos.filter(isNotaCredito);
  const ivaAssinado = summarizeGastosIvaAssinado(docsComIva);
  const ivaDisponivel = docsComIva.length > 0;
  const ivaIncompleto = todosGastos.length > docsComIva.length;

  const concluida = isObraConcluida(obra.estado);
  const dadosParciais = isObraComDadosParciais(obra, gastos, diarias, dataInicioControle);
  const partnershipSummary = isPartnershipObra(obra)
    ? calcPartnershipSummary(obra, {
        gastos,
        diarias,
        pagamentos,
        gastosEmpresa,
        funcionarios,
        fechamentosPagamento,
      })
    : null;
  const faturadoBruto = somar(
    pagamentos.filter(
      (item) =>
        item.obraId === obra.id &&
        item.tipo === 'Recebimento de cliente' &&
        getPagamentoStatus(item) !== RECEBIMENTO_STATUS.CANCELADO
    ),
    (item) => Number(item.valor) || 0
  );
  const valorObraResultado = posicao.valorObraAtualizado ?? posicao.valorContratado ?? 0;
  const gastosEmersonPdf = partnershipSummary?.gastosEmerson ?? totalGasto;
  const pagadoresGastos = summarizeGastosPorPagador(gastosObra, obra);
  const resultadoParcial = roundMoney(
    (partnershipSummary ? partnershipSummary.lucroCaixa : faturadoBruto) - (partnershipSummary ? 0 : gastosEmersonPdf)
  );
  const resultadoFinal = partnershipSummary?.divisaoInformada
    ? partnershipSummary.resultadoEmerson
    : roundMoney((valorObraResultado || 0) - gastosEmersonPdf);
  let resultadoTipo = 'parcial';
  let resultadoLabel = partnershipSummary ? 'Lucro provisório da Emerson' : 'Resultado parcial';
  let resultadoValor = partnershipSummary?.divisaoInformada
    ? partnershipSummary.resultadoCaixaEmerson ?? partnershipSummary.resultadoEmerson
    : resultadoParcial;
  if (concluida && !dadosParciais && (partnershipSummary?.divisaoInformada || valorObraResultado > 0)) {
    resultadoTipo = (resultadoFinal || 0) >= 0 ? 'lucro' : 'prejuizo';
    resultadoLabel = partnershipSummary
      ? resultadoFinal >= 0
        ? 'Lucro Emerson'
        : 'Prejuízo Emerson'
      : resultadoFinal >= 0
        ? 'Lucro final'
        : 'Prejuízo final';
    resultadoValor = resultadoFinal;
  }
  const margem =
    valorObraResultado > 0 && resultadoValor != null
      ? Math.round((resultadoValor / valorObraResultado) * 1000) / 10
      : null;

  return {
    empresa: configuracoes?.nomeEmpresa || 'Emerson Pinturas',
    geradoEm: formatDateTime(new Date().toISOString()),
    nome: obra.nome,
    cliente: obra.cliente || '—',
    status: concluida ? 'Concluída' : 'Em andamento',
    credito: posicao.credito,
    dataInicio: obra.dataInicio ? formatDate(obra.dataInicio) : 'Não informado',
    valorObraInformado: posicao.informado,
    valorObra: posicao.valorContratado || 0,
    valorOriginal: posicao.valorContratado || 0,
    valorAtualizado: valorObraResultado,
    extras: {
      ...(posicao.extras || {}),
      lista: getObraExtras(obra).map((extra) => ({
        descricao: extra.descricao || 'Serviço adicional',
        valor: extra.valor || 0,
        data: extra.data || '',
        status: getExtraStatusLabel(extra.status),
        observacao: extra.observacao || '',
      })),
    },
    recebido: posicao.valorRecebido,
    aReceber: posicao.valorRestante,
    saldoCredito: creditSummary?.saldoDisponivel ?? null,
    creditoInicial: creditSummary?.creditoInicial ?? null,
    creditoUtilizado: creditSummary?.totalAbatido ?? null,
    materiais,
    maoDeObra: labor,
    outros,
    totalGasto,
    gastosEmerson: gastosEmersonPdf,
    gastosPagosEmerson: pagadoresGastos.totalEmerson,
    gastosPagosFabio: pagadoresGastos.totalFabio,
    gastosPagosJuliano: pagadoresGastos.totalJuliano,
    gastosPagosParceiro: pagadoresGastos.totalSocios,
    gastosPagosTotal: pagadoresGastos.total,
    parceria: partnershipSummary
      ? {
          parceiroNome: partnershipSummary.parceiroNome,
          divisaoInformada: partnershipSummary.divisaoInformada,
          percentagemEmpresa: partnershipSummary.percentagemEmpresa,
          percentagemParceiro: partnershipSummary.percentagemParceiro,
          valorTotal: partnershipSummary.receitaContratada,
          recebidoTotal: partnershipSummary.receitaRecebida,
          gastosMateriaisOutros: partnershipSummary.gastosMateriaisOutros,
          gastosObraEmerson: partnershipSummary.gastosObraEmerson,
          gastosFabio: partnershipSummary.gastosFabio,
          gastosJuliano: partnershipSummary.gastosJuliano,
          maoDeObraTotal: partnershipSummary.maoDeObraTotal,
          maoDeObraPorPessoa: partnershipSummary.maoDeObraPorPessoa || [],
          custoTotalParceria: partnershipSummary.custoTotalParceria,
          lucroReal: partnershipSummary.lucroReal,
          parteEmerson: partnershipSummary.parteEmpresa,
          parteParceiro: partnershipSummary.parteParceiro,
          recebidoEmerson: partnershipSummary.recebidoEmerson,
          recebidoParceiro: partnershipSummary.recebidoParceiro,
          totalRepassado: partnershipSummary.totalRepassado,
          aRepassar: partnershipSummary.aRepassar,
          devidoParceiro: partnershipSummary.devidoParceiro,
          totalDevidoParceiro: partnershipSummary.totalDevidoParceiro,
          totalPagoParceiro: partnershipSummary.totalPagoParceiro,
          totalPendenteParceiro: partnershipSummary.totalPendenteParceiro,
          gastosEmerson: partnershipSummary.gastosEmerson,
          gastosParceiro: partnershipSummary.gastosParceiro,
          resultadoEmerson: partnershipSummary.resultadoEmerson,
          resultadoCaixaEmerson: partnershipSummary.resultadoCaixaEmerson,
          repasses: (partnershipSummary.repasses || []).map((item) => ({
            data: item.data ? formatDate(item.data) : '—',
            valor: item.valor || 0,
            observacao: item.observacao || '—',
          })),
        }
      : null,
    resultadoTipo,
    resultadoLabel,
    resultadoValor,
    margem,
    diarias: qtdDiarias,
    funcionariosEnvolvidos: pessoas.length,
    pessoas,
    categorias,
    fornecedores: principaisFornecedores,
    iva: {
      disponivel: ivaDisponivel,
      incompleto: ivaIncompleto,
      total: ivaDisponivel ? ivaAssinado.iva : null,
      dedutivel: ivaDisponivel ? ivaAssinado.ivaDedutivel : null,
      naoDedutivel: ivaDisponivel ? ivaAssinado.ivaNaoDedutivel : null,
      notasCredito: {
        quantidade: notas.length,
        total: somar(notas, getGastoValorAssinado),
      },
    },
    dadosParciais,
    servicos: buildServicosPdf(obra, { diarias, gastos, gastosEmpresa }),
  };
}

export async function gerarRelatorioObraPdf(params) {
  const audience = params?.audience === 'cliente' ? 'cliente' : 'interno';
  if (audience === 'cliente') {
    const { gerarRelatorioObraClientePdf } = await import('./gerarRelatorioObraClientePdf');
    const gerado = await gerarRelatorioObraClientePdf(params);
    if (!gerado) {
      throw new Error('O PDF para cliente só está disponível nesta obra de crédito.');
    }
    return;
  }
  if (isPartnershipObra(params?.obra) || params?.obra?.tipoObra === 'parceria') {
    const { gerarRelatorioObraParceriaPdf } = await import('./gerarRelatorioObraParceriaPdf');
    const gerado = await gerarRelatorioObraParceriaPdf(params);
    if (gerado) return;
  }
  const modelo = buildRelatorioObra(params);
  const prepaid = isPrepaidCreditObra(params?.obra);
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const logo = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  renderObraPdf(doc, modelo, logo, autoTableMod.default, { prepaid });
  doc.save(
    prepaid
      ? `Emerson-Pinturas-Obra-${slug(modelo.nome)}-Interno.pdf`
      : `Emerson-Pinturas-Obra-${slug(modelo.nome)}.pdf`
  );
}

function renderObraPdf(doc, modelo, logo, autoTable, { prepaid = false } = {}) {
  const ui = createRelatorioPdfRenderer(doc, autoTable, {
    logo,
    empresa: modelo.empresa,
    titulo: prepaid ? 'Relatório interno da obra' : 'Relatório da obra',
    periodoLabel: modelo.nome,
    geradoEm: modelo.geradoEm,
    qualidade: modelo.dadosParciais ? 'Parcial' : null,
    maxPages: modelo.parceria ? 6 : modelo.servicos ? 4 : modelo.extras?.quantidade ? 3 : 2,
  });

  ui.drawCover();
  ui.kpis(
    [
      { label: 'Cliente', value: String(modelo.cliente) },
      { label: 'Status', value: modelo.credito ? `Crédito · ${modelo.status}` : modelo.status },
      { label: 'Data de início', value: modelo.dataInicio },
      {
        label: modelo.extras?.quantidade ? 'Valor original' : 'Valor da obra',
        value: modelo.valorObraInformado ? money(modelo.valorObra) : '—',
      },
      ...(modelo.extras?.quantidade
        ? [
            { label: 'Extras/serviços', value: money(modelo.extras.total || 0) },
            { label: 'Valor atualizado', value: money(modelo.valorAtualizado || modelo.valorObra) },
          ]
        : []),
      { label: 'Recebido', value: money(modelo.recebido), color: GREEN },
      modelo.saldoCredito != null
        ? { label: 'Saldo de crédito', value: money(modelo.saldoCredito), color: GREEN }
        : {
            label: 'A receber',
            value: modelo.valorObraInformado ? moneyOrDash(modelo.aReceber) : '—',
            color: modelo.aReceber > 0.004 ? AMBER : INK,
          },
      { label: 'Materiais', value: money(modelo.materiais) },
      { label: 'Mão de obra', value: money(modelo.maoDeObra) },
      { label: 'Outros gastos', value: money(modelo.outros) },
      { label: 'Total gasto', value: money(modelo.totalGasto) },
      {
        label: modelo.resultadoLabel,
        value: money(modelo.resultadoValor),
        color: modelo.resultadoTipo === 'parcial' ? AMBER : moneyColor(modelo.resultadoValor),
      },
      {
        label: 'Margem',
        value:
          modelo.margem == null
            ? '—'
            : `${modelo.margem.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}%`,
      },
    ],
    3,
    15.2
  );
  ui.kpis(
    [
      { label: 'N.º total de diárias', value: String(modelo.diarias) },
      { label: 'N.º de funcionários', value: String(modelo.funcionariosEnvolvidos) },
    ],
    2,
    14.5
  );

  if (modelo.extras?.lista?.length) {
    ui.sectionTitle('Extras / serviços adicionais da obra');
    ui.table(
      [
        { header: 'Serviço', dataKey: 'descricao' },
        { header: 'Valor', dataKey: 'valor' },
        { header: 'Data', dataKey: 'data' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Observação', dataKey: 'observacao' },
      ],
      modelo.extras.lista.map((row) => ({
        ...row,
        data: row.data ? formatDate(row.data) : '—',
        observacao: row.observacao || '—',
      })),
      {
        moneyKeys: ['valor'],
        fontSize: 6.7,
        columnStyles: {
          descricao: { cellWidth: 48 },
          status: { cellWidth: 24 },
        },
      }
    );
    ui.note(
      `Valor original ${money(modelo.valorOriginal || modelo.valorObra)} + extras ${money(modelo.extras.total || 0)} = valor atualizado ${money(modelo.valorAtualizado || modelo.valorObra)}. Extra a cobrar entra em a receber; extra recebido entra em recebido.`
    );
  }

  if (modelo.parceria) {
    const p = modelo.parceria;
    const pct = (value) =>
      value == null ? 'Não informada' : `${Number(value).toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%`;
    const moneySplit = (value) => (p.divisaoInformada && value != null ? money(value) : 'Não informada');
    ui.sectionTitle('Resumo para acerto');
    ui.table(
      [
        { header: 'Indicador', dataKey: 'label' },
        { header: 'Valor', dataKey: 'valor' },
      ],
      [
        { label: 'Gastos / compras', valor: money(p.gastosMateriaisOutros) },
        { label: 'Mão de obra', valor: money(p.maoDeObraTotal) },
        { label: 'Custo total da parceria', valor: money(p.custoTotalParceria) },
        { label: 'Valor da obra', valor: money(p.valorTotal) },
        { label: 'Lucro para dividir', valor: money(p.lucroReal) },
        { label: 'Percentagem Emerson Pinturas', valor: pct(p.percentagemEmpresa) },
        { label: 'Lucro Emerson', valor: moneySplit(p.parteEmerson) },
        { label: `Percentagem ${p.parceiroNome}`, valor: pct(p.percentagemParceiro) },
        { label: `Lucro ${p.parceiroNome}`, valor: moneySplit(p.parteParceiro) },
        { label: 'Emerson pagou (gastos/compras)', valor: money(p.gastosObraEmerson) },
        { label: 'Fábio pagou', valor: money(p.gastosFabio) },
        { label: 'Juliano pagou', valor: money(p.gastosJuliano) },
      ],
      { fontSize: 7.2, columnStyles: { valor: { halign: 'right', cellWidth: 42 } } }
    );
    ui.note(
      isObraParceriaComDiariasJaIncluidas({ nome: modelo.nome })
        ? 'Braga 4: os gastos já incluem as diárias. Elas não voltam a somar neste acerto. As percentagens aplicam-se só depois do lucro.'
        : 'Custo da parceria = gastos/compras + diárias (funcionários €100; Emerson, Fábio e Juliano €130). As percentagens aplicam-se só depois do lucro.'
    );

    ui.sectionTitle('Repasse da participação no lucro');
    ui.table(
      [
        { header: 'Indicador', dataKey: 'label' },
        { header: 'Valor', dataKey: 'valor' },
      ],
      [
        { label: `Lucro de ${p.parceiroNome}`, valor: moneySplit(p.parteParceiro) },
        { label: 'Já repassado', valor: money(p.totalRepassado) },
        { label: 'Ainda a repassar (lucro)', valor: moneySplit(p.aRepassar) },
      ],
      { fontSize: 7.2, columnStyles: { valor: { halign: 'right', cellWidth: 42 } } }
    );
    if ((p.repasses || []).length) {
      ui.table(
        [
          { header: 'Data', dataKey: 'data' },
          { header: 'Repasse de lucro', dataKey: 'valor' },
          { header: 'Observação', dataKey: 'observacao' },
        ],
        p.repasses,
        { moneyKeys: ['valor'], fontSize: 6.8 }
      );
    }
  }

  if (modelo.servicos) {
    ui.sectionTitle('Serviços');
    const servicoRows = [
      ...modelo.servicos.ativos,
      ...(modelo.servicos.semServico ? [modelo.servicos.semServico] : []),
    ];
    ui.table(
      [
        { header: 'Serviço', dataKey: 'nome' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Diárias', dataKey: 'diarias' },
        { header: 'Total gasto', dataKey: 'total' },
        { header: 'Orçamento', dataKey: 'orcamento' },
        { header: 'Abatido', dataKey: 'abatido' },
        { header: 'Resultado', dataKey: 'resultado' },
      ],
      servicoRows.map((row) => ({
        ...row,
        status: row.status || '—',
      })),
      {
        moneyKeys: ['total', 'orcamento', 'abatido'],
        empty: 'Sem serviços novos neste período.',
        fontSize: 6.5,
        columnStyles: {
          nome: { cellWidth: 32 },
          status: { cellWidth: 24 },
          diarias: { cellWidth: 16, halign: 'right' },
          resultado: { cellWidth: 34 },
        },
      }
    );
    if (modelo.servicos.historicos.length) {
      ui.note('Serviços anteriores da planilha (custos detalhados não registados).');
      ui.table(
        [
          { header: 'Serviço', dataKey: 'nome' },
          { header: 'Valor', dataKey: 'orcamento' },
        ],
        modelo.servicos.historicos,
        { moneyKeys: ['orcamento'], fontSize: 6.7 }
      );
    }
  } else {
    ui.sectionTitle(modelo.parceria ? 'Mão de obra da parceria' : 'Funcionários');
    if (modelo.parceria) {
      ui.table(
        [
          { header: 'Nome', dataKey: 'nome' },
          { header: 'N.º diárias', dataKey: 'quantidade' },
          { header: 'Valor considerado', dataKey: 'valorConsiderado' },
          { header: 'Total', dataKey: 'total' },
        ],
        (modelo.parceria.maoDeObraPorPessoa || []).map((pessoa) => ({
          nome: pessoa.nome,
          quantidade: formatPartnershipQuantidade(pessoa.quantidade),
          valorConsiderado: pessoa.valorConsiderado,
          total: pessoa.total,
        })),
        {
          moneyKeys: ['valorConsiderado', 'total'],
          empty: 'Sem diárias nesta obra.',
          fontSize: 7.2,
        }
      );
      ui.note(
        isObraParceriaComDiariasJaIncluidas({ nome: modelo.nome })
          ? 'Braga 4: valores de referência (€100 / €130). Os gastos já incluem as diárias e não voltam a somar no custo.'
          : 'Custo interno da parceria: funcionários €100/dia; Emerson, Fábio e Juliano €130/dia.'
      );
    } else {
    const temExtras = modelo.pessoas.some((row) => Math.abs(row.extras) > 0.004);
    const funcCols = [
      { header: 'Funcionário', dataKey: 'nome' },
      { header: 'N.º diárias', dataKey: 'quantidade' },
      { header: 'Custo', dataKey: 'custo' },
    ];
    const funcMoney = ['custo'];
    if (temExtras) {
      funcCols.push({ header: 'Extras/Ajustes', dataKey: 'extras' });
      funcMoney.push('extras');
    }
    ui.table(funcCols, modelo.pessoas, {
      moneyKeys: funcMoney,
      empty: 'Sem diárias nesta obra.',
      fontSize: 7.2,
    });
    }

    ui.sectionTitle(modelo.parceria ? 'Gastos / compras' : 'Gastos');
    ui.table(
      [
        { header: 'Categoria', dataKey: 'label' },
        { header: 'Total', dataKey: 'total' },
      ],
      modelo.categorias,
      { moneyKeys: ['total'], empty: 'Sem gastos associados a esta obra.', fontSize: 7.2 }
    );
    if (modelo.parceria) {
      ui.table(
        [
          { header: 'Pago por', dataKey: 'label' },
          { header: 'Total', dataKey: 'total' },
        ],
        [
          { label: 'Emerson Pinturas', total: modelo.gastosPagosEmerson || 0 },
          { label: 'Fábio', total: modelo.gastosPagosFabio || 0 },
          { label: 'Juliano', total: modelo.gastosPagosJuliano || 0 },
          { label: 'Total geral dos gastos', total: modelo.gastosPagosTotal || 0 },
        ],
        { moneyKeys: ['total'], fontSize: 7.2 }
      );
    }
    if (modelo.fornecedores.length) {
      ui.table(
        [
          { header: 'Principais fornecedores', dataKey: 'nome' },
          { header: 'Total', dataKey: 'total' },
        ],
        modelo.fornecedores,
        { moneyKeys: ['total'], fontSize: 7.2 }
      );
    }
  }

  ui.sectionTitle('IVA');
  if (!modelo.iva.disponivel) {
    ui.note('IVA não informado nesta obra. A ausência de número não significa IVA = 0.');
  } else {
    const nc = modelo.iva.notasCredito;
    ui.kpis(
      [
        { label: 'IVA registado', value: moneyOrDash(modelo.iva.total) },
        { label: 'IVA dedutível', value: moneyOrDash(modelo.iva.dedutivel), color: GREEN },
        { label: 'IVA não dedutível', value: moneyOrDash(modelo.iva.naoDedutivel) },
        {
          label: nc.quantidade ? `Notas de crédito (${nc.quantidade})` : 'Notas de crédito',
          value: nc.quantidade ? money(nc.total) : 'Nenhuma',
        },
      ],
      4,
      14.5
    );
    if (modelo.iva.incompleto) {
      ui.note('Totais só dos documentos com IVA informado.');
    }
  }

  if (modelo.parceria) {
    const p = modelo.parceria;
    const moneySplit = (value) => (p.divisaoInformada && value != null ? money(value) : '—');
    ui.drawResultadoBox(
      [
        { label: 'Valor total da obra', value: money(p.valorTotal) },
        { label: 'Gastos / compras', value: money(p.gastosMateriaisOutros), subtract: true },
        { label: 'Mão de obra', value: money(p.maoDeObraTotal), subtract: true },
        { label: 'Lucro para dividir', value: money(p.lucroReal) },
      ],
      modelo.resultadoLabel,
      p.resultadoEmerson ?? modelo.resultadoValor
    );
    ui.sectionTitle(`Posição de ${p.parceiroNome}`);
    ui.table(
      [
        { header: 'Indicador', dataKey: 'label' },
        { header: 'Valor', dataKey: 'valor' },
      ],
      [
        { label: 'Lucro do parceiro', valor: moneySplit(p.parteParceiro) },
        { label: 'Total devido (participação no lucro)', valor: moneySplit(p.totalDevidoParceiro) },
        { label: 'Já repassado', valor: money(p.totalPagoParceiro) },
        { label: 'Ainda a repassar', valor: moneySplit(p.totalPendenteParceiro) },
      ],
      { fontSize: 7.2, columnStyles: { valor: { halign: 'right', cellWidth: 42 } } }
    );
  } else {
    ui.drawResultadoBox(
      [
        { label: 'Valor da obra', value: modelo.valorObraInformado ? money(modelo.valorObra) : '—' },
        { label: 'Recebido', value: money(modelo.recebido), color: GREEN },
        modelo.saldoCredito != null
          ? { label: 'Saldo de crédito', value: money(modelo.saldoCredito), color: GREEN }
          : {
              label: 'A receber',
              value: modelo.valorObraInformado ? moneyOrDash(modelo.aReceber) : '—',
              color: modelo.aReceber > 0.004 ? AMBER : INK,
            },
        { label: 'Total gasto', value: money(modelo.totalGasto), subtract: true },
      ],
      modelo.resultadoLabel,
      modelo.resultadoValor
    );
  }

  ui.capPages();
  ui.drawFooters();
}
