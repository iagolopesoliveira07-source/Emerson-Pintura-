import {
  LayoutDashboard,
  HardHat,
  Users,
  Building2,
  TrendingUp,
  BarChart3,
  CalendarDays,
  CreditCard,
} from 'lucide-react';
import { formatCurrency, getTodayISO } from './formatters';
import { getPeriodRange } from './periodFilter';
import { buildResultadoInternoEmpresa } from './resultadoInternoEmpresa';
import { countObrasByStatus } from './obraStatus';
import { isDiariaPendente } from './fechamentoPagamentoCalculations';
import { isDiariaDeParceiro } from './funcionarioTipo';
import { getGastoEmpresaValor, getCompromissosEmpresa } from './gastoEmpresaCalculations';
import { getYearMonth, listViaVerdePorConferir } from './empresaFinanceiroCalculations';
import { buildAgendaProgramadas } from './despesasProgramadasAgenda';

export const HUB_ITEMS = [
  { id: 'visao', path: '/', label: 'Visão Geral', icon: LayoutDashboard, end: true },
  { id: 'obras', path: '/obras', label: 'Obras', icon: HardHat },
  { id: 'funcionarios', path: '/funcionarios', label: 'Funcionários', icon: Users },
  { id: 'gastos-empresa', path: '/gastos-empresa', label: 'Gastos da Empresa', icon: Building2 },
  { id: 'lucros', path: '/lucros', label: 'Lucros', icon: TrendingUp },
  { id: 'relatorios', path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'diarias', path: '/diarias', label: 'Diárias', icon: CalendarDays },
  { id: 'pagamentos', path: '/pagamentos', label: 'Pagamentos', icon: CreditCard },
];

function mesAtualISO(today = getTodayISO()) {
  return getYearMonth(today);
}

function totalGastosEmpresaNoMes(gastosEmpresa = [], today = getTodayISO()) {
  const mes = mesAtualISO(today);
  return (gastosEmpresa || []).reduce((sum, gasto) => {
    if (!gasto || gasto.estado !== 'pago') return sum;
    const data = String(gasto.dataPagamento || gasto.data || '').slice(0, 7);
    if (data !== mes) return sum;
    return sum + getGastoEmpresaValor(gasto);
  }, 0);
}

export function buildHubSummaries({
  obras = [],
  funcionarios = [],
  diarias = [],
  fechamentosPagamento = [],
  gastos = [],
  gastosEmpresa = [],
  pagamentos = [],
  configuracoes = {},
} = {}) {
  try {
    const obrasAtivas = countObrasByStatus(obras, 'Em andamento');
    const diariasPendentes = (diarias || []).filter(
      (item) => isDiariaPendente(item, fechamentosPagamento) && !isDiariaDeParceiro(item, funcionarios)
    ).length;
    const gastosMesEmpresa = totalGastosEmpresaNoMes(gastosEmpresa);
    const interno = buildResultadoInternoEmpresa({
      obras,
      gastos,
      gastosEmpresa,
      diarias,
      pagamentos,
      funcionarios,
      range: getPeriodRange('este_mes'),
    });

    return {
      visao: 'Painel da empresa',
      obras: obrasAtivas === 1 ? '1 obra ativa' : `${obrasAtivas} obras ativas`,
      funcionarios:
        diariasPendentes > 0
          ? diariasPendentes === 1
            ? '1 diária pendente'
            : `${diariasPendentes} diárias pendentes`
          : `${(funcionarios || []).filter((item) => item && item.estado === 'Ativo').length} activos`,
      'gastos-empresa': `Gastos do mês · ${formatCurrency(gastosMesEmpresa)}`,
      lucros: `Resultado interno · ${formatCurrency(interno.resultadoInterno)}`,
      relatorios: 'Analisar empresa →',
      diarias: diariasPendentes > 0 ? `${diariasPendentes} por pagar` : 'Registar diárias',
      pagamentos: 'Receber e pagar',
    };
  } catch (err) {
    console.error('[hub] Falha ao calcular resumos', err);
    return {
      visao: 'Painel da empresa',
      obras: 'Obras',
      funcionarios: 'Funcionários',
      'gastos-empresa': 'Gastos da empresa',
      lucros: 'Lucros',
      relatorios: 'Analisar empresa →',
      diarias: 'Diárias',
      pagamentos: 'Receber e pagar',
    };
  }
}

