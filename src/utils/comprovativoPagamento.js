import { calcDiariaTotal } from './calculations';
import { getDiariaObservacaoText } from './diariaObservacaoCalculations';
import { getWeekPeriod } from './pagamentoPeriodCalculations';
import { formatCurrency } from './formatters';

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function formatDataComprovativo(iso) {
  if (!iso) return '';
  const [year, month, day] = String(iso).slice(0, 10).split('-');
  if (!year || !month || !day) return String(iso);
  return `${day}/${month}/${year}`;
}

export function formatDataCurtaComprovativo(iso) {
  if (!iso) return '';
  const [year, month, day] = String(iso).slice(0, 10).split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}`;
}

export function weekdayCurto(iso) {
  if (!iso) return '';
  const [year, month, day] = String(iso).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return DIAS_CURTOS[new Date(year, month - 1, day).getDay()] || '';
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function chaveLinha(item) {
  const desc = String(item?.descricao || item?.motivo || '').trim().toLowerCase();
  const data = String(item?.data || '').slice(0, 10);
  const valor = roundMoney(item?.valor ?? item?.utilizado ?? item?.valorUtilizado);
  return `${desc}|${valor}|${data}`;
}

function contarLinhas(lista = []) {
  const map = new Map();
  lista.forEach((item) => {
    const key = chaveLinha(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function linhaEhAdiantamento(item) {
  const tipo = String(item?.tipoDesconto || '').toLowerCase();
  if (tipo === 'adiantamento') return true;
  if (item?.categoria === 'adiantamento' || item?.categoria === 'acerto') return true;
  return /adiant/.test(String(item?.descricao || item?.motivo || '').toLowerCase());
}

function inferCategoriaAcrescimo(texto) {
  const t = String(texto || '').toLowerCase();
  if (/gratific|b[oó]nus|bonus/.test(t)) return 'gratificacao';
  if (/hora extra|horas extra/.test(t)) return 'horas_extras';
  return 'outro';
}

function inferCategoriaDesconto(texto) {
  const t = String(texto || '').toLowerCase();
  if (/a menos|hora.?s? a menos|faltou/.test(t)) return 'horas_menos';
  if (/adiant/.test(t)) return 'adiantamento';
  return 'outro';
}

function labelCategoria(categoria, fallback) {
  if (categoria === 'horas_extras') return 'Horas extras';
  if (categoria === 'gratificacao') return 'Bónus / Gratificação';
  if (categoria === 'horas_menos') return 'Horas a menos';
  if (categoria === 'adiantamento') return 'Adiantamento';
  if (categoria === 'aluguel') return 'Aluguer';
  if (categoria === 'desconto') return 'Desconto';
  if (categoria === 'parcela') return 'Parcela';
  if (categoria === 'acerto') return 'Acerto';
  return fallback || 'Ajuste';
}

export function snapshotDiariaLinha(diaria) {
  const observacao = getDiariaObservacaoText(diaria);
  return {
    diariaId: diaria.id,
    data: diaria.data || '',
    quantidade: Number(diaria.quantidade) || 0,
    valorDiaria: Number(diaria.valorDiaria) || 0,
    total: calcDiariaTotal(diaria),
    observacao: observacao || '',
  };
}

function groupDiariasPorSemana(linhas = []) {
  const groups = new Map();
  linhas.forEach((linha) => {
    const period = linha.data ? getWeekPeriod(linha.data) : { inicio: '', fim: '', label: 'Sem data' };
    const key = `${period.inicio || 'sem-data'}_${period.fim || ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        inicio: period.inicio || '',
        fim: period.fim || '',
        label: period.inicio && period.fim
          ? `${formatDataComprovativo(period.inicio)} — ${formatDataComprovativo(period.fim)}`
          : 'Sem data',
        diarias: [],
      });
    }
    groups.get(key).diarias.push(linha);
  });
  return [...groups.values()].map((grupo) => ({
    ...grupo,
    diarias: [...grupo.diarias].sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))),
  }));
}

