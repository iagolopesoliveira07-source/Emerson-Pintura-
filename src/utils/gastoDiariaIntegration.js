import { calcDiariaTotal } from './calculations';
import { calcTotalGastos, filterGastos } from './gastoCalculations';
import { filterDiarias, calcTotalDiarias } from './diariaCalculations';
import { getCategoriasComDadosExistentes } from '../constants/gastoCategorias';
import { getGastoCustoEmpresa } from './gastoDocumentoTipo';
import {
  formatDiariaObrasLabel,
  getDiariaAlocacoes,
  getDiariaCustoNaObra,
  getDiariaQuantidadeNaObra,
} from './diariaObraAlocacao';

/** Categoria usada na aba Gastos para diárias derivadas do módulo Diárias. */
export const GASTO_CATEGORIA_DIARIAS = 'Diárias';

/** Categorias de gastos manuais que não devem somar com diárias derivadas. */
export const GASTO_CATEGORIAS_DIARIA_LEGACY = ['Salários / Diárias', GASTO_CATEGORIA_DIARIAS];

export function isGastoFromDiaria(item) {
  return item?._source === 'diaria-grupo';
}

export function isGastoDiariaGrupo(item) {
  return item?._source === 'diaria-grupo';
}

export function getFuncionarioNome(funcionarioId, funcionarios = []) {
  if (!funcionarioId) return null;
  return funcionarios.find((f) => f.id === funcionarioId)?.nome || null;
}

function getObraNomeById(obraId, obras = []) {
  if (!obraId) return null;
  return obras.find((o) => o.id === obraId)?.nome || null;
}

/** Resumo compacto das obras num grupo diário. */
export function formatObraResumoDiariasGrupo(diarias = [], obras = [], obraFilterId = null) {
  if (obraFilterId) {
    return getObraNomeById(obraFilterId, obras) || '—';
  }

  const comObra = new Set();
  let semObra = false;

  diarias.forEach((d) => {
    getDiariaAlocacoes(d).forEach((item) => {
      if (item?.obraId) comObra.add(item.obraId);
      else semObra = true;
    });
  });

  const obrasNomes = [...comObra]
    .map((id) => getObraNomeById(id, obras))
    .filter(Boolean);

  if (obrasNomes.length === 0) return semObra ? 'Sem obra' : '—';

  if (obrasNomes.length === 1) {
    return semObra ? `${obrasNomes[0]} + sem obra` : obrasNomes[0];
  }

  if (semObra) {
    return `${obrasNomes.length} obras + sem obra`;
  }

  if (obrasNomes.length === 2) {
    return `${obrasNomes[0]} + ${obrasNomes[1]}`;
  }

  return `${obrasNomes.length} obras`;
}

function buildDiariaDetalheItem(diaria, funcionarios, obras, obraFilterId = null) {
  return {
    diariaId: diaria.id,
    funcionarioNome: getFuncionarioNome(diaria.funcionarioId, funcionarios) || '—',
    obraNome: formatDiariaObrasLabel(diaria, (id) => getObraNomeById(id, obras) || '—'),
    quantidade: obraFilterId
      ? getDiariaQuantidadeNaObra(diaria, obraFilterId)
      : diaria.quantidade,
    valor: obraFilterId ? getDiariaCustoNaObra(diaria, obraFilterId, funcionarios) : calcDiariaTotal(diaria),
  };
}

function buildDiariaGrupoView(data, items, funcionarios, obras, obraFilterId) {
  const valor = items.reduce(
    (sum, d) =>
      sum + (obraFilterId ? getDiariaCustoNaObra(d, obraFilterId, funcionarios) : calcDiariaTotal(d)),
    0
  );
  const quantidade = items.reduce(
    (sum, d) => sum + (obraFilterId ? getDiariaQuantidadeNaObra(d, obraFilterId) : d.quantidade || 0),
    0
  );
  const count = items.length;

  const detalhes = items
    .map((d) => buildDiariaDetalheItem(d, funcionarios, obras, obraFilterId))
    .sort((a, b) => a.funcionarioNome.localeCompare(b.funcionarioNome, 'pt'));

  const latestCreated = items.reduce((latest, d) => {
    const t = new Date(d.createdAt || 0).getTime();
    return t > latest ? t : latest;
  }, 0);

  return {
    id: `diaria-grupo-${data || 'sem-data'}-${obraFilterId || 'all'}`,
    _source: 'diaria-grupo',
    data: data || null,
    categoria: GASTO_CATEGORIA_DIARIAS,
    quantidade,
    valor,
    obraResumo: formatObraResumoDiariasGrupo(items, obras, obraFilterId),
    observacao: `${count} ${count === 1 ? 'diária registada' : 'diárias registradas'}`,
    _detalhes: detalhes,
    _diariaIds: items.map((d) => d.id),
    createdAt: latestCreated ? new Date(latestCreated).toISOString() : null,
    readOnly: true,
  };
}

