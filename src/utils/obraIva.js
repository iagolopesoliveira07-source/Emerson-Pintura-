import { calculateIva, formatTaxaIva, roundMoney } from './ivaCalculations';

/** Taxas de IVA da obra. Acrescentar aqui novas taxas no futuro. */
export const OBRA_IVA_TAXAS = [
  { id: '6', label: '6%', value: 6 },
  { id: '13', label: '13%', value: 13 },
  { id: '23', label: '23%', value: 23 },
];

export function hasObraIva(obra) {
  return Boolean(obra && obra.possuiIva === true);
}

export function isObraIvaDefinido(obra) {
  return obra?.possuiIva === true || obra?.possuiIva === false;
}

export function calculateObraIva(valorSemIva, taxaPercent) {
  return calculateIva({
    valorInformado: valorSemIva,
    tipo: 'sem_iva',
    taxaPercent,
  });
}

export function previewObraIvaFromForm(form) {
  if (form?.ivaObra !== 'sim') return null;
  const taxa = parseFloat(form.taxaIva);
  return calculateObraIva(parseFloat(form.valorContratado), taxa);
}

export function buildObraIvaFields(form, existingObra = null) {
  if (form.ivaObra === 'sim') {
    const calc = previewObraIvaFromForm(form);
    if (!calc) return null;
    return {
      possuiIva: true,
      taxaIva: calc.taxaPercent,
      valorSemIva: calc.valorSemIva,
      valorIva: calc.valorIva,
      valorComIva: calc.valorComIva,
    };
  }

  const antigaSemDefinicao =
    existingObra && existingObra.possuiIva !== true && existingObra.possuiIva !== false;

  if (antigaSemDefinicao) {
    return {};
  }

  return {
    possuiIva: false,
    taxaIva: null,
    valorSemIva: null,
    valorIva: null,
    valorComIva: null,
  };
}

/**
 * Totais para a futura área de Impostos/IVA da empresa.
 * Não é usado ainda numa página própria.
 */
export function summarizeObrasIva(obras = []) {
  return (obras || []).reduce(
    (acc, obra) => {
      if (hasObraIva(obra)) {
        acc.obrasComIva += 1;
        acc.totalSemIva = roundMoney(acc.totalSemIva + (Number(obra.valorSemIva) || 0));
        acc.totalIva = roundMoney(acc.totalIva + (Number(obra.valorIva) || 0));
        acc.totalComIva = roundMoney(acc.totalComIva + (Number(obra.valorComIva) || 0));
      } else if (obra?.possuiIva === false) {
        acc.obrasSemIva += 1;
      } else {
        acc.obrasIndefinido += 1;
      }
      return acc;
    },
    {
      obrasComIva: 0,
      obrasSemIva: 0,
      obrasIndefinido: 0,
      totalSemIva: 0,
      totalIva: 0,
      totalComIva: 0,
    }
  );
}

export function getObraIvaDisplay(obra) {
  if (hasObraIva(obra)) {
    return {
      situacao: 'Com IVA',
      taxaLabel: formatTaxaIva(obra.taxaIva),
      valorSemIva: obra.valorSemIva,
      valorIva: obra.valorIva,
      valorComIva: obra.valorComIva,
    };
  }

  return {
    situacao: 'Sem IVA',
    taxaLabel: '—',
    valorSemIva: null,
    valorIva: null,
    valorComIva: null,
  };
}

export { formatTaxaIva };