function periodoDasDiarias(linhas = []) {
  const datas = linhas.map((item) => item.data).filter(Boolean).sort();
  return {
    inicio: datas[0] || '',
    fim: datas[datas.length - 1] || '',
  };
}

export function buildAjustesComprovativo(preview) {
  const acrescimos = [];
  const descontos = [];
  const adiantamentos = [];

  if ((preview.totalAcrescimoBase || 0) > 0) {
    const descricao = preview.acrescimoObservacao || 'Horas extras';
    acrescimos.push({
      categoria: preview.acrescimoObservacao
        ? inferCategoriaAcrescimo(preview.acrescimoObservacao)
        : 'horas_extras',
      descricao,
      valor: roundMoney(preview.totalAcrescimoBase),
    });
  }
  if ((preview.totalGratificacao || 0) > 0) {
    acrescimos.push({
      categoria: 'gratificacao',
      descricao: preview.gratificacaoObservacao || 'Bónus / Gratificação',
      valor: roundMoney(preview.totalGratificacao),
    });
  }

  (preview.ajustesExtras || []).forEach((item) => {
    const valor = roundMoney(item.valor);
    if (!(valor > 0)) return;
    if (item.tipo === 'desconto') {
      const categoria = inferCategoriaDesconto(item.descricao);
      if (categoria === 'adiantamento') {
        pushAdiantamento(adiantamentos, {
          descricao: item.descricao || 'Adiantamento',
          valor,
          data: item.data || '',
        });
      } else {
        descontos.push({
          categoria,
          descricao: item.descricao || 'Desconto',
          valor,
        });
      }
    } else {
      acrescimos.push({
        categoria: inferCategoriaAcrescimo(item.descricao),
        descricao: item.descricao || 'Acréscimo',
        valor,
      });
    }
  });

  if ((preview.totalDescontoManualBase || 0) > 0) {
    const descricao = preview.descontoManualObservacao || 'Horas a menos';
    const categoria = preview.descontoManualObservacao
      ? inferCategoriaDesconto(preview.descontoManualObservacao)
      : 'horas_menos';
    if (categoria === 'adiantamento') {
      pushAdiantamento(adiantamentos, { descricao, valor: preview.totalDescontoManualBase });
    } else {
      descontos.push({
        categoria,
        descricao,
        valor: roundMoney(preview.totalDescontoManualBase),
      });
    }
  }

  if ((preview.totalAcertoAdicional || 0) > 0) {
    acrescimos.push({
      categoria: 'outro',
      descricao: 'Valor adicional',
      valor: roundMoney(preview.totalAcertoAdicional),
    });
  }

  (preview.recorrentesSelecionados || []).forEach((item) => {
    const descricao = item.descricao || (item.categoria === 'aluguel' ? 'Aluguer' : 'Desconto');
    const valor = roundMoney(item.valor);
    if (linhaEhAdiantamento(item)) {
      pushAdiantamento(adiantamentos, {
        descricao,
        observacao: item.observacao || '',
        valor,
        data: item.data || '',
      });
      return;
    }
    descontos.push({
      categoria: item.categoria === 'aluguel' ? 'aluguel' : 'desconto',
      descricao,
      valor,
    });
  });
  (preview.parcelasSelecionadas || []).forEach((item) => {
    const descricao = item.descricao || `Parcela ${item.numero}/${item.total}`;
    const valor = roundMoney(item.valor);
    if (linhaEhAdiantamento(item)) {
      pushAdiantamento(adiantamentos, {
        descricao,
        observacao: item.observacao || '',
        valor,
        data: item.data || '',
      });
      return;
    }
    descontos.push({
      categoria: 'parcela',
      descricao,
      valor,
    });
  });
  (preview.acertosDetalhe || []).forEach((item) => {
    if ((item.utilizado || 0) > 0) {
      pushAdiantamento(adiantamentos, {
        descricao: item.motivo || 'Adiantamento',
        observacao: item.observacao || '',
        valor: item.utilizado,
        data: item.data || '',
      });
    }
  });

  return { acrescimos, descontos, adiantamentos };
}