/** Agrupa diárias filtradas por dia para exibição resumida na aba Gastos. */
export function groupDiariasToGastoViews(diarias = [], funcionarios = [], obras = [], obraFilterId = null) {
  const groups = new Map();
  const semData = [];

  diarias.forEach((d) => {
    const dateKey = d.data ? String(d.data).slice(0, 10) : null;
    if (!dateKey) {
      semData.push(d);
      return;
    }
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(d);
  });

  const views = [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, items]) =>
      buildDiariaGrupoView(dateKey, items, funcionarios, obras, obraFilterId)
    );

  if (semData.length > 0) {
    views.push(buildDiariaGrupoView(null, semData, funcionarios, obras, obraFilterId));
  }

  return views;
}

export function getCategoriasFiltroGastosPage(gastos = [], diarias = []) {
  return getCategoriasComDadosExistentes(gastos, { includeDiarias: diarias.length > 0 });
}

/** Lista unificada para a tabela da aba Gastos (gastos reais + diárias agrupadas por dia). */
export function buildGastosPageList(gastos = [], diarias = [], funcionarios = [], obras = [], filters = {}) {
  const { categoria, obraId, inicio, fim } = filters;
  const baseFilters = { obraId, inicio, fim };

  const filteredGastos = filterGastos(gastos, baseFilters);
  const filteredDiarias = filterDiarias(diarias, baseFilters);
  const diariaViews = groupDiariasToGastoViews(
    filteredDiarias,
    funcionarios,
    obras,
    obraId || null
  );

  if (categoria === GASTO_CATEGORIA_DIARIAS) {
    return diariaViews;
  }

  if (categoria) {
    return filteredGastos.filter((g) => g.categoria === categoria);
  }

  return [...filteredGastos, ...diariaViews];
}

export function sortGastosPageList(items = []) {
  return [...items].sort((a, b) => {
    const dateA = a.data ? String(a.data).slice(0, 10) : null;
    const dateB = b.data ? String(b.data).slice(0, 10) : null;

    if (!dateA && !dateB) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    if (!dateA) return 1;
    if (!dateB) return -1;
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

/**
 * Totais da aba Gastos sem duplicar diárias.
 * Diárias vêm sempre da coleção `diarias`; gastos manuais legados de mão de obra ficam de fora do subtotal de gastos.
 */
export function calcGastosPageTotals(gastos = [], diarias = [], filters = {}) {
  const { obraId, inicio, fim } = filters;
  const baseFilters = { obraId, inicio, fim };

  const filteredGastos = filterGastos(gastos, baseFilters).filter(
    (g) => !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(g.categoria)
  );
  const filteredDiarias = filterDiarias(diarias, baseFilters);

  const totalGastos = calcTotalGastos(filteredGastos);
  const totalDiarias = calcTotalDiarias(filteredDiarias, { obraId });

  return {
    totalGastos,
    totalDiarias,
    custoTotal: totalGastos + totalDiarias,
  };
}

/** Resumo por categoria de gastos reais (exclui diárias derivadas e legado de mão de obra). */
export function calcGastosPageResumo(gastos = [], diarias = [], resumoCategorias = [], filters = {}) {
  const { obraId, inicio, fim, categoria } = filters;
  const baseFilters = { obraId, inicio, fim };

  const gastosBase = filterGastos(gastos, baseFilters).filter(
    (g) => !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(g.categoria)
  );

  const diariasBase = filterDiarias(diarias, baseFilters);
  const totalDiarias = calcTotalDiarias(diariasBase, { obraId });

  const totaisResumo = {};
  resumoCategorias.forEach((cat) => {
    if (cat === 'Outros') return;
    totaisResumo[cat] = gastosBase
      .filter((g) => g.categoria === cat)
      .reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0);
  });

  const totalOutros = gastosBase
    .filter((g) => !resumoCategorias.includes(g.categoria))
    .reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0);

  if (categoria === GASTO_CATEGORIA_DIARIAS) {
    return { totaisResumo: {}, totalOutros: 0, totalDiarias };
  }

  if (categoria && categoria !== GASTO_CATEGORIA_DIARIAS) {
    const valor = gastosBase
      .filter((g) => g.categoria === categoria)
      .reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0);
    return {
      totaisResumo: { [categoria]: valor },
      totalOutros: 0,
      totalDiarias: 0,
    };
  }

  return { totaisResumo, totalOutros, totalDiarias };
}
