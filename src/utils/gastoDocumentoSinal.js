import { getIvaBreakdown } from './empresaIvaRules';
import { roundMoney } from './ivaCalculations';
import {
  applySinal,
  getGastoValorAssinado,
  isNotaCredito,
} from './gastoDocumentoTipo';
import { isGastoForaDoIvaEmerson } from './gastoEmersonIva';

export {
  applySinal,
  getGastoDocumentoSinal,
  getGastoValorAssinado,
  isNotaCredito,
} from './gastoDocumentoTipo';

export function sumValoresAssinados(gastos = [], getValor = getGastoValorAssinado) {
  return (gastos || []).reduce(
    (sum, gasto) => roundMoney(sum + applySinal(getValor(gasto), gasto)),
    0
  );
}

export function getIvaBreakdownAssinado(gasto) {
  const breakdown = getIvaBreakdown(gasto);
  const suportado = breakdown.suportado == null ? null : applySinal(breakdown.suportado, gasto);
  const foraDoIvaEmerson = isGastoForaDoIvaEmerson(gasto);
  return {
    ...breakdown,
    ivaFatura: suportado,
    foraDoIvaEmerson,
    suportado,
    dedutivel:
      foraDoIvaEmerson ? (suportado == null ? null : 0) : breakdown.dedutivel == null ? null : applySinal(breakdown.dedutivel, gasto),
    naoDedutivel:
      foraDoIvaEmerson
        ? suportado == null
          ? null
          : 0
        : breakdown.naoDedutivel == null
          ? null
          : applySinal(breakdown.naoDedutivel, gasto),
  };
}

export function summarizeGastosIvaAssinado(gastos = []) {
  return (gastos || []).reduce(
    (acc, gasto) => {
      if (isGastoForaDoIvaEmerson(gasto)) return acc;
      const breakdown = getIvaBreakdown(gasto);
      if (breakdown.suportado != null) {
        acc.iva = roundMoney(acc.iva + applySinal(breakdown.suportado, gasto));
      }
      if (breakdown.dedutivel != null) {
        acc.ivaDedutivel = roundMoney(acc.ivaDedutivel + applySinal(breakdown.dedutivel, gasto));
      }
      if (breakdown.naoDedutivel != null) {
        acc.ivaNaoDedutivel = roundMoney(acc.ivaNaoDedutivel + applySinal(breakdown.naoDedutivel, gasto));
      }
      acc.total = roundMoney(acc.total + getGastoValorAssinado(gasto));
      return acc;
    },
    { total: 0, iva: 0, ivaDedutivel: 0, ivaNaoDedutivel: 0 }
  );
}
