import { generateId } from '../services/storageService';
import { roundMoney } from './ivaCalculations';
import { TIPO_OBRA } from './obraTipo';
import { calcObraCustosAcumulados, getObraRecebimentos } from './obraCustos';
import { getValorRecebidoPagamento } from './debtCalculations';
import { asRecordList } from './safeCollections';

export const FINANCIAL_MODEL_CREDIT_JOB = 'credit_job';

export function isCreditJobObra(obra) {
  if (!obra) return false;
  if (obra.prepaidCredit?.enabled === true || obra.financialModel === 'prepaid_credit') return false;
  if (obra.tipoObra === TIPO_OBRA.CREDITO) return true;
  if (obra.financialModel === FINANCIAL_MODEL_CREDIT_JOB) return true;
  return obra.creditJob?.enabled === true;
}

export function createCreditJobConfig({ enabled = true, parcelas = [] } = {}) {
  return {
    enabled: enabled !== false,
    parcelas: Array.isArray(parcelas) ? parcelas : [],
  };
}

export function getCreditJob(obra) {
  if (!isCreditJobObra(obra)) return null;
  return createCreditJobConfig(obra.creditJob || { enabled: true, parcelas: obra.parcelasCredito || [] });
}

export function createParcelaCredito({
  id,
  numero,
  valor,
  dataPrevista = null,
  observacao = '',
} = {}) {
  const amount = roundMoney(valor);
  return {
    id: id || generateId(),
    numero: Number(numero) || 1,
    valor: Number.isFinite(amount) ? amount : 0,
    dataPrevista: dataPrevista || null,
    observacao: String(observacao || '').trim(),
    createdAt: new Date().toISOString(),
  };
}

function allocateRecebimentos(parcelas, totalRecebido) {
  let remaining = roundMoney(totalRecebido);
  return asRecordList(parcelas)
    .slice()
    .sort((a, b) => (a.numero || 0) - (b.numero || 0) || String(a.dataPrevista || '').localeCompare(String(b.dataPrevista || '')))
    .map((parcela) => {
      const previsto = roundMoney(parcela.valor || 0);
      const aplicado = roundMoney(Math.max(0, Math.min(previsto, remaining)));
      remaining = roundMoney(remaining - aplicado);
      let status = 'pendente';
      if (aplicado > 0 && aplicado + 0.009 >= previsto && previsto > 0) status = 'pago';
      else if (aplicado > 0) status = 'parcial';
      return {
        ...parcela,
        valorRecebido: aplicado,
        status,
      };
    });
}

export function calcCreditJobSummary(
  obra,
  { gastos = [], diarias = [], pagamentos = [], gastosEmpresa = [], funcionarios = [] } = {}
) {
  if (!obra) return null;
  try {
    return buildCreditJobSummary(obra, { gastos, diarias, pagamentos, gastosEmpresa, funcionarios });
  } catch (err) {
    console.error('[crédito] Falha ao calcular o resumo da obra a prazo', obra?.id, err);
    return null;
  }
}

function buildCreditJobSummary(
  obra,
  { gastos = [], diarias = [], pagamentos = [], gastosEmpresa = [], funcionarios = [] } = {}
) {
  const custos = calcObraCustosAcumulados(obra.id, { gastos, diarias, gastosEmpresa, funcionarios });
  const valorAcordado = Number(obra.valorContratado);
  const temValorAcordado = Number.isFinite(valorAcordado) && valorAcordado > 0;
  const valorAcordadoSafe = temValorAcordado ? roundMoney(valorAcordado) : null;
  const totalRecebido = roundMoney(
    getObraRecebimentos(obra.id, pagamentos).reduce(
      (sum, pagamento) => sum + getValorRecebidoPagamento(pagamento),
      0
    )
  );
  const aindaAReceber = temValorAcordado ? roundMoney(Math.max(0, valorAcordadoSafe - totalRecebido)) : null;
  const resultadoCaixa = roundMoney(totalRecebido - custos.totalInvestido);
  const margemTeorica = temValorAcordado ? roundMoney(valorAcordadoSafe - custos.totalInvestido) : null;
  const progressoCusto =
    temValorAcordado && valorAcordadoSafe > 0
      ? Math.min(100, Math.round((custos.totalInvestido / valorAcordadoSafe) * 100))
      : null;

  const config = getCreditJob(obra);
  const parcelas = allocateRecebimentos(config?.parcelas || [], totalRecebido);

  return {
    valorAcordado: valorAcordadoSafe,
    temValorAcordado,
    totalRecebido,
    aindaAReceber,
    totalDiarias: custos.totalDiarias,
    totalMateriais: custos.totalMateriais,
    totalOutros: custos.totalOutros,
    totalInvestido: custos.totalInvestido,
    resultadoCaixa,
    margemTeorica,
    progressoCusto,
    parcelas,
  };
}
