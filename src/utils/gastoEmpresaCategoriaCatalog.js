import { generateId } from '../services/storageService';
import { GASTO_EMPRESA_GRUPOS, GASTO_EMPRESA_CATEGORIAS_ADITIVAS } from '../constants/gastoEmpresaCategorias';

const GRUPO_ANTERIORES = 'Categorias anteriores';

export function normalizeNomeCategoria(nome) {
  return String(nome || '').trim().replace(/\s+/g, ' ');
}

export function nomesCategoriaIguais(a, b) {
  return normalizeNomeCategoria(a).toLowerCase() === normalizeNomeCategoria(b).toLowerCase();
}

export function isCatalogoCategoriasValido(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.grupos);
}

export function buildCatalogoCategoriasPadrao() {
  return {
    grupos: GASTO_EMPRESA_GRUPOS.map((grupo, grupoIndex) => ({
      id: `grupo-padrao-${grupoIndex + 1}`,
      nome: grupo.grupo,
      ordem: grupoIndex,
      categorias: grupo.categorias.map((nome, catIndex) => ({
        id: `cat-padrao-${grupoIndex + 1}-${catIndex + 1}`,
        nome,
        ativo: true,
        ordem: catIndex,
      })),
    })),
  };
}

export function listarCategoriasCatalogo(catalog) {
  const grupos = isCatalogoCategoriasValido(catalog) ? catalog.grupos : [];
  const items = [];
  grupos.forEach((grupo) => {
    (grupo.categorias || []).forEach((categoria) => {
      items.push({ ...categoria, grupoId: grupo.id, grupoNome: grupo.nome });
    });
  });
  return items;
}

export function encontrarCategoriaPorNome(catalog, nome) {
  return listarCategoriasCatalogo(catalog).find((item) => nomesCategoriaIguais(item.nome, nome)) || null;
}

export function contarGastosDaCategoria(gastos = [], nome) {
  if (!nome) return 0;
  return (gastos || []).filter((gasto) => nomesCategoriaIguais(gasto.categoria, nome)).length;
}

function cloneCatalogo(catalog) {
  return JSON.parse(JSON.stringify(catalog));
}

/**
 * Acrescenta nomes usados em gastos que ainda não estão no catálogo.
 * Não altera gastos nem categorias já existentes.
 */
export function incorporarCategoriasUsadas(catalog, gastos = []) {
  const base = isCatalogoCategoriasValido(catalog) ? cloneCatalogo(catalog) : buildCatalogoCategoriasPadrao();
  const conhecidas = listarCategoriasCatalogo(base);
  const extras = [];

  (gastos || []).forEach((gasto) => {
    const nome = normalizeNomeCategoria(gasto?.categoria);
    if (!nome) return;
    const existe = conhecidas.some((item) => nomesCategoriaIguais(item.nome, nome)) || extras.includes(nome);
    if (!existe) extras.push(nome);
  });

  if (extras.length === 0) return base;

  let grupo = base.grupos.find((item) => nomesCategoriaIguais(item.nome, GRUPO_ANTERIORES));
  if (!grupo) {
    grupo = {
      id: generateId(),
      nome: GRUPO_ANTERIORES,
      ordem: base.grupos.length,
      categorias: [],
    };
    base.grupos.push(grupo);
  }

  extras.forEach((nome) => {
    grupo.categorias.push({
      id: generateId(),
      nome,
      ativo: true,
      ordem: grupo.categorias.length,
    });
  });

  return base;
}

export function carregarCatalogoCategorias(stored, gastos = []) {
  const base =
    isCatalogoCategoriasValido(stored) && stored.grupos.length > 0
      ? stored
      : buildCatalogoCategoriasPadrao();
  return incorporarCategoriasUsadas(assegurarCategoriasAditivas(base), gastos);
}

/**
 * Acrescenta categorias novas do sistema a catálogos já guardados.
 * Não renomeia, não desactiva e não remove categorias existentes.
 */
export function assegurarCategoriasAditivas(catalog) {
  const base = isCatalogoCategoriasValido(catalog) ? cloneCatalogo(catalog) : buildCatalogoCategoriasPadrao();

  GASTO_EMPRESA_CATEGORIAS_ADITIVAS.forEach(({ grupo: grupoNome, nome }) => {
    if (encontrarCategoriaPorNome(base, nome)) return;

    let grupo = base.grupos.find((item) => nomesCategoriaIguais(item.nome, grupoNome));
    if (!grupo) {
      grupo = {
        id: generateId(),
        nome: grupoNome,
        ordem: base.grupos.length,
        categorias: [],
      };
      base.grupos.push(grupo);
    }

    grupo.categorias = grupo.categorias || [];
    grupo.categorias.unshift({
      id: generateId(),
      nome,
      ativo: true,
      ordem: 0,
    });
    grupo.categorias.forEach((categoria, index) => {
      categoria.ordem = index;
    });
  });

  return base;
}