function diasAte(dataISO, today) {
  if (!dataISO) return null;
  const de = Date.parse(`${today}T00:00:00`);
  const para = Date.parse(`${String(dataISO).slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(de) || !Number.isFinite(para)) return null;
  return Math.round((para - de) / 86400000);
}

export function buildDashboardAttention({
  obras = [],
  funcionarios = [],
  diarias = [],
  fechamentosPagamento = [],
  valoresAcerto = [],
  gastosEmpresa = [],
  empresaDespesasProgramadas = [],
  empresaVeiculos = [],
} = {}) {
  try {
  const today = getTodayISO();
  const alerts = [];

  const agenda = buildAgendaProgramadas(empresaDespesasProgramadas, {
    gastos: gastosEmpresa,
    veiculos: empresaVeiculos,
    yearMonth: mesAtualISO(today),
    today,
  });

  if ((agenda.atrasadas || []).length > 0) {
    alerts.push({
      id: 'programadas-atraso',
      title: agenda.atrasadas.length === 1 ? 'Despesa programada em atraso' : 'Despesas programadas em atraso',
      detail: `${agenda.atrasadas.length} · ${formatCurrency(agenda.resumo?.emAtraso || 0)}`,
      path: '/gastos-empresa',
      tone: 'danger',
    });
  }

  const atrasadaIds = new Set((agenda.atrasadas || []).map((item) => item.programada?.id).filter(Boolean));
  const vencidos = getCompromissosEmpresa(gastosEmpresa, today).filter(
    (item) => item.vencido && item.estado !== 'previsto' && !atrasadaIds.has(item.despesaProgramadaId)
  );
  if (vencidos.length > 0) {
    alerts.push({
      id: 'gastos-vencidos',
      title: vencidos.length === 1 ? 'Gasto da empresa vencido' : 'Gastos da empresa vencidos',
      detail: `${vencidos.length} por pagar`,
      path: '/gastos-empresa',
      tone: 'danger',
    });
  }

  const proximasUrgentes = (agenda.proximas || []).filter((item) => {
    if (item.pago || !item.dataVencimento) return false;
    const dias = diasAte(item.dataVencimento, today);
    return dias != null && dias >= 0 && dias <= 7;
  });
  if (proximasUrgentes.length > 0) {
    const primeira = proximasUrgentes[0];
    alerts.push({
      id: 'programadas-proximas',
      title: 'Despesa programada próxima',
      detail: `${primeira.titulo} · ${proximasUrgentes.length === 1 ? 'nos próximos 7 dias' : `${proximasUrgentes.length} nos próximos 7 dias`}`,
      path: '/gastos-empresa',
      tone: 'warning',
    });
  }

  const diariasPendentes = (diarias || []).filter(
    (item) => isDiariaPendente(item, fechamentosPagamento) && !isDiariaDeParceiro(item, funcionarios)
  ).length;
  if (diariasPendentes > 0) {
    alerts.push({
      id: 'diarias-pendentes',
      title: 'Pagamento de funcionário pendente',
      detail: diariasPendentes === 1 ? '1 diária por pagar' : `${diariasPendentes} diárias por pagar`,
      path: '/diarias',
      tone: 'warning',
    });
  }

  const obrasPagamento = countObrasByStatus(obras, 'Aguardando pagamento');
  if (obrasPagamento > 0) {
    alerts.push({
      id: 'obras-pagamento',
      title: 'Obra a aguardar pagamento',
      detail: obrasPagamento === 1 ? '1 obra' : `${obrasPagamento} obras`,
      path: '/obras',
      tone: 'warning',
    });
  }

  const obrasConfirmacao = countObrasByStatus(obras, 'Aguardando confirmação');
  if (obrasConfirmacao > 0) {
    alerts.push({
      id: 'obras-confirmacao',
      title: 'Obra a aguardar confirmação',
      detail: obrasConfirmacao === 1 ? '1 obra' : `${obrasConfirmacao} obras`,
      path: '/obras',
      tone: 'info',
    });
  }

  const viaVerde = listViaVerdePorConferir(gastosEmpresa);
  if (viaVerde.length > 0) {
    alerts.push({
      id: 'via-verde',
      title: 'Via Verde por conferir',
      detail: viaVerde.length === 1 ? '1 débito' : `${viaVerde.length} débitos`,
      path: '/gastos-empresa',
      tone: 'info',
    });
  }

  return alerts;
  } catch (err) {
    console.error('[dashboard] Falha ao calcular alertas', err);
    return [];
  }
}
