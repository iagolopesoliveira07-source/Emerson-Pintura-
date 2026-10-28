import { generateId } from '../services/storageService';

export const ACERTO_ESTADO = {
  EM_ABERTO: 'Em aberto',
  ACERTO_PENDENTE: 'Acerto pendente',
  VALOR_ADICIONAL: 'Valor adicional',
  ACERTADO: 'Acertado',
};

export function getAcertoGastos(item) {
  return item?.gastos || [];
}

export function getTotalGastos(item) {
  return getAcertoGastos(item).reduce((sum, g) => sum + (g.valor || 0), 0);
}

export function getValorEntregue(item) {
  return item?.valorEntregue ?? item?.valor ?? 0;
}

export function getValorUtilizado(item) {
  return getTotalGastos(item);
}

export function getValorRestante(item) {
  return Math.max(0, getValorEntregue(item) - getValorUtilizado(item));
}

export function getValorADevolver(item) {
  if (isAcertoAcertado(item)) return 0;
  return getValorRestante(item);
}

export function getValorAdicionalAPagar(item) {
  if (isAcertoAcertado(item)) return 0;
  return Math.max(0, getValorUtilizado(item) - getValorEntregue(item));
}

export function isAcertoAcertado(item) {
  return item?.estado === ACERTO_ESTADO.ACERTADO || Boolean(item?.acerto);
}

export function deriveAcertoEstado(item) {
  if (isAcertoAcertado(item)) return ACERTO_ESTADO.ACERTADO;

  const utilizado = getValorUtilizado(item);
  const entregue = getValorEntregue(item);

  if (utilizado === 0) return ACERTO_ESTADO.EM_ABERTO;
  if (utilizado > entregue) return ACERTO_ESTADO.VALOR_ADICIONAL;
  if (utilizado < entregue) return ACERTO_ESTADO.ACERTO_PENDENTE;
  return ACERTO_ESTADO.ACERTO_PENDENTE;
}

export function getAcertoDisplayEstado(item) {
  return deriveAcertoEstado(item);
}

export function acertoEstadoVariant(estado) {
  if (estado === ACERTO_ESTADO.ACERTADO) return 'success';
  if (estado === ACERTO_ESTADO.ACERTO_PENDENTE) return 'warning';
  if (estado === ACERTO_ESTADO.VALOR_ADICIONAL) return 'danger';
  return 'default';
}

export function canRegisterGasto(item) {
  return !isAcertoAcertado(item);
}

export function canConfirmAcerto(item) {
  return !isAcertoAcertado(item);
}

export function addGastoToAcerto(item, { descricao, valor }) {
  const gasto = {
    id: generateId(),
    descricao: descricao.trim(),
    valor: parseFloat(valor),
    createdAt: new Date().toISOString(),
  };

  const updated = {
    ...item,
    gastos: [...getAcertoGastos(item), gasto],
    updatedAt: new Date().toISOString(),
  };

  return {
    ...updated,
    estado: deriveAcertoEstado(updated),
  };
}

export function removeGastoFromAcerto(item, gastoId) {
  if (isAcertoAcertado(item)) {
    return { error: 'Não é possível alterar gastos de um valor já acertado.' };
  }

  const updated = {
    ...item,
    gastos: getAcertoGastos(item).filter((g) => g.id !== gastoId),
    updatedAt: new Date().toISOString(),
  };

  return {
    item: {
      ...updated,
      estado: deriveAcertoEstado(updated),
    },
  };
}