export function getGruposParaSelect(catalog, { apenasAtivas = true, incluirNome = '' } = {}) {
  const grupos = isCatalogoCategoriasValido(catalog) && catalog.grupos.length
    ? catalog.grupos
    : buildCatalogoCategoriasPadrao().grupos;

  return grupos
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((grupo) => ({
      grupo: grupo.nome,
      categorias: (grupo.categorias || [])
        .filter((categoria) => {
          if (incluirNome && nomesCategoriaIguais(categoria.nome, incluirNome)) return true;
          if (apenasAtivas) return categoria.ativo !== false;
          return true;
        })
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        .map((categoria) => categoria.nome),
    }))
    .filter((grupo) => grupo.categorias.length > 0);
}

export function adicionarGrupoCatalogo(catalog, nome) {
  const n = normalizeNomeCategoria(nome);
  if (!n) return { error: 'Indique o nome do grupo.' };

  const base = cloneCatalogo(catalog);
  if (base.grupos.some((grupo) => nomesCategoriaIguais(grupo.nome, n))) {
    return { error: 'Já existe um grupo com este nome.' };
  }

  base.grupos.push({
    id: generateId(),
    nome: n,
    ordem: base.grupos.length,
    categorias: [],
  });
  return { catalog: base };
}

export function adicionarCategoriaCatalogo(catalog, { grupoId, nome }) {
  const n = normalizeNomeCategoria(nome);
  if (!n) return { error: 'Indique o nome da categoria.' };
  if (!grupoId) return { error: 'Seleccione o grupo.' };

  const base = cloneCatalogo(catalog);
  const grupo = base.grupos.find((item) => item.id === grupoId);
  if (!grupo) return { error: 'Grupo não encontrado.' };

  const duplicadaNoGrupo = (grupo.categorias || []).some((item) => nomesCategoriaIguais(item.nome, n));
  if (duplicadaNoGrupo) {
    return { error: `A categoria "${n}" já existe neste grupo.` };
  }

  const duplicadaGlobal = listarCategoriasCatalogo(base).some((item) => nomesCategoriaIguais(item.nome, n));
  if (duplicadaGlobal) {
    return { error: `Já existe uma categoria com o nome "${n}".` };
  }

  grupo.categorias = grupo.categorias || [];
  grupo.categorias.push({
    id: generateId(),
    nome: n,
    ativo: true,
    ordem: grupo.categorias.length,
  });
  return { catalog: base };
}

export function renomearCategoriaCatalogo(catalog, { categoriaId, nome }, gastos = []) {
  const n = normalizeNomeCategoria(nome);
  if (!n) return { error: 'Indique o nome da categoria.' };
  if (!categoriaId) return { error: 'Categoria não encontrada.' };

  const base = cloneCatalogo(catalog);
  let encontrada = null;
  let grupoDaCategoria = null;

  base.grupos.forEach((grupo) => {
    (grupo.categorias || []).forEach((categoria) => {
      if (categoria.id === categoriaId) {
        encontrada = categoria;
        grupoDaCategoria = grupo;
      }
    });
  });

  if (!encontrada) return { error: 'Categoria não encontrada.' };

  const nomeAntigo = encontrada.nome;
  if (nomesCategoriaIguais(nomeAntigo, n)) {
    encontrada.nome = n;
    return { catalog: base, gastos, nomeAntigo, nomeNovo: n };
  }

  const duplicadaNoGrupo = (grupoDaCategoria.categorias || []).some(
    (item) => item.id !== categoriaId && nomesCategoriaIguais(item.nome, n)
  );
  if (duplicadaNoGrupo) {
    return { error: `A categoria "${n}" já existe neste grupo.` };
  }

  const duplicadaGlobal = listarCategoriasCatalogo(base).some(
    (item) => item.id !== categoriaId && nomesCategoriaIguais(item.nome, n)
  );
  if (duplicadaGlobal) {
    return { error: `Já existe uma categoria com o nome "${n}".` };
  }

  encontrada.nome = n;
  encontrada.updatedAt = new Date().toISOString();

  const gastosAtualizados = (gastos || []).map((gasto) => {
    if (!nomesCategoriaIguais(gasto.categoria, nomeAntigo)) return gasto;
    return { ...gasto, categoria: n };
  });

  return { catalog: base, gastos: gastosAtualizados, nomeAntigo, nomeNovo: n };
}

export function definirCategoriaAtiva(catalog, categoriaId, ativo) {
  if (!categoriaId) return { error: 'Categoria não encontrada.' };
  const base = cloneCatalogo(catalog);
  let encontrada = null;

  base.grupos.forEach((grupo) => {
    (grupo.categorias || []).forEach((categoria) => {
      if (categoria.id === categoriaId) encontrada = categoria;
    });
  });

  if (!encontrada) return { error: 'Categoria não encontrada.' };
  encontrada.ativo = Boolean(ativo);
  encontrada.updatedAt = new Date().toISOString();
  return { catalog: base };
}

export function contarCategoriasCatalogo(catalog) {
  return listarCategoriasCatalogo(catalog).length;
}
