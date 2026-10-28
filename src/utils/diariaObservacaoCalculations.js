import { getDiariasPendentes, sameFuncionarioId } from './fechamentoPagamentoCalculations';
import {
  getCurrentPaymentPeriod,
  getFrequenciaPagamento,
} from './pagamentoPeriodCalculations';
import { isParceiroFuncionario } from './funcionarioTipo';

function dateInPeriod(dateStr, period) {
  if (!dateStr || !period?.inicio || !period?.fim) return false;
  return dateStr >= period.inicio && dateStr <= period.fim;
}

export function filterDiariasByPaymentPeriod(diarias, period) {
  if (!period) return diarias;
  return diarias.filter((diaria) => {
    if (!diaria.data) return true;
    return dateInPeriod(diaria.data, period);
  });
}

/** Texto visível da observação (campo actual ou legado em ajustes[]), sem alterar dados. */
export function getDiariaObservacaoText(diaria) {
  const direct = diaria?.observacao?.trim();
  if (direct) return direct;

  const legacyText = (diaria?.ajustes || [])
    .map((ajuste) => ajuste?.observacao?.trim())
    .find(Boolean);

  return legacyText || '';
}

export function hasDiariaObservacao(diaria) {
  return Boolean(getDiariaObservacaoText(diaria));
}

export function getDiariasComObservacao(diarias = []) {
  return diarias.filter(hasDiariaObservacao);
}

export function buildObservacoesDiariasList(diarias = [], period = null) {
  const filtered = period ? filterDiariasByPaymentPeriod(diarias, period) : diarias;

  return getDiariasComObservacao(filtered)
    .map((diaria) => ({
      diariaId: diaria.id,
      data: diaria.data || null,
      observacao: getDiariaObservacaoText(diaria),
    }))
    .sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return a.data.localeCompare(b.data);
    });
}

export function getFuncionarioPeriodoObservacoesResumo(
  funcionario,
  diarias = [],
  fechamentosPagamento = [],
  referenceDate = new Date()
) {
  if (!funcionario) {
    return { quantidade: 0, observacoes: [], period: null };
  }

  const period = isParceiroFuncionario(funcionario)
    ? null
    : getCurrentPaymentPeriod(getFrequenciaPagamento(funcionario), referenceDate);
  const diariasFuncionario = diarias.filter((diaria) =>
    sameFuncionarioId(diaria.funcionarioId, funcionario.id)
  );
  const fonte = isParceiroFuncionario(funcionario)
    ? diariasFuncionario
    : getDiariasPendentes(funcionario.id, diarias, fechamentosPagamento, [funcionario]);
  const noPeriodo = filterDiariasByPaymentPeriod(fonte, period);
  const observacoes = buildObservacoesDiariasList(noPeriodo);

  return {
    quantidade: observacoes.length,
    observacoes,
    period,
  };
}

/** Preserva texto de ajustes legados na observação da diária, sem apagar dados. */
export function repairDiariaObservacoesFromLegacyAjustes(diarias = []) {
  let changed = false;

  const nextDiarias = diarias.map((diaria) => {
    if (hasDiariaObservacao(diaria)) return diaria;

    const legacyText = (diaria.ajustes || [])
      .map((ajuste) => ajuste?.observacao?.trim())
      .find(Boolean);

    if (!legacyText) return diaria;

    changed = true;
    return {
      ...diaria,
      observacao: legacyText,
    };
  });

  return { diarias: changed ? nextDiarias : diarias, changed };
}

export function loadDiariasWithObservacaoRepairs(diarias = []) {
  const repaired = repairDiariaObservacoesFromLegacyAjustes(diarias);
  if (repaired.changed) {
    return repaired.diarias;
  }
  return diarias;
}
