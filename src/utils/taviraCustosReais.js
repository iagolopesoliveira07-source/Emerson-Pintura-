import STORAGE_KEYS, { generateId, setStorageItem } from '../services/storageService';
import { isAptoTaviraObra, OBRA_SPECIAL_KEY } from './obraSpecial';
import { TIPO_OBRA } from './obraTipo';
import { roundMoney } from './ivaCalculations';
import { getGastoValorAssinado } from './gastoDocumentoTipo';

const FUNCIONARIOS_TAVIRA = ['grande', 'piria', 'adilson'];
const DIAS_TAVIRA = new Set([24, 25, 26]);

export const TAVIRA_GASTO_MATERIAIS = {
  seedKey: 'tavira-gasto-materiais-982',
  categoria: 'Material',
  valor: 982,
};

export const TAVIRA_GASTO_HOSPEDAGEM = {
  seedKey: 'tavira-gasto-hospedagem-82',
  categoria: 'Hospedagem',
  valor: 82,
};

function normalizeNome(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isSemObra(item) {
  const id = item?.obraId;
  if (id == null) return true;
  const normalized = String(id).trim().toLowerCase();
  return normalized === '' || normalized === 'null' || normalized === 'undefined';
}

function dayNum(data) {
  const day = Number(String(data || '').slice(8, 10));
  return Number.isFinite(day) ? day : 0;
}

function yearMonth(data) {
  return String(data || '').slice(0, 7);
}

function gastoValor(gasto) {
  return getGastoValorAssinado(gasto);
}

function mesmosValores(a, b) {
  return Math.abs(roundMoney(a) - roundMoney(b)) < 0.009;
}

function categoriaCompativel(categoria, esperada) {
  const actual = normalizeNome(categoria);
  const want = normalizeNome(esperada);
  if (actual === want) return true;
  if (want === 'material') return actual === 'materiais' || actual.startsWith('material');
  if (want === 'hospedagem') {
    return actual === 'hospedagem' || actual === 'alojamento' || actual.startsWith('hospedagem');
  }
  return false;
}

export function findFuncionariosTaviraDias(funcionarios = []) {
  return (funcionarios || []).filter((item) => {
    const tokens = normalizeNome(item?.nome).split(/\s+/).filter(Boolean);
    return FUNCIONARIOS_TAVIRA.some((alvo) => tokens.includes(alvo));
  });
}

function findTaviraObra(obras = []) {
  const matches = (obras || []).filter(isAptoTaviraObra);
  if (matches.length === 0) return null;
  return (
    matches.find((obra) => obra.specialKey === OBRA_SPECIAL_KEY.APTO_TAVIRA) ||
    matches.find((obra) => obra.tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA) ||
    matches.find((obra) => normalizeNome(obra.nome).includes('tavira')) ||
    matches[0]
  );
}

function selectDiariasParaTavira(diarias, funcionarioIds, taviraId) {
  const selecionadas = [];

  funcionarioIds.forEach((funcionarioId) => {
    const doFuncionario = (diarias || []).filter((diaria) => diaria.funcionarioId === funcionarioId);
    const jaNaTavira = doFuncionario.filter(
      (diaria) => diaria.obraId === taviraId && DIAS_TAVIRA.has(dayNum(diaria.data))
    );
    const semObra = doFuncionario.filter(
      (diaria) => isSemObra(diaria) && DIAS_TAVIRA.has(dayNum(diaria.data))
    );

    if (semObra.length === 0) return;

    const mesesSemObra = [...new Set(semObra.map((item) => yearMonth(item.data)).filter(Boolean))].sort();
    const mesRecenteSemObra = mesesSemObra[mesesSemObra.length - 1];
    if (!mesRecenteSemObra) return;

    const mesesJaTavira = [...new Set(jaNaTavira.map((item) => yearMonth(item.data)).filter(Boolean))].sort();
    const mesRecenteTavira = mesesJaTavira[mesesJaTavira.length - 1];
    if (mesRecenteTavira && mesRecenteTavira >= mesRecenteSemObra) return;

    semObra
      .filter((item) => yearMonth(item.data) === mesRecenteSemObra)
      .forEach((item) => selecionadas.push(item));
  });

  return selecionadas;
}

function findGastoExistente(lista, spec, taviraId) {
  const byKey = (lista || []).find((item) => item.seedKey === spec.seedKey);
  if (byKey) return byKey;

  return (lista || []).find((item) => {
    if (!mesmosValores(gastoValor(item), spec.valor)) return false;
    if (!categoriaCompativel(item.categoria, spec.categoria)) return false;
    return isSemObra(item) || item.obraId === taviraId;
  });
}

function ensureObraGasto(gastos, gastosEmpresa, spec, taviraId, dataReferencia) {
  const existenteObra = findGastoExistente(gastos, spec, taviraId);
  if (existenteObra) {
    if (existenteObra.obraId === taviraId && existenteObra.seedKey === spec.seedKey) {
      return { gastos, gastosEmpresa, changed: false };
    }
    return {
      gastos: gastos.map((item) =>
        item.id === existenteObra.id
          ? {
              ...item,
              obraId: taviraId,
              seedKey: item.seedKey || spec.seedKey,
            }
          : item
      ),
      gastosEmpresa,
      changed: existenteObra.obraId !== taviraId || !existenteObra.seedKey,
    };
  }

  const existenteEmpresa = findGastoExistente(gastosEmpresa, spec, taviraId);
  if (existenteEmpresa) {
    if (existenteEmpresa.obraId === taviraId && existenteEmpresa.seedKey === spec.seedKey) {
      return { gastos, gastosEmpresa, changed: false };
    }
    return {
      gastos,
      gastosEmpresa: gastosEmpresa.map((item) =>
        item.id === existenteEmpresa.id
          ? {
              ...item,
              obraId: taviraId,
              seedKey: item.seedKey || spec.seedKey,
            }
          : item
      ),
      changed: existenteEmpresa.obraId !== taviraId || !existenteEmpresa.seedKey,
    };
  }

  const now = new Date().toISOString();
  const novo = {
    id: generateId(),
    seedKey: spec.seedKey,
    descricao: spec.categoria,
    categoria: spec.categoria,
    valor: spec.valor,
    data: dataReferencia || null,
    obraId: taviraId,
    fornecedor: '',
    observacao: '',
    createdAt: now,
  };

  return {
    gastos: [...gastos, novo],
    gastosEmpresa,
    changed: true,
  };
}

export function applyTaviraCustosReais({
  obras = [],
  funcionarios = [],
  diarias = [],
  gastos = [],
  gastosEmpresa = [],
} = {}) {
  const tavira = findTaviraObra(obras);
  if (!tavira) {
    return { obras, diarias, gastos, gastosEmpresa, changed: false };
  }

  const alvos = findFuncionariosTaviraDias(funcionarios);
  const funcionarioIds = alvos.map((item) => item.id);
  const paraAssociar = selectDiariasParaTavira(diarias, funcionarioIds, tavira.id);
  const idsParaAssociar = new Set(paraAssociar.map((item) => item.id));

  let diariasNext = diarias;
  let changed = false;

  if (idsParaAssociar.size > 0) {
    diariasNext = diarias.map((diaria) => {
      if (!idsParaAssociar.has(diaria.id)) return diaria;
      if (diaria.obraId === tavira.id) return diaria;
      changed = true;
      return { ...diaria, obraId: tavira.id };
    });
  }

  const datasTavira = diariasNext
    .filter(
      (item) =>
        item.obraId === tavira.id &&
        funcionarioIds.includes(item.funcionarioId) &&
        DIAS_TAVIRA.has(dayNum(item.data))
    )
    .map((item) => item.data)
    .filter(Boolean)
    .sort();
  const dataReferencia = datasTavira[0] || null;

  let gastosNext = gastos;
  let gastosEmpresaNext = gastosEmpresa;

  [TAVIRA_GASTO_MATERIAIS, TAVIRA_GASTO_HOSPEDAGEM].forEach((spec) => {
    const result = ensureObraGasto(gastosNext, gastosEmpresaNext, spec, tavira.id, dataReferencia);
    gastosNext = result.gastos;
    gastosEmpresaNext = result.gastosEmpresa;
    if (result.changed) changed = true;
  });

  const funcionariosObra = new Set(tavira.funcionarios || []);
  const funcionariosComDiaria = [
    ...new Set(
      diariasNext
        .filter((item) => item.obraId === tavira.id && funcionarioIds.includes(item.funcionarioId))
        .map((item) => item.funcionarioId)
    ),
  ];
  let obrasNext = obras;
  const missing = funcionariosComDiaria.filter((id) => !funcionariosObra.has(id));
  if (missing.length > 0) {
    obrasNext = obras.map((obra) =>
      obra.id === tavira.id
        ? { ...obra, funcionarios: [...(obra.funcionarios || []), ...missing] }
        : obra
    );
    changed = true;
  }

  if (changed) {
    setStorageItem(STORAGE_KEYS.diarias, diariasNext);
    setStorageItem(STORAGE_KEYS.gastos, gastosNext);
    setStorageItem(STORAGE_KEYS.gastosEmpresa, gastosEmpresaNext);
    if (obrasNext !== obras) setStorageItem(STORAGE_KEYS.obras, obrasNext);
  }

  return {
    obras: obrasNext,
    diarias: diariasNext,
    gastos: gastosNext,
    gastosEmpresa: gastosEmpresaNext,
    changed,
  };
}
