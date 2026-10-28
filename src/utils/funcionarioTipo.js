import { generateId } from '../services/storageService';
import { asRecordList } from './safeCollections';
import { diariaPertenceAObra, getDiariaAlocacoes, getDiariaQuantidadeNaObra } from './diariaObraAlocacao';

export const TIPO_FUNCIONARIO = {
  NORMAL: 'normal',
  PARCEIRO: 'parceiro',
};

export const TIPO_FUNCIONARIO_OPTIONS = [
  { value: TIPO_FUNCIONARIO.NORMAL, label: 'Funcionário' },
  { value: TIPO_FUNCIONARIO.PARCEIRO, label: 'Parceiro' },
];

export const PARCEIRO_SEEDS = [
  { key: 'juliano', nome: 'Juliano' },
  { key: 'fabio', nome: 'Fábio' },
];

export function normalizePessoaNome(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function primeiroNomePessoa(nome) {
  return normalizePessoaNome(nome).split(/\s+/)[0] || '';
}

export function getTipoFuncionario(funcionario) {
  if (!funcionario) return TIPO_FUNCIONARIO.NORMAL;
  if (funcionario.tipo === TIPO_FUNCIONARIO.PARCEIRO) return TIPO_FUNCIONARIO.PARCEIRO;
  return TIPO_FUNCIONARIO.NORMAL;
}

export function isParceiroFuncionario(funcionario) {
  return getTipoFuncionario(funcionario) === TIPO_FUNCIONARIO.PARCEIRO;
}

export function getTipoFuncionarioLabel(funcionarioOrTipo) {
  const tipo =
    typeof funcionarioOrTipo === 'string'
      ? funcionarioOrTipo
      : getTipoFuncionario(funcionarioOrTipo);
  return tipo === TIPO_FUNCIONARIO.PARCEIRO ? 'Parceiro' : 'Funcionário';
}

export function findFuncionarioById(funcionarios = [], id) {
  if (!id) return null;
  return asRecordList(funcionarios).find((item) => item && item.id === id) || null;
}

export function isParceiroFuncionarioId(funcionarioId, funcionarios = []) {
  return isParceiroFuncionario(findFuncionarioById(funcionarios, funcionarioId));
}

export function isDiariaDeParceiro(diaria, funcionarios = []) {
  if (!diaria) return false;
  return isParceiroFuncionarioId(diaria.funcionarioId, funcionarios);
}

export function getParceiroFuncionarios(funcionarios = []) {
  return asRecordList(funcionarios).filter(isParceiroFuncionario);
}

export function calcDiariaValorPagavel(diaria, funcionarios = []) {
  if (!diaria || isDiariaDeParceiro(diaria, funcionarios)) return 0;
  return (Number(diaria.quantidade) || 0) * (Number(diaria.valorDiaria) || 0);
}

function findByPrimeiroNome(funcionarios, key) {
  return asRecordList(funcionarios).find((item) => primeiroNomePessoa(item?.nome) === key) || null;
}

/**
 * Garante Juliano e Fábio como parceiros.
 * Não apaga nem altera outros funcionários. Em Juliano/Fábio existentes só define tipo=parceiro.
 */
export function ensureParceiroFuncionarios(funcionarios = []) {
  const list = asRecordList(funcionarios);
  let next = list;
  let changed = false;

  PARCEIRO_SEEDS.forEach((seed) => {
    const existing = findByPrimeiroNome(next, seed.key);
    if (existing) {
      const alreadyParceiro = existing.tipo === TIPO_FUNCIONARIO.PARCEIRO;
      const needsValorZero = Number(existing.valorDiaria) !== 0;
      const needsFreqClear = existing.frequenciaPagamento != null && existing.frequenciaPagamento !== '';
      if (alreadyParceiro && !needsValorZero && !needsFreqClear) return;
      changed = true;
      next = next.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              tipo: TIPO_FUNCIONARIO.PARCEIRO,
              valorDiaria: 0,
              frequenciaPagamento: null,
              updatedAt: new Date().toISOString(),
            }
          : item
      );
      return;
    }

    changed = true;
    next = [
      ...next,
      {
        id: generateId(),
        nome: seed.nome,
        telefone: '',
        valorDiaria: 0,
        dataEntrada: null,
        estado: 'Ativo',
        tipo: TIPO_FUNCIONARIO.PARCEIRO,
        observacoes: 'Parceiro de obras. As diárias servem só para controlo de presença, sem pagamento.',
        frequenciaPagamento: null,
        alugueis: [],
        descontosMensais: [],
        createdAt: new Date().toISOString(),
      },
    ];
  });

  return changed ? next : funcionarios;
}