export function buildComprovativoSnapshot({
  funcionarioNome,
  preview,
  dataPagamento,
  empresaNome = 'Emerson Pinturas',
}) {
  const diarias = (preview.diariasSelecionadas || preview.diariasPendentes || []).map(snapshotDiariaLinha);
  const periodo = periodoDasDiarias(diarias);
  const ajustes = buildAjustesComprovativo(preview);
  return {
    versao: 2,
    geradoEm: new Date().toISOString(),
    empresaNome: empresaNome || 'Emerson Pinturas',
    funcionarioNome: funcionarioNome || '',
    dataPagamento: dataPagamento || '',
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    status: 'Pago',
    diarias,
    semanas: groupDiariasPorSemana(diarias),
    subtotalDiarias: roundMoney(preview.totalDiarias || 0),
    quantidadeDiarias: diarias.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0),
    acrescimos: ajustes.acrescimos,
    descontos: ajustes.descontos,
    adiantamentos: ajustes.adiantamentos,
    totalPago: roundMoney(preview.totalPago || 0),
  };
}

function reconstructFromFechamento(fechamento, diarias = []) {
  const byId = new Map((diarias || []).map((item) => [item.id, item]));
  const obsById = new Map(
    (fechamento.observacoesDiariasReferencia || []).map((item) => [item.diariaId, item.observacao])
  );
  const linhas = (fechamento.diariaIds || [])
    .map((id) => {
      const diaria = byId.get(id);
      if (!diaria) {
        const obs = (fechamento.observacoesDiariasReferencia || []).find((item) => item.diariaId === id);
        if (!obs) return null;
        return {
          diariaId: id,
          data: obs.data || '',
          quantidade: 0,
          valorDiaria: 0,
          total: 0,
          observacao: obs.observacao || '',
        };
      }
      const linha = snapshotDiariaLinha(diaria);
      if (obsById.has(id)) linha.observacao = obsById.get(id) || '';
      return linha;
    })
    .filter(Boolean);

  const acrescimos = [];
  const descontos = [];
  const adiantamentos = [];
  const useStructured =
    fechamento.totalAcrescimoBase != null ||
    fechamento.totalDescontoManualBase != null ||
    Array.isArray(fechamento.ajustesExtras);

  if (useStructured) {
    const structured = buildAjustesComprovativo({
      totalAcrescimoBase: fechamento.totalAcrescimoBase || 0,
      acrescimoObservacao: fechamento.acrescimoObservacao,
      totalGratificacao: fechamento.totalGratificacao || 0,
      gratificacaoObservacao: fechamento.gratificacaoObservacao,
      ajustesExtras: fechamento.ajustesExtras || [],
      totalDescontoManualBase: fechamento.totalDescontoManualBase ?? 0,
      descontoManualObservacao: fechamento.descontoManualObservacao,
      totalAcertoAdicional: fechamento.totalAcertosAdicional || 0,
      recorrentesSelecionados: fechamento.recorrentesAplicados || [],
      parcelasSelecionadas: fechamento.parcelasRegistradas || [],
      acertosDetalhe: (fechamento.acertosAcertados || []).map((item) => ({
        motivo: item.motivo,
        observacao: item.observacao || '',
        data: item.data || '',
        utilizado: item.valorUtilizado || item.utilizado || 0,
      })),
    });
    acrescimos.push(...structured.acrescimos);
    descontos.push(...structured.descontos);
    adiantamentos.push(...(structured.adiantamentos || []));
  } else {
    const totalAcrescimo = fechamento.totalAcrescimoManual ?? fechamento.totalGratificacao ?? 0;
    if (totalAcrescimo > 0) {
      acrescimos.push({
        categoria: inferCategoriaAcrescimo(fechamento.acrescimoObservacao || fechamento.gratificacaoObservacao),
        descricao: fechamento.acrescimoObservacao || fechamento.gratificacaoObservacao || 'Acréscimo',
        valor: roundMoney(totalAcrescimo),
      });
    }
    if ((fechamento.totalAcertosAdicional || 0) > 0) {
      acrescimos.push({
        categoria: 'outro',
        descricao: 'Valor adicional',
        valor: roundMoney(fechamento.totalAcertosAdicional),
      });
    }
    if ((fechamento.totalDescontoManual || 0) > 0) {
      const descricao = fechamento.descontoManualObservacao || 'Desconto';
      const categoria = inferCategoriaDesconto(descricao);
      if (categoria === 'adiantamento') {
        pushAdiantamento(adiantamentos, { descricao, valor: fechamento.totalDescontoManual });
      } else {
        descontos.push({
          categoria,
          descricao,
          valor: roundMoney(fechamento.totalDescontoManual),
        });
      }
    }
    (fechamento.recorrentesAplicados || []).forEach((item) => {
      descontos.push({
        categoria: item.categoria === 'aluguel' || item.tipo === 'aluguel' ? 'aluguel' : 'desconto',
        descricao: item.descricao || 'Desconto',
        valor: roundMoney(item.valor),
      });
    });
    (fechamento.parcelasRegistradas || []).forEach((item) => {
      descontos.push({
        categoria: 'parcela',
        descricao: item.descricao || `Parcela ${item.numero}/${item.total}`,
        valor: roundMoney(item.valor),
      });
    });
    (fechamento.acertosAcertados || []).forEach((item) => {
      if ((item.valorUtilizado || 0) > 0) {
        pushAdiantamento(adiantamentos, {
          descricao: item.motivo || 'Adiantamento',
          observacao: item.observacao || '',
          valor: item.valorUtilizado,
          data: item.data || '',
        });
      }
    });
  }

  const periodo = periodoDasDiarias(linhas);
  return {
    versao: 1,
    reconstruido: true,
    geradoEm: fechamento.createdAt || '',
    empresaNome: 'Emerson Pinturas',
    funcionarioNome: fechamento.funcionarioNome || '',
    dataPagamento: fechamento.data || '',
    periodoInicio: periodo.inicio || fechamento.periodoInicio || '',
    periodoFim: periodo.fim || fechamento.periodoFim || '',
    status: fechamento.status || 'Pago',
    diarias: linhas,
    semanas: groupDiariasPorSemana(linhas),
    subtotalDiarias: roundMoney(fechamento.totalDiarias || 0),
    quantidadeDiarias: linhas.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0),
    acrescimos,
    descontos,
    adiantamentos,
    totalPago: roundMoney(fechamento.totalPago || 0),
  };
}

