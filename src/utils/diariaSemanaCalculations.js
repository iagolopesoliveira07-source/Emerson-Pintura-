import { calcDiariaTotal } from './calculations';
import { getWeekPeriod } from './pagamentoPeriodCalculations';
import { formatDate } from './formatters';
import { getDiariaObservacaoText } from './diariaObservacaoCalculations';
import { isDiariaPendente } from './fechamentoPagamentoCalculations';

export const SEMANA_STATUS = {
  PAGO: 'Pago',
  NAO_PAGO: 'Não pago',
  PARCIAL: 'Parcialmente pago',
};

const SEM_DATA_KEY = 'sem-data';

export function getDiariaSemanaKey(diaria) {
  if (!diaria?.data) return SEM_DATA_KEY;
  const period = getWeekPeriod(diaria.data);
  return `${period.inicio}_${period.fim}`;
}

export function getSemanaResumo(diarias = [], fechamentosPagamento = []) {
  const quantidade = diarias.length;
  const total = diarias.reduce((sum, diaria) => sum + calcDiariaTotal(diaria), 0);

  let totalPago = 0;
  let pendentes = 0;
  let pagas = 0;

  diarias.forEach((diaria) => {
    const valor = calcDiariaTotal(diaria);
    if (isDiariaPendente(diaria, fechamentosPagamento)) {
      pendentes += 1;
      return;
    }
    pagas += 1;
    totalPago += valor;
  });

  const totalEmAberto = Math.max(0, total - totalPago);

  let status = SEMANA_STATUS.NAO_PAGO;
  if (pendentes === 0 && pagas > 0) {
    status = SEMANA_STATUS.PAGO;
  } else if (pagas > 0 && pendentes > 0) {
    status = SEMANA_STATUS.PARCIAL;
  }

  return {
    quantidade,
    total,
    totalPago,
    totalEmAberto,
    status,
    pendentes,
    pagas,
  };
}

export function buildObservacoesSemanaResumo(diarias = []) {
  return diarias
    .map((diaria) => {
      const observacao = getDiariaObservacaoText(diaria);
      if (!observacao) return null;
      const dataLabel = diaria.data ? formatDate(diaria.data) : '—';
      return `${observacao} em ${dataLabel}`;
    })
    .filter(Boolean)
    .join(' | ');
}

export function groupDiariasBySemana(diarias = [], fechamentosPagamento = []) {
  const groups = new Map();

  diarias.forEach((diaria) => {
    const key = getDiariaSemanaKey(diaria);

    if (!groups.has(key)) {
      if (key === SEM_DATA_KEY) {
        groups.set(key, {
          key,
          inicio: null,
          fim: null,
          label: 'Sem data',
          diarias: [],
        });
      } else {
        const period = getWeekPeriod(diaria.data);
        groups.set(key, {
          key,
          inicio: period.inicio,
          fim: period.fim,
          label: period.label,
          diarias: [],
        });
      }
    }

    groups.get(key).diarias.push(diaria);
  });

  return Array.from(groups.values())
    .map((group) => {
      const sortedDiarias = [...group.diarias].sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return a.data.localeCompare(b.data);
      });

      return {
        ...group,
        diarias: sortedDiarias,
        resumo: getSemanaResumo(sortedDiarias, fechamentosPagamento),
        observacoesResumo: buildObservacoesSemanaResumo(sortedDiarias),
      };
    })
    .sort((a, b) => {
      if (!a.inicio && !b.inicio) return 0;
      if (!a.inicio) return 1;
      if (!b.inicio) return -1;
      return b.inicio.localeCompare(a.inicio);
    });
}
