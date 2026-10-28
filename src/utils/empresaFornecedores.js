import STORAGE_KEYS, { generateId, getStorageItem, setStorageItem } from '../services/storageService';
import {
  FORNECEDORES_REGRAS_CONHECIDAS,
  isDocumentoGasoleoSimples,
  isNomeProvavelMaterialObra,
  regraMaterialObraPorNome,
} from '../constants/empresaFornecedoresRegras';
import { IVA_REGRA_ORIGEM } from '../constants/empresaIva';
import { isCategoriaCarregamento } from './empresaFinanceiroCalculations';
import { resolveTaxaPercent } from './ivaCalculations';

/** Incrementar quando as regras oficiais desta lista tiverem de ser reaplicadas no cadastro. */
const FORNECEDORES_SEED_REVISION = 2;

function numeroFiscalOuNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeFornecedorNome(nome) {
  return String(nome || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeFornecedorKey(nome) {
  return normalizeFornecedorNome(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function createFornecedor(input = {}) {
  const nome = normalizeFornecedorNome(input.nome);
  return {
    id: input.id || generateId(),
    nome,
    nif: String(input.nif || '').trim(),
    categoriaPadrao: input.categoriaPadrao || '',
    subcategoriaPadrao: input.subcategoriaPadrao || '',
    taxaMaisComum: input.taxaMaisComum == null || input.taxaMaisComum === '' ? null : Number(input.taxaMaisComum),
    percentagemIvaRecuperavel:
      input.percentagemIvaRecuperavel == null || input.percentagemIvaRecuperavel === ''
        ? null
        : Number(input.percentagemIvaRecuperavel),
    ivaVariavel: input.ivaVariavel === true,
    combustivelTipo: input.combustivelTipo || '',
    seedKey: input.seedKey || null,
    seedRevision: input.seedRevision == null || input.seedRevision === '' ? null : Number(input.seedRevision),
    aliases: Array.isArray(input.aliases) ? input.aliases : [],
    observacoes: String(input.observacoes || '').trim(),
    ativo: input.ativo !== false,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function nomesFornecedorIguais(a, b) {
  const ka = normalizeFornecedorKey(a);
  const kb = normalizeFornecedorKey(b);
  return Boolean(ka) && ka === kb;
}

function asAliasList(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null && item !== '');
  if (value == null || value === '') return [];
  return [value];
}

function aliasesDaRegra(regra) {
  return [regra?.nome, ...asAliasList(regra?.aliases)].filter(Boolean);
}

function aliasCobreNome(nomeKey, aliasKey) {
  if (!nomeKey || !aliasKey) return false;
  if (nomeKey === aliasKey) return true;
  const words = nomeKey.split(' ').filter(Boolean);
  if (words.includes(aliasKey)) return true;
  if (aliasKey.includes(' ') && nomeKey.includes(aliasKey)) return true;
  return false;
}

export function findFornecedorRegraConhecida(nome) {
  const key = normalizeFornecedorKey(nome);
  if (!key) return null;

  const ranked = [];
  FORNECEDORES_REGRAS_CONHECIDAS.forEach((regra) => {
    aliasesDaRegra(regra).forEach((alias) => {
      const aliasKey = normalizeFornecedorKey(alias);
      if (!aliasKey) return;
      if (!aliasCobreNome(key, aliasKey)) return;
      ranked.push({ regra, aliasKey, exact: key === aliasKey });
    });
  });

  ranked.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    return b.aliasKey.length - a.aliasKey.length;
  });
  return ranked[0]?.regra || null;
}

export function fornecedorCorrespondeNome(fornecedor, nome) {
  if (!fornecedor || !nome) return false;
  const key = normalizeFornecedorKey(nome);
  if (!key) return false;
  if (nomesFornecedorIguais(fornecedor.nome, nome)) return true;
  const aliases = [fornecedor.nome, ...asAliasList(fornecedor.aliases)];
  if (fornecedor.seedKey) {
    const known = FORNECEDORES_REGRAS_CONHECIDAS.find((item) => item.seedKey === fornecedor.seedKey);
    if (known) aliases.push(...aliasesDaRegra(known));
  }
  return aliases.some((alias) => aliasCobreNome(key, normalizeFornecedorKey(alias)));
}

function fornecedorCorrespondeRegra(item, regra) {
  if (!item || !regra) return false;
  if (item.seedKey && item.seedKey === regra.seedKey) return true;
  const itemKey = normalizeFornecedorKey(item.nome);
  return aliasesDaRegra(regra).some((alias) => aliasCobreNome(itemKey, normalizeFornecedorKey(alias)));
}

export function findFornecedorByNome(fornecedores = [], nome) {
  const key = normalizeFornecedorKey(nome);
  if (!key) return null;
  const lista = (fornecedores || []).filter((item) => item && typeof item === 'object');
  const exact = lista.find((item) => nomesFornecedorIguais(item.nome, nome));
  if (exact) return exact;

  const ranked = [];
  lista.forEach((item) => {
    if (!fornecedorCorrespondeNome(item, nome)) return;
    const aliases = [item.nome, ...asAliasList(item.aliases)];
    if (item.seedKey) {
      const known = FORNECEDORES_REGRAS_CONHECIDAS.find((regra) => regra.seedKey === item.seedKey);
      if (known) aliases.push(...aliasesDaRegra(known));
    }
    let best = '';
    let exactAlias = false;
    aliases.forEach((alias) => {
      const aliasKey = normalizeFornecedorKey(alias);
      if (!aliasCobreNome(key, aliasKey)) return;
      if (key === aliasKey) exactAlias = true;
      if (aliasKey.length > best.length) best = aliasKey;
    });
    ranked.push({ item, aliasKey: best, exact: exactAlias || key === normalizeFornecedorKey(item.nome) });
  });
  ranked.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    return b.aliasKey.length - a.aliasKey.length;
  });
  return ranked[0]?.item || null;
}

export function getFornecedorRegraFiscal(fornecedor) {
  if (!fornecedor) return null;
  const known =
    FORNECEDORES_REGRAS_CONHECIDAS.find((item) => item.seedKey && item.seedKey === fornecedor.seedKey) ||
    findFornecedorRegraConhecida(fornecedor.nome);

  const categoriaPadrao = fornecedor.categoriaPadrao || known?.categoriaPadrao || '';
  const taxa =
    fornecedor.taxaMaisComum != null && fornecedor.taxaMaisComum !== ''
      ? Number(fornecedor.taxaMaisComum)
      : known?.taxaIva ?? null;
  const percentagem =
    fornecedor.percentagemIvaRecuperavel != null && fornecedor.percentagemIvaRecuperavel !== ''
      ? Number(fornecedor.percentagemIvaRecuperavel)
      : known?.percentagemIvaRecuperavel ?? null;

  if (!known && !categoriaPadrao && percentagem == null && taxa == null && !fornecedor.ivaVariavel) {
    if (isNomeProvavelMaterialObra(fornecedor.nome)) {
      return regraMaterialObraPorNome(fornecedor.nome);
    }
    return null;
  }

  let taxaIva = taxa;
  let percentagemIvaRecuperavel = percentagem;
  const subcategoriaPadrao = fornecedor.subcategoriaPadrao || known?.subcategoriaPadrao || '';
  let categoriaFinal = categoriaPadrao;
  if (isDocumentoGasoleoSimples(fornecedor.nome) || isDocumentoGasoleoSimples(subcategoriaPadrao)) {
    if (taxaIva == null) taxaIva = 23;
    if (percentagemIvaRecuperavel == null) percentagemIvaRecuperavel = 50;
    if (!categoriaFinal) categoriaFinal = 'Combustível';
  }

  return {
    nome: fornecedor.nome || known?.nome || '',
    categoriaPadrao: categoriaFinal,
    subcategoriaPadrao,
    taxaIva,
    percentagemIvaRecuperavel,
    ivaVariavel: fornecedor.ivaVariavel === true || known?.ivaVariavel === true,
    combustivelTipo: fornecedor.combustivelTipo || known?.combustivelTipo || '',
  };
}

export function applyFornecedorRegraToForm(form, fornecedor) {
  if (!form || !fornecedor) return form;
  const regra = getFornecedorRegraFiscal(fornecedor);
  const next = {
    ...form,
    fornecedorId: fornecedor.id || form.fornecedorId || '',
    fornecedorNome: fornecedor.nome || form.fornecedorNome,
    fornecedor: fornecedor.nome || form.fornecedor || form.fornecedorNome,
  };
  if (!regra) return next;

  const manterCarregamento =
    isCategoriaCarregamento(form.categoria) && !isCategoriaCarregamento(regra.categoriaPadrao);

  if (regra.categoriaPadrao && !manterCarregamento) {
    next.categoria = regra.categoriaPadrao;
    if (!next.descricao || next.descricao === form.categoria) next.descricao = regra.categoriaPadrao;
  }
  if (regra.combustivelTipo && !manterCarregamento) next.combustivelTipo = regra.combustivelTipo;

  next.temIva = 'sim';
  if (!manterCarregamento) next.ivaManual = 'nao';
  if (!next.valorBaseTipo) next.valorBaseTipo = 'com_iva';
  if (regra.subcategoriaPadrao && !manterCarregamento) next.tipoDespesa = regra.subcategoriaPadrao;

  if (regra.ivaVariavel && !manterCarregamento) {
    next.faturaMultiplasTaxas = 'sim';
    next.taxaIvaPreset = '';
    next.taxaIvaOutra = '';
    if (!(next.ivaLinhas || []).length) {
      next.ivaLinhas = [
        { id: generateId(), valorBase: '', taxaIva: '' },
        { id: generateId(), valorBase: '', taxaIva: '' },
      ];
    }
  } else if (regra.taxaIva != null && Number.isFinite(Number(regra.taxaIva)) && !manterCarregamento) {
    const taxa = Number(regra.taxaIva);
    next.faturaMultiplasTaxas = 'nao';
    next.taxaIvaPreset = taxa === 23 || taxa === 13 || taxa === 6 ? String(taxa) : 'outra';
    if (next.taxaIvaPreset === 'outra') next.taxaIvaOutra = String(taxa);
    else next.taxaIvaOutra = '';
  }

  if (
    regra.percentagemIvaRecuperavel != null &&
    Number.isFinite(Number(regra.percentagemIvaRecuperavel)) &&
    (!manterCarregamento || isCategoriaCarregamento(regra.categoriaPadrao))
  ) {
    next.percentagemDedutivel = String(regra.percentagemIvaRecuperavel);
  }

  if (
    !manterCarregamento &&
    !regra.ivaVariavel &&
    (isDocumentoGasoleoSimples(form.tipoDespesa) ||
      isDocumentoGasoleoSimples(form.descricao) ||
      isDocumentoGasoleoSimples(fornecedor.nome))
  ) {
    if (!next.taxaIvaPreset) {
      next.taxaIvaPreset = '23';
      next.faturaMultiplasTaxas = 'nao';
    }
    if (next.percentagemDedutivel === '' || next.percentagemDedutivel == null) {
      next.percentagemDedutivel = '50';
    }
  }

  const cat = String(next.categoria || '').toLowerCase();
  if ((cat === 'material' || cat.startsWith('material ')) && !next.faturaEmNomeEmpresa) {
    next.faturaEmNomeEmpresa = 'sim';
  }
  return next;
}

function mergeAliases(existing = [], extra = []) {
  const seen = new Set();
  const out = [];
  const a = Array.isArray(existing) ? existing : existing ? [existing] : [];
  const b = Array.isArray(extra) ? extra : extra ? [extra] : [];
  [...a, ...b].forEach((alias) => {
    const key = normalizeFornecedorKey(alias);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(String(alias).trim());
  });
  return out;
}

export function ensureFornecedoresRegrasConhecidas(fornecedores = []) {
  const list = (Array.isArray(fornecedores) ? fornecedores : []).filter(
    (item) => item && typeof item === 'object'
  );
  let changed = list.length !== (Array.isArray(fornecedores) ? fornecedores.length : 0);
  const usedIds = new Set();

  FORNECEDORES_REGRAS_CONHECIDAS.forEach((regra) => {
    let existing =
      list.find((item) => item.seedKey === regra.seedKey) ||
      list.find((item) => !usedIds.has(item.id) && fornecedorCorrespondeRegra(item, regra));

    if (existing) {
      usedIds.add(existing.id);
      const next = { ...existing };
      if (!next.seedKey) next.seedKey = regra.seedKey;
      next.aliases = mergeAliases(next.aliases, aliasesDaRegra(regra));
      if ((existing.seedRevision || 0) < FORNECEDORES_SEED_REVISION) {
        next.categoriaPadrao = regra.categoriaPadrao || next.categoriaPadrao || '';
        next.subcategoriaPadrao = regra.subcategoriaPadrao || '';
        next.taxaMaisComum = regra.taxaIva == null ? null : regra.taxaIva;
        next.percentagemIvaRecuperavel =
          regra.percentagemIvaRecuperavel == null ? null : regra.percentagemIvaRecuperavel;
        next.ivaVariavel = Boolean(regra.ivaVariavel);
        if (regra.combustivelTipo) next.combustivelTipo = regra.combustivelTipo;
        next.seedRevision = FORNECEDORES_SEED_REVISION;
      }
      const same =
        next.seedKey === existing.seedKey &&
        next.seedRevision === existing.seedRevision &&
        JSON.stringify(next.aliases || []) === JSON.stringify(existing.aliases || []) &&
        next.categoriaPadrao === existing.categoriaPadrao &&
        next.subcategoriaPadrao === existing.subcategoriaPadrao &&
        next.taxaMaisComum === existing.taxaMaisComum &&
        next.percentagemIvaRecuperavel === existing.percentagemIvaRecuperavel &&
        Boolean(next.ivaVariavel) === Boolean(existing.ivaVariavel) &&
        (next.combustivelTipo || '') === (existing.combustivelTipo || '');
      if (same) return;
      next.updatedAt = new Date().toISOString();
      const index = list.findIndex((item) => item.id === existing.id);
      list[index] = next;
      changed = true;
      return;
    }

    list.push(
      createFornecedor({
        nome: regra.nome,
        categoriaPadrao: regra.categoriaPadrao,
        subcategoriaPadrao: regra.subcategoriaPadrao,
        taxaMaisComum: regra.taxaIva,
        percentagemIvaRecuperavel: regra.percentagemIvaRecuperavel,
        ivaVariavel: regra.ivaVariavel,
        combustivelTipo: regra.combustivelTipo,
        seedKey: regra.seedKey,
        aliases: aliasesDaRegra(regra),
        seedRevision: FORNECEDORES_SEED_REVISION,
      })
    );
    changed = true;
  });

  return { fornecedores: list, changed };
}

export function loadEmpresaFornecedores(stored) {
  let list = [];
  try {
    const raw = Array.isArray(stored) ? stored : getStorageItem(STORAGE_KEYS.empresaFornecedores, []);
    list = Array.isArray(raw) ? raw.filter((item) => item && typeof item === 'object') : [];
  } catch {
    list = [];
  }
  try {
    const result = ensureFornecedoresRegrasConhecidas(list);
    if (result.changed) setStorageItem(STORAGE_KEYS.empresaFornecedores, result.fornecedores);
    return Array.isArray(result.fornecedores) ? result.fornecedores : list;
  } catch {
    return list;
  }
}

export function suggestFornecedores(fornecedores = [], query) {
  const q = normalizeFornecedorKey(query);
  const ativos = (fornecedores || []).filter((item) => item && typeof item === 'object' && item.ativo !== false);
  if (!q) return ativos.slice(0, 8);
  return ativos
    .filter((item) => {
      const nome = normalizeFornecedorKey(item.nome);
      if (nome.includes(q)) return true;
      return asAliasList(item.aliases).some((alias) => normalizeFornecedorKey(alias).includes(q));
    })
    .slice(0, 8);
}

export function suggestCategoriaFromFornecedor(fornecedor, gastos = []) {
  const regra = getFornecedorRegraFiscal(fornecedor);
  if (regra?.categoriaPadrao) return regra.categoriaPadrao;
  if (fornecedor?.categoriaPadrao) return fornecedor.categoriaPadrao;
  if (!fornecedor?.id && !fornecedor?.nome) return '';
  const nome = normalizeFornecedorKey(fornecedor.nome);
  const counts = {};
  (gastos || []).forEach((gasto) => {
    const mesmo =
      gasto.fornecedorId === fornecedor.id ||
      normalizeFornecedorKey(gasto.fornecedorNome) === nome;
    if (!mesmo || !gasto.categoria) return;
    counts[gasto.categoria] = (counts[gasto.categoria] || 0) + 1;
  });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || '';
}

export function resolveFornecedorIvaOptions(form, { fornecedores = [], regras = [] } = {}) {
  const nome = form?.fornecedorNome || form?.fornecedor;
  const existing =
    (form?.fornecedorId && (fornecedores || []).find((item) => item?.id === form.fornecedorId)) ||
    findFornecedorByNome(fornecedores, nome);
  const known = findFornecedorRegraConhecida(nome);
  const material = !existing && !known && isNomeProvavelMaterialObra(nome) ? regraMaterialObraPorNome(nome) : null;
  return {
    regras,
    fornecedor: getFornecedorRegraFiscal(existing) || known || material,
  };
}

export function resolveFornecedorParaPreenchimento(fornecedores = [], nome) {
  const typed = normalizeFornecedorNome(nome);
  if (!typed) return null;
  const existing = findFornecedorByNome(fornecedores, typed);
  if (existing) return existing;
  const known = findFornecedorRegraConhecida(typed);
  if (known) {
    return {
      nome: typed,
      categoriaPadrao: known.categoriaPadrao,
      subcategoriaPadrao: known.subcategoriaPadrao,
      taxaMaisComum: known.taxaIva,
      percentagemIvaRecuperavel: known.percentagemIvaRecuperavel,
      ivaVariavel: known.ivaVariavel,
      combustivelTipo: known.combustivelTipo,
      seedKey: known.seedKey,
      aliases: known.aliases,
      id: '',
    };
  }
  if (isNomeProvavelMaterialObra(typed)) {
    return {
      nome: typed,
      ...regraMaterialObraPorNome(typed),
      taxaMaisComum: 23,
      id: '',
    };
  }
  return null;
}

export function fiscalPadraoFromForm(form, ivaSnapshot = null) {
  const taxaForm = resolveTaxaPercent(form);
  const taxaIva = Number.isFinite(taxaForm)
    ? Number(taxaForm)
    : numeroFiscalOuNull(ivaSnapshot?.taxaIva);

  const fromForm = numeroFiscalOuNull(form?.percentagemDedutivel);
  let percentagemIvaRecuperavel = fromForm;
  if (percentagemIvaRecuperavel == null && ivaSnapshot?.percentagemDedutivel != null) {
    const origem = ivaSnapshot.regraIvaOrigem;
    if (origem !== IVA_REGRA_ORIGEM.VEICULO) {
      percentagemIvaRecuperavel = numeroFiscalOuNull(ivaSnapshot.percentagemDedutivel);
    }
  }

  return {
    categoria: form?.categoria || '',
    taxaIva,
    percentagemIvaRecuperavel,
    ivaVariavel: form?.faturaMultiplasTaxas === 'sim' || form?.faturaMultiplasTaxas === true,
  };
}

export function stripFornecedorSaveFields(record = {}) {
  const { salvarFornecedor: _salvar, salvarFornecedorFiscal: _fiscal, ...rest } = record || {};
  return rest;
}

export function podeSalvarFornecedorRegra(nome) {
  return Boolean(normalizeFornecedorNome(nome));
}

export function upsertFornecedorFromGasto(
  fornecedores = [],
  {
    nome,
    categoria,
    taxaIva,
    percentagemIvaRecuperavel,
    ivaVariavel,
    createIfMissing = false,
  } = {}
) {
  const n = normalizeFornecedorNome(nome);
  if (!n) return { fornecedores, fornecedor: null, changed: false };
  const lista = Array.isArray(fornecedores) ? fornecedores : [];

  const existing = findFornecedorByNome(lista, n);
  const known = findFornecedorRegraConhecida(n);
  const resolvedCategoria = categoria || known?.categoriaPadrao || '';
  const resolvedTaxa = numeroFiscalOuNull(taxaIva) ?? known?.taxaIva ?? null;
  const resolvedPct = numeroFiscalOuNull(percentagemIvaRecuperavel) ?? known?.percentagemIvaRecuperavel ?? null;
  const resolvedVariavel = ivaVariavel === true || known?.ivaVariavel === true;

  if (existing) {
    const next = { ...existing };
    let changed = false;

    if (known) {
      if (!next.seedKey) {
        next.seedKey = known.seedKey;
        changed = true;
      }
      const aliases = mergeAliases(next.aliases, aliasesDaRegra(known));
      if (JSON.stringify(aliases) !== JSON.stringify(next.aliases || [])) {
        next.aliases = aliases;
        changed = true;
      }
    }

    if (createIfMissing) {
      if (resolvedCategoria && next.categoriaPadrao !== resolvedCategoria) {
        next.categoriaPadrao = resolvedCategoria;
        changed = true;
      }
      if (resolvedTaxa != null && next.taxaMaisComum !== resolvedTaxa) {
        next.taxaMaisComum = resolvedTaxa;
        changed = true;
      }
      if (resolvedPct != null && next.percentagemIvaRecuperavel !== resolvedPct) {
        next.percentagemIvaRecuperavel = resolvedPct;
        changed = true;
      }
      if (resolvedVariavel && !next.ivaVariavel) {
        next.ivaVariavel = true;
        changed = true;
      }
    }

    if (!changed) return { fornecedores, fornecedor: existing, changed: false };
    next.updatedAt = new Date().toISOString();
    return {
      fornecedores: lista.map((item) => (item && item.id === existing.id ? next : item)),
      fornecedor: next,
      changed: true,
    };
  }

  if (!createIfMissing) {
    return { fornecedores, fornecedor: null, changed: false };
  }

  const created = createFornecedor({
    nome: n,
    categoriaPadrao: resolvedCategoria,
    subcategoriaPadrao: known?.subcategoriaPadrao || '',
    taxaMaisComum: resolvedTaxa,
    percentagemIvaRecuperavel: resolvedPct,
    ivaVariavel: resolvedVariavel,
    combustivelTipo: known?.combustivelTipo || '',
    seedKey: known?.seedKey || null,
    aliases: known ? aliasesDaRegra(known) : [],
  });
  return { fornecedores: [...lista, created], fornecedor: created, changed: true };
}

export function upsertFornecedorFromRecord(fornecedores, record, salvarFornecedor) {
  try {
    const nome = record?.fornecedorNome || record?.fornecedor;
    if (!nome) return { fornecedores, fornecedor: null, changed: false };
    const fiscal = record?.salvarFornecedorFiscal || {};
    return upsertFornecedorFromGasto(fornecedores, {
      nome,
      categoria: fiscal.categoria || record?.categoria,
      taxaIva: fiscal.taxaIva ?? record?.taxaIva,
      percentagemIvaRecuperavel:
        fiscal.percentagemIvaRecuperavel ?? record?.percentagemDedutivel ?? record?.percentualIvaRecuperavel,
      ivaVariavel: fiscal.ivaVariavel === true || record?.faturaMultiplasTaxas === true,
      createIfMissing: salvarFornecedor === true,
    });
  } catch {
    return { fornecedores, fornecedor: null, changed: false };
  }
}

export function findPossibleDuplicateGasto(gastos = [], { fornecedorNome, numeroFatura, valor, excludeId } = {}) {
  const nome = normalizeFornecedorKey(fornecedorNome);
  const numero = String(numeroFatura || '').trim().toLowerCase();
  const v = Number(valor);
  if (!nome || !numero || !Number.isFinite(v)) return null;
  return (
    (gastos || []).find((gasto) => {
      if (excludeId && gasto.id === excludeId) return false;
      const mesmoNome = normalizeFornecedorKey(gasto.fornecedorNome) === nome;
      const mesmoNumero = String(gasto.numeroFatura || '').trim().toLowerCase() === numero;
      const mesmoValor = Math.abs(Number(gasto.valor) - v) < 0.02;
      return mesmoNome && mesmoNumero && mesmoValor;
    }) || null
  );
}