function ajustesRegistradosNoFechamento(fechamento) {
  if (!fechamento) return null;
  return buildAjustesComprovativo({
    totalAcrescimoBase: fechamento.totalAcrescimoBase || 0,
    acrescimoObservacao: fechamento.acrescimoObservacao,
    totalGratificacao: fechamento.totalGratificacao || 0,
    gratificacaoObservacao: fechamento.gratificacaoObservacao,
    ajustesExtras: fechamento.ajustesExtras || [],
    totalDescontoManualBase: fechamento.totalDescontoManualBase ?? 0,
    descontoManualObservacao: fechamento.descontoManualObservacao,
    totalAcertoAdicional: fechamento.totalAcertosAdicional || 0,
    recorrentesSelecionados: fechamento.recorrentesAplicados || [],
    parcelasSelecionadas: fechamento.parcelasRegistradas || [],
    acertosDetalhe: (fechamento.acertosAcertados || []).map((item) => ({
      motivo: item.motivo,
      observacao: item.observacao || '',
      data: item.data || '',
      utilizado: item.valorUtilizado || item.utilizado || 0,
      tipoDesconto: item.tipoDesconto || '',
    })),
  });
}

function completarDiariasDoFechamento(diariasSnapshot, fechamento) {
  const atuais = (diariasSnapshot || []).map((item) => ({ ...item }));
  const porId = new Map();
  atuais.forEach((item) => {
    if (item.diariaId) porId.set(item.diariaId, item);
  });
  const obsRef = new Map(
    (fechamento.observacoesDiariasReferencia || []).map((item) => [item.diariaId, item.observacao])
  );
  (fechamento.diariasIncluidas || []).forEach((item) => {
    const id = item.id || item.diariaId;
    const obs = String(item.observacao || (id ? obsRef.get(id) : '') || '').trim();
    const existente = id ? porId.get(id) : null;
    if (existente) {
      if (!String(existente.observacao || '').trim() && obs) existente.observacao = obs;
      return;
    }
    const linha = {
      diariaId: id,
      data: item.data || '',
      quantidade: Number(item.quantidade) || 0,
      valorDiaria: Number(item.valorDiaria) || 0,
      total: roundMoney(item.valor ?? item.total ?? 0),
      observacao: obs,
    };
    atuais.push(linha);
    if (id) porId.set(id, linha);
  });
  atuais.forEach((item) => {
    if (!String(item.observacao || '').trim() && item.diariaId && obsRef.get(item.diariaId)) {
      item.observacao = String(obsRef.get(item.diariaId) || '').trim();
    }
  });
  return atuais;
}

