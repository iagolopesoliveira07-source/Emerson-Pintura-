import { formatDateTime } from './formatters';
import { isPrepaidCreditObra, calcPrepaidCreditSummary, getIntervencaoClienteResumo } from './obraPrepaidCredit';
import {
  GREEN,
  createRelatorioPdfRenderer,
  loadLogoDataUrl,
  money,
} from './pdfRelatorioLayout';

function slug(value) {
  return String(value || 'obra')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function buildRelatorioObraCliente({
  obra,
  diarias = [],
  gastos = [],
  gastosEmpresa = [],
  configuracoes = {},
} = {}) {
  if (!isPrepaidCreditObra(obra)) return null;

  const summary = calcPrepaidCreditSummary(obra, { diarias, gastos, gastosEmpresa });
  if (!summary) return null;

  const servicos = (summary.historico || []).map((row) => {
    const cliente = getIntervencaoClienteResumo(row);
    return {
      titulo: cliente.titulo,
      periodo: cliente.periodo,
      valor: cliente.abatidoNoCredito ? cliente.valor : null,
      status: cliente.status,
    };
  });

  return {
    empresa: configuracoes?.nomeEmpresa || 'Emerson Pinturas',
    geradoEm: formatDateTime(new Date().toISOString()),
    nome: obra.nome,
    cliente: obra.cliente || '—',
    status: obra.estado || 'Em andamento',
    dataInicio: obra.dataInicio || null,
    creditoInicial: summary.creditoInicial || 0,
    totalAbatido: summary.totalAbatido || summary.totalUtilizado || 0,
    saldoDisponivel: summary.saldoDisponivel || 0,
    servicos,
  };
}

export async function gerarRelatorioObraClientePdf(params) {
  const modelo = buildRelatorioObraCliente(params);
  if (!modelo) return false;

  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const logo = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  renderObraPdfCliente(doc, modelo, logo, autoTableMod.default);
  doc.save(`Emerson-Pinturas-Obra-${slug(modelo.nome)}-Cliente.pdf`);
  return true;
}

function renderObraPdfCliente(doc, modelo, logo, autoTable) {
  const ui = createRelatorioPdfRenderer(doc, autoTable, {
    logo,
    empresa: modelo.empresa,
    titulo: 'Relatório para o cliente',
    periodoLabel: modelo.nome,
    geradoEm: modelo.geradoEm,
    qualidade: null,
    maxPages: 0,
  });

  ui.drawCover();
  ui.kpis(
    [
      { label: 'Cliente', value: String(modelo.cliente) },
      { label: 'Estado da obra', value: String(modelo.status) },
      { label: 'Crédito inicial', value: money(modelo.creditoInicial) },
      { label: 'Total abatido', value: money(modelo.totalAbatido) },
      { label: 'Saldo disponível', value: money(modelo.saldoDisponivel), color: GREEN },
    ],
    3,
    16
  );

  ui.sectionTitle('Valores abatidos / serviços');
  ui.table(
    [
      { header: 'Semana / serviço', dataKey: 'titulo' },
      { header: 'Período', dataKey: 'periodo' },
      { header: 'Valor acordado', dataKey: 'valor' },
      { header: 'Status', dataKey: 'status' },
    ],
    modelo.servicos.map((row) => ({
      titulo: row.titulo,
      periodo: row.periodo,
      valor: row.valor,
      status: row.status,
    })),
    {
      moneyKeys: ['valor'],
      empty: 'Ainda não há serviços registados para apresentar ao cliente.',
      fontSize: 8,
      columnStyles: {
        titulo: { cellWidth: 48 },
        periodo: { cellWidth: 58 },
        valor: { halign: 'right', cellWidth: 32 },
        status: { cellWidth: 38 },
      },
    }
  );

  ui.note(
    'Documento destinado aos responsáveis da obra. Resume o crédito e os valores acordados. Não inclui custos internos da Emerson Pinturas.'
  );

  ui.drawFooters();
}