export function buildParceiroParticipacao(funcionarioId, { diarias = [], obras = [] } = {}) {
  if (!funcionarioId) {
    return { quantidade: 0, registos: 0, obras: [], dias: [] };
  }

  const itens = asRecordList(diarias)
    .filter((diaria) => diaria && diaria.funcionarioId === funcionarioId)
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
  const obrasById = new Map(asRecordList(obras).map((obra) => [obra.id, obra]));
  const porObra = new Map();

  itens.forEach((diaria) => {
    getDiariaAlocacoes(diaria).forEach((alocacao) => {
      const key = alocacao.obraId || '__sem_obra__';
      const current = porObra.get(key) || {
        obraId: alocacao.obraId || null,
        nome: alocacao.obraId ? obrasById.get(alocacao.obraId)?.nome || 'Obra' : 'Serviço geral',
        quantidade: 0,
        registos: 0,
        dias: [],
      };
      current.quantidade += alocacao.quantidade;
      current.registos += 1;
      current.dias.push({
        id: diaria.id,
        data: diaria.data || null,
        quantidade: alocacao.quantidade,
        observacao: String(diaria.observacao || '').trim(),
      });
      porObra.set(key, current);
    });
  });

  return {
    quantidade: itens.reduce((sum, diaria) => sum + (Number(diaria.quantidade) || 0), 0),
    registos: itens.length,
    obras: [...porObra.values()],
    dias: itens.map((diaria) => ({
      id: diaria.id,
      data: diaria.data || null,
      quantidade: Number(diaria.quantidade) || 0,
      observacao: String(diaria.observacao || '').trim(),
      obraId: diaria.obraId || null,
      obraNome: getDiariaAlocacoes(diaria)
        .map((item) => (item.obraId ? obrasById.get(item.obraId)?.nome || 'Obra' : 'Serviço geral'))
        .join(' + '),
    })),
  };
}

export function buildParceiroPresencaObra(obra, { diarias = [], funcionarios = [] } = {}) {
  if (!obra?.id) return [];

  const associados = new Map();
  asRecordList(obra.funcionarios).forEach((id) => {
    const func = findFuncionarioById(funcionarios, id);
    if (isParceiroFuncionario(func)) associados.set(func.id, func);
  });
  if (obra.partnership?.parceiroFuncionarioId) {
    const func = findFuncionarioById(funcionarios, obra.partnership.parceiroFuncionarioId);
    if (isParceiroFuncionario(func)) associados.set(func.id, func);
  }
  getParceiroFuncionarios(funcionarios).forEach((func) => {
    const temDiaria = asRecordList(diarias).some(
      (diaria) => diariaPertenceAObra(diaria, obra.id) && diaria.funcionarioId === func.id
    );
    if (temDiaria) associados.set(func.id, func);
  });

  return [...associados.values()].map((func) => {
    const itens = asRecordList(diarias)
      .filter((diaria) => diariaPertenceAObra(diaria, obra.id) && diaria.funcionarioId === func.id)
      .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
    const quantidade = itens.reduce((sum, diaria) => sum + getDiariaQuantidadeNaObra(diaria, obra.id), 0);
    return {
      funcionarioId: func.id,
      nome: func.nome,
      quantidade,
      registos: itens.length,
      dias: itens.map((diaria) => ({
        id: diaria.id,
        data: diaria.data || null,
        quantidade: getDiariaQuantidadeNaObra(diaria, obra.id),
        observacao: String(diaria.observacao || '').trim(),
      })),
    };
  });
}