function incorporarFaltantes(destino, esperadas, pool) {
  (esperadas || []).forEach((linha) => {
    if (!(Number(linha.valor) > 0)) return;
    const key = chaveLinha(linha);
    const restantes = pool.get(key) || 0;
    if (restantes > 0) {
      pool.set(key, restantes - 1);
      return;
    }
    destino.push(linha);
  });
}

function completarMensagemFechamento(snapshot, fechamento) {
  const next = {
    ...snapshot,
    diarias: completarDiariasDoFechamento(snapshot.diarias, fechamento),
    acrescimos: (snapshot.acrescimos || []).map((item) => ({ ...item })),
    descontos: (snapshot.descontos || []).map((item) => ({ ...item })),
    adiantamentos: (snapshot.adiantamentos || []).map((item) => ({ ...item })),
  };
  next.semanas = groupDiariasPorSemana(next.diarias);
  const esperados = ajustesRegistradosNoFechamento(fechamento);
  if (!esperados) return next;
  const pool = contarLinhas([...next.descontos, ...next.adiantamentos]);
  incorporarFaltantes(next.descontos, esperados.descontos, pool);
  incorporarFaltantes(next.adiantamentos, esperados.adiantamentos, pool);
  const poolAcrescimos = contarLinhas(next.acrescimos);
  incorporarFaltantes(next.acrescimos, esperados.acrescimos, poolAcrescimos);
  return next;
}

export function getComprovativoPagamento(fechamento, { diarias = [], empresaNome = 'Emerson Pinturas' } = {}) {
  if (!fechamento) return null;
  const base = fechamento.comprovativoSnapshot
    ? {
        ...fechamento.comprovativoSnapshot,
        diarias: (fechamento.comprovativoSnapshot.diarias || []).map((item) => ({ ...item })),
        acrescimos: (fechamento.comprovativoSnapshot.acrescimos || []).map((item) => ({ ...item })),
        descontos: (fechamento.comprovativoSnapshot.descontos || []).map((item) => ({ ...item })),
        adiantamentos: (fechamento.comprovativoSnapshot.adiantamentos || []).map((item) => ({ ...item })),
      }
    : reconstructFromFechamento(fechamento, diarias);
  const snapshot = fechamento.corrigidoEm ? base : completarMensagemFechamento(base, fechamento);
  if (empresaNome && !fechamento.comprovativoSnapshot) snapshot.empresaNome = empresaNome;
  return {
    ...snapshot,
    totalPago: roundMoney(
      fechamento.comprovativoSnapshot?.totalPago ?? fechamento.totalPago ?? snapshot.totalPago ?? 0
    ),
    fechamentoId: fechamento.id,
    corrigidoEm: fechamento.corrigidoEm || '',
    correcaoObservacao: fechamento.correcaoObservacao || '',
    snapshotOriginal: fechamento.comprovativoSnapshotOriginal || null,
  };
}