export function confirmAcerto(item) {
  if (isAcertoAcertado(item)) {
    return { error: 'Este valor já foi acertado.' };
  }

  const valorUtilizado = getValorUtilizado(item);
  const valorDevolvido = getValorADevolver(item);
  const valorAdicional = getValorAdicionalAPagar(item);
  const dataAcerto = new Date().toISOString().slice(0, 10);

  return {
    item: {
      ...item,
      estado: ACERTO_ESTADO.ACERTADO,
      acerto: {
        valorUtilizado,
        valorDevolvido,
        valorAdicional,
        dataAcerto,
        createdAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getAcertoData(item) {
  const data = String(item?.data || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(data) ? data.slice(0, 10) : '';
}

export function hydrateAcertoDatas(valoresAcerto = [], adiantamentos = []) {
  const byId = new Map((adiantamentos || []).map((item) => [item.id, item]));
  let changed = false;
  const valores = (valoresAcerto || []).map((item) => {
    if (getAcertoData(item)) return item;
    const legacy = byId.get(item.id);
    const data = getAcertoData(legacy);
    if (!data) return item;
    changed = true;
    return { ...item, data };
  });
  return { valores, changed };
}

export function buildAcertoRecord(funcionarioId, form) {
  return {
    id: generateId(),
    funcionarioId,
    obraId: form.obraId || null,
    motivo: form.motivo.trim(),
    valorEntregue: parseFloat(form.valorEntregue),
    observacao: form.observacao?.trim() || '',
    data: getAcertoData(form) || null,
    gastos: [],
    acerto: null,
    estado: ACERTO_ESTADO.EM_ABERTO,
    createdAt: new Date().toISOString(),
  };
}

export function updateAcertoRecord(item, form) {
  if (isAcertoAcertado(item)) {
    return { error: 'Não é possível editar um valor já acertado.' };
  }

  return {
    item: {
      ...item,
      obraId: form.obraId || null,
      motivo: form.motivo.trim(),
      valorEntregue: parseFloat(form.valorEntregue),
      observacao: form.observacao?.trim() || '',
      data: getAcertoData(form) || item.data || null,
      estado: deriveAcertoEstado({
        ...item,
        valorEntregue: parseFloat(form.valorEntregue),
      }),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getFuncionarioAcertoSummary(funcionarioId, valoresAcerto) {
  const items = valoresAcerto.filter((v) => v.funcionarioId === funcionarioId);

  const abertos = items.filter((v) => !isAcertoAcertado(v));

  return {
    emAberto: abertos.length,
    totalEntregue: abertos.reduce((s, v) => s + getValorEntregue(v), 0),
    totalUtilizado: abertos.reduce((s, v) => s + getValorUtilizado(v), 0),
    totalADevolver: abertos.reduce((s, v) => s + getValorADevolver(v), 0),
    totalAdicionalAPagar: abertos.reduce((s, v) => s + getValorAdicionalAPagar(v), 0),
    totalJaAcertado: items
      .filter(isAcertoAcertado)
      .reduce((s, v) => s + (v.acerto?.valorUtilizado ?? getValorUtilizado(v)), 0),
  };
}

export function getGlobalAcertoSummary(valoresAcerto) {
  const abertos = valoresAcerto.filter((v) => !isAcertoAcertado(v));

  return {
    pendentes: abertos.filter(
      (v) => deriveAcertoEstado(v) === ACERTO_ESTADO.ACERTO_PENDENTE
    ).length,
    totalADevolver: abertos.reduce((s, v) => s + getValorADevolver(v), 0),
  };
}

export function migrateLegacyToValoresAcerto(adiantamentos = [], emprestimos = []) {
  const migrated = [];

  adiantamentos.forEach((adv) => {
    migrated.push({
      id: adv.id,
      funcionarioId: adv.funcionarioId,
      obraId: adv.obraId || null,
      motivo: adv.motivo || 'Adiantamento',
      valorEntregue: adv.valor,
      observacao: adv.observacao || '',
      data: getAcertoData(adv) || null,
      gastos: [],
      acerto: null,
      estado: ACERTO_ESTADO.EM_ABERTO,
      createdAt: adv.createdAt || new Date().toISOString(),
      legacySource: 'adiantamento',
    });
  });

  emprestimos.forEach((emp) => {
    const utilizado = emp.valorPago || 0;
    const gastos =
      utilizado > 0
        ? [
            {
              id: generateId(),
              descricao: 'Valor registado (migrado)',
              valor: utilizado,
              createdAt: emp.createdAt || new Date().toISOString(),
            },
          ]
        : [];

    const base = {
      id: emp.id,
      funcionarioId: emp.funcionarioId,
      obraId: emp.obraId || null,
      motivo: emp.motivo || 'Empréstimo',
      valorEntregue: emp.valor,
      observacao: emp.observacoes || emp.observacao || '',
      gastos,
      createdAt: emp.createdAt || new Date().toISOString(),
      legacySource: 'emprestimo',
    };

    if (emp.estado === 'Pago' || utilizado >= emp.valor) {
      migrated.push({
        ...base,
        estado: ACERTO_ESTADO.ACERTADO,
        acerto: {
          valorUtilizado: utilizado,
          valorDevolvido: Math.max(0, emp.valor - utilizado),
          valorAdicional: Math.max(0, utilizado - emp.valor),
          dataAcerto: emp.data || new Date().toISOString().slice(0, 10),
          createdAt: emp.createdAt || new Date().toISOString(),
        },
      });
    } else {
      migrated.push({
        ...base,
        acerto: null,
        estado: deriveAcertoEstado({ ...base, gastos }),
      });
    }
  });

  return migrated;
}