export function isLinhaAdiantamento(item) {
  if (!item) return false;
  if (item.categoria === 'adiantamento' || item.categoria === 'acerto') return true;
  return /adiant/.test(String(item.descricao || '').toLowerCase());
}

export function getComprovativoSecoes(comprovativo) {
  const acrescimos = (comprovativo?.acrescimos || []).filter((item) => Number(item.valor) > 0);
  const descontosRaw = (comprovativo?.descontos || []).filter((item) => Number(item.valor) > 0);
  const stored = comprovativo?.adiantamentos;
  const adiantamentos = Array.isArray(stored)
    ? stored.filter((item) => Number(item.valor) > 0)
    : [];
  const descontos = [];
  descontosRaw.forEach((item) => {
    if (isLinhaAdiantamento(item)) adiantamentos.push(item);
    else descontos.push(item);
  });

  const sortedAdiantamentos = [...adiantamentos].sort((a, b) =>
    String(a.data || '').localeCompare(String(b.data || ''))
  );

  return {
    acrescimos,
    descontos,
    adiantamentos: sortedAdiantamentos,
    totalAcrescimos: roundMoney(acrescimos.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)),
    totalDescontos: roundMoney(descontos.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)),
    totalAdiantamentos: roundMoney(
      sortedAdiantamentos.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
    ),
  };
}

function pushAdiantamento(list, item) {
  const valor = roundMoney(item.valor);
  if (!(valor > 0)) return;
  list.push({
    categoria: 'adiantamento',
    descricao: item.descricao || 'Adiantamento',
    observacao: item.observacao || '',
    valor,
    data: item.data || '',
  });
}

export function ajusteLabel(item) {
  if (!item) return '';
  const inferred = labelCategoria(item.categoria, '');
  const desc = (item.descricao || '').trim();
  if (!desc) return inferred || 'Ajuste';
  if (inferred && desc.toLowerCase() === inferred.toLowerCase()) return inferred;
  if (item.categoria === 'horas_extras' || item.categoria === 'gratificacao' || item.categoria === 'horas_menos') {
    return inferred;
  }
  return desc;
}

export function formatDiariaLinha(diaria) {
  const data = diaria?.data ? formatDataComprovativo(diaria.data) : '';
  const valor = formatCurrency(diaria?.total);
  const obs = String(diaria?.observacao || '').trim();
  return [data, valor, obs].filter(Boolean).join(' — ');
}

export function formatAdiantamentoLinha(item) {
  const data = formatDataComprovativo(item?.data);
  const valor = formatCurrency(item?.valor);
  const obs = String(item?.observacao || '').trim();
  const desc = String(item?.descricao || '').trim();
  const nota =
    obs ||
    (desc && desc.toLowerCase() !== 'adiantamento' && desc.toLowerCase() !== 'acerto' ? desc : '');
  return [data, valor, nota].filter(Boolean).join(' — ');
}

export function buildComprovativoTexto(comprovativo) {
  if (!comprovativo) return '';
  const secoes = getComprovativoSecoes(comprovativo);
  const diarias = comprovativo.diarias || [];
  const linhas = [];
  linhas.push(comprovativo.empresaNome || 'Emerson Pinturas');
  linhas.push('Resumo de Pagamento');
  linhas.push('');
  linhas.push(`Funcionário: ${comprovativo.funcionarioNome}`);
  if (comprovativo.periodoInicio || comprovativo.periodoFim) {
    linhas.push(
      `Período: ${formatDataComprovativo(comprovativo.periodoInicio)} a ${formatDataComprovativo(comprovativo.periodoFim)}`
    );
  }
  if (comprovativo.dataPagamento) {
    linhas.push(`Pagamento: ${formatDataComprovativo(comprovativo.dataPagamento)}`);
  }
  if (diarias.length) {
    linhas.push('');
    linhas.push('DIÁRIAS');
    diarias
      .slice()
      .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
      .forEach((diaria) => linhas.push(formatDiariaLinha(diaria)));
    if (comprovativo.subtotalDiarias) {
      linhas.push(`Subtotal das diárias: ${formatCurrency(comprovativo.subtotalDiarias)}`);
    }
  }
  if (secoes.acrescimos.length || secoes.descontos.length) {
    linhas.push('');
    linhas.push('AJUSTES');
    secoes.acrescimos.forEach((item) => {
      linhas.push(`${ajusteLabel(item)}: +${formatCurrency(item.valor)}`);
    });
    secoes.descontos.forEach((item) => {
      linhas.push(`${ajusteLabel(item)}: -${formatCurrency(item.valor)}`);
    });
  }
  if (secoes.adiantamentos.length) {
    linhas.push('');
    linhas.push('ADIANTAMENTOS');
    secoes.adiantamentos.forEach((item) => linhas.push(formatAdiantamentoLinha(item)));
    linhas.push(`Total de adiantamentos: -${formatCurrency(secoes.totalAdiantamentos)}`);
  }
  linhas.push('');
  linhas.push('RESUMO');
  if (comprovativo.subtotalDiarias) {
    linhas.push(`Diárias: ${formatCurrency(comprovativo.subtotalDiarias)}`);
  }
  if (secoes.totalAcrescimos > 0) {
    linhas.push(`Acréscimos: +${formatCurrency(secoes.totalAcrescimos)}`);
  }
  if (secoes.totalDescontos > 0) {
    linhas.push(`Descontos: -${formatCurrency(secoes.totalDescontos)}`);
  }
  if (secoes.totalAdiantamentos > 0) {
    linhas.push(`Adiantamentos: -${formatCurrency(secoes.totalAdiantamentos)}`);
  }
  linhas.push('');
  linhas.push(`TOTAL PAGO: ${formatCurrency(comprovativo.totalPago)}`);
  linhas.push('Status: Pago');
  return linhas.join('\n');
}

export async function partilharComprovativo(comprovativo) {
  const text = buildComprovativoTexto(comprovativo);
  const title = `Resumo de Pagamento — ${comprovativo.funcionarioNome || 'Pagamento'}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return { ok: true, method: 'share' };
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, method: 'share', aborted: true };
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, method: 'copy' };
  } catch {
    return { ok: false, method: 'copy', text };
  }
}

export function encodeComprovativoHash(comprovativo) {
  const payload = { ...comprovativo };
  delete payload.snapshotOriginal;
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

export function decodeComprovativoHash(hash) {
  try {
    const raw = String(hash || '').replace(/^#/, '');
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return null;
  }
}

export function buildComprovativoPublicUrl(comprovativo) {
  const encoded = encodeComprovativoHash(comprovativo);
  return `${window.location.origin}/comprovativo#${encoded}`;
}

export function printComprovativoHtml(comprovativo) {
  const html = renderComprovativoPrintHtml(comprovativo);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => frame.remove(), 800);
  };
  frame.onload = doPrint;
  setTimeout(doPrint, 400);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderComprovativoPrintHtml(comprovativo) {
  const secoes = getComprovativoSecoes(comprovativo);
  const diarias = [...(comprovativo.diarias || [])].sort((a, b) =>
    String(a.data || '').localeCompare(String(b.data || ''))
  );
  const temObs = diarias.some((diaria) => String(diaria?.observacao || '').trim());
  const row = (left, right, strong = false) =>
    `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #e5e7eb${strong ? ';font-weight:700' : ''}">${left}</td>
      <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700">${right}</td>
    </tr>`;

  const diariasHtml = diarias.length
    ? `<h2>Diárias</h2>
      <table>
        <thead><tr><th>Data</th><th>Valor</th>${temObs ? '<th>Observação</th>' : ''}</tr></thead>
        <tbody>
          ${diarias
            .map((diaria) => {
              const obs = String(diaria?.observacao || '').trim();
              return `<tr>
                <td>${escapeHtml(diaria?.data ? formatDataComprovativo(diaria.data) : '')}</td>
                <td class="num">${escapeHtml(formatCurrency(diaria?.total))}</td>
                ${temObs ? `<td>${escapeHtml(obs)}</td>` : ''}
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`
    : '';

  const resumo = [];
  if (comprovativo.subtotalDiarias) {
    resumo.push(row('Diárias', escapeHtml(formatCurrency(comprovativo.subtotalDiarias))));
  }
  secoes.acrescimos.forEach((item) => {
    resumo.push(row(escapeHtml(ajusteLabel(item)), `+${escapeHtml(formatCurrency(item.valor))}`));
  });
  secoes.descontos.forEach((item) => {
    resumo.push(row(escapeHtml(`Desconto — ${ajusteLabel(item)}`), `-${escapeHtml(formatCurrency(item.valor))}`));
  });
  secoes.adiantamentos.forEach((item) => {
    const data = item.data ? ` (${formatDataComprovativo(item.data)})` : '';
    resumo.push(row(escapeHtml(`${ajusteLabel(item)}${data}`), `-${escapeHtml(formatCurrency(item.valor))}`));
  });

  const periodo =
    comprovativo.periodoInicio || comprovativo.periodoFim
      ? `${formatDataComprovativo(comprovativo.periodoInicio)} a ${formatDataComprovativo(comprovativo.periodoFim)}`
      : '';
  const empresa = comprovativo.empresaNome || 'Emerson Pinturas';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pagamento do funcionário</title>
    <style>
      body{font-family:Segoe UI,Roboto,sans-serif;color:#1f1235;margin:16mm 14mm;line-height:1.4;font-size:13px;}
      h1{margin:2px 0 10px;font-size:18px;font-weight:700;}
      h2{margin:16px 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;}
      .empresa{margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#4b5563;}
      .meta{margin:0 0 2px;color:#374151;}
      table{width:100%;border-collapse:collapse;margin-top:4px;}
      th{text-align:left;font-size:11px;padding:6px 0;border-bottom:1px solid #d1d5db;}
      td{padding:6px 8px 6px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;}
      td.num, th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;}
      .total{margin-top:14px;padding-top:8px;border-top:1.5px solid #1f1235;display:flex;justify-content:space-between;font-weight:800;}
      .total span:last-child{font-variant-numeric:tabular-nums;font-size:16px;}
      footer{margin-top:22px;border-top:1px solid #e5e7eb;padding-top:6px;font-size:11px;color:#6b7280;display:flex;justify-content:space-between;}
    </style></head>
    <body>
      <p class="empresa">${escapeHtml(empresa)}</p>
      <h1>Pagamento do funcionário</h1>
      <p class="meta"><strong>${escapeHtml(comprovativo.funcionarioNome || '')}</strong></p>
      ${periodo ? `<p class="meta">Período: ${escapeHtml(periodo)}</p>` : ''}
      ${comprovativo.dataPagamento ? `<p class="meta">Pago em ${escapeHtml(formatDataComprovativo(comprovativo.dataPagamento))}</p>` : ''}
      ${diariasHtml}
      ${
        resumo.length
          ? `<h2>Resumo</h2><table><tbody>${resumo.join('')}</tbody></table>`
          : ''
      }
      <div class="total"><span>Líquido pago</span><span>${escapeHtml(formatCurrency(comprovativo.totalPago))}</span></div>
      <footer><span>${escapeHtml(empresa)}</span><span>Pago</span></footer>
    </body></html>`;
}
