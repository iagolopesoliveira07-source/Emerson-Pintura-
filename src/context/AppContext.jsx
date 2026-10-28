import { createContext, useContext, useReducer, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import STORAGE_KEYS, {
  getStorageItem,
  setStorageItem,
  generateId,
  resetApplicationData as clearLocalBusinessData,
  storageHasExistingBusinessData,
  persistOfficialState,
  compactBackupArchive,
} from '../services/storageService';
import { getInitialData } from '../data/mockData';
import {
  migrateLegacyToValoresAcerto,
  addGastoToAcerto,
  confirmAcerto,
  hydrateAcertoDatas,
} from '../utils/acertoCalculations';
import {
  buildPaymentPreview,
  buildFechamentoRecord,
  buildReferenciaMes,
  buildReferenciaPagamento,
  buildPagamentoDescricao,
  applyParcelasToFuncionario,
  applyRecorrentesToFuncionario,
  retirarDescontoDoFechamento,
  canConfirmFechamento,
  repairPaymentDiariaLinks,
  markDiariaComoPaga,
  markDiariaComoPagaManual,
  sameFuncionarioId,
  isDiariaPendente,
} from '../utils/fechamentoPagamentoCalculations';
import { desfazerLancamentoDesconto } from '../utils/commitmentCalculations';
import { getReferenciaMesAno } from '../utils/semanaMesCalculations';
import { buildComprovativoSnapshot } from '../utils/comprovativoPagamento';
import {
  applyHotelDommeRemoval,
  collectHotelDommeRemovalPlan,
  migrateHotelDommeData,
} from '../utils/hotelDommeCalculations';
import { loadDiariasWithObservacaoRepairs } from '../utils/diariaObservacaoCalculations';
import { pruneDiariaObraDeleted } from '../utils/diariaObraAlocacao';
import { applyObraFinancialModels } from '../utils/obraSpecial';
import { ensureDomesLakeHotelObra } from '../utils/obraDomesLakeHotel';
import { syncCaixaParceriaComGasto } from '../utils/obraParceriaAcertos';
import { applyTaviraCustosReais } from '../utils/taviraCustosReais';
import { ensureParceiroFuncionarios, isParceiroFuncionario, isDiariaDeParceiro } from '../utils/funcionarioTipo';
import { applyConcluidaEmOnStatusChange, sortObrasForDisplay } from '../utils/obraStatus';
import { applyPendingRestoreIfAny, runAutomaticBackupIfDue } from '../services/backupService';
import {
  getCurrentPaymentPeriod,
  getFrequenciaPagamento,
  frequenciaToTipoPagamento,
  migrateFuncionarioFrequencias,
} from '../utils/pagamentoPeriodCalculations';
import {
  carregarCatalogoCategorias,
  buildCatalogoCategoriasPadrao,
  renomearCategoriaCatalogo,
} from '../utils/gastoEmpresaCategoriaCatalog';
import { loadEmpresaFinanceiroState } from '../utils/empresaFinanceiroSeed';
import { loadEmpresaIvaRegras } from '../utils/empresaIvaRules';
import {
  loadEmpresaFornecedores,
  stripFornecedorSaveFields,
  upsertFornecedorFromRecord,
} from '../utils/empresaFornecedores';
import {
  getGastosEmpresaAtivos,
  getGastosEmpresaLixeira,
} from '../utils/gastoEmpresaCalculations';
import { appendGastoEmpresaHistorico } from '../utils/gastoEmpresaSeguranca';

const AppContext = createContext(null);

function loadValoresAcerto() {
  let valores = getStorageItem(STORAGE_KEYS.valoresAcerto, []);

  if (!getStorageItem(STORAGE_KEYS.valoresAcertoMigrated)) {
    const adiantamentos = getStorageItem(STORAGE_KEYS.adiantamentos, []);
    const emprestimos = getStorageItem(STORAGE_KEYS.emprestimos, []);
    const migrated = migrateLegacyToValoresAcerto(adiantamentos, emprestimos);
    const existingIds = new Set(valores.map((v) => v.id));
    valores = [...valores, ...migrated.filter((m) => !existingIds.has(m.id))];
    setStorageItem(STORAGE_KEYS.valoresAcerto, valores);
    setStorageItem(STORAGE_KEYS.valoresAcertoMigrated, true);
  }

  const hydrated = hydrateAcertoDatas(valores, getStorageItem(STORAGE_KEYS.adiantamentos, []));
  if (hydrated.changed) {
    setStorageItem(STORAGE_KEYS.valoresAcerto, hydrated.valores);
  }
  return hydrated.valores;
}

function loadDiariasData() {
  const diarias = getStorageItem(STORAGE_KEYS.diarias, []);
  const repaired = loadDiariasWithObservacaoRepairs(diarias);

  if (repaired !== diarias) {
    setStorageItem(STORAGE_KEYS.diarias, repaired);
  }

  return repaired;
}

function loadPaymentData() {
  const storedDiarias = loadDiariasData();
  const storedFechamentos = getStorageItem(STORAGE_KEYS.fechamentosPagamento, []);
  const repaired = repairPaymentDiariaLinks(storedDiarias, storedFechamentos);

  if (repaired.diarias !== storedDiarias) {
    setStorageItem(STORAGE_KEYS.diarias, repaired.diarias);
  }
  if (repaired.fechamentos !== storedFechamentos) {
    setStorageItem(STORAGE_KEYS.fechamentosPagamento, repaired.fechamentos);
  }

  return repaired;
}

function loadFuncionarios() {
  const stored = getStorageItem(STORAGE_KEYS.funcionarios, []);
  const migrated = migrateFuncionarioFrequencias(stored);
  const withPartners = ensureParceiroFuncionarios(migrated);

  if (withPartners !== stored) {
    setStorageItem(STORAGE_KEYS.funcionarios, withPartners);
  }

  return withPartners;
}

function persistHotelDommeRemoval(nextState, plan) {
  setStorageItem(STORAGE_KEYS.obras, nextState.obras);
  setStorageItem(STORAGE_KEYS.diarias, nextState.diarias);
  setStorageItem(STORAGE_KEYS.gastos, nextState.gastos);
  setStorageItem(STORAGE_KEYS.pagamentos, nextState.pagamentos);
  setStorageItem(STORAGE_KEYS.valoresAcerto, nextState.valoresAcerto);
  setStorageItem(STORAGE_KEYS.hotelDommeControles, nextState.hotelDommeControles);

  console.info('[Hotel Domme] Obra removida em definitivo. Registos afectados:', {
    obras: plan.obras.map((obra) => ({ id: obra.id, nome: obra.nome, cliente: obra.cliente })),
    diarias: plan.diarias.map((item) => item.id),
    gastos: plan.gastos.map((item) => item.id),
    pagamentos: plan.pagamentos.map((item) => item.id),
    valoresAcertoDesvinculados: plan.valoresAcertoUnlink.map((item) => item.id),
    controles: plan.controles.map((item) => item.obraId),
  });
}

function removeHotelDommeFromState(state) {
  const plan = collectHotelDommeRemovalPlan(state);
  if (!plan.hasChanges) return state;

  const nextState = applyHotelDommeRemoval(state, plan);
  persistHotelDommeRemoval(nextState, plan);
  return nextState;
}

function loadHotelDommeData(obras) {
  const controles = getStorageItem(STORAGE_KEYS.hotelDommeControles, []);
  const migrated = migrateHotelDommeData(obras, controles);

  if (migrated.changed) {
    setStorageItem(STORAGE_KEYS.hotelDommeControles, migrated.controles);
  }

  return {
    obras: migrated.obras,
    controles: migrated.controles,
  };
}

function applyTaviraRealCosts(stateSlice) {
  try {
    const synced = applyTaviraCustosReais(stateSlice);
    return {
      obras: synced.obras,
      diarias: synced.diarias,
      gastos: synced.gastos,
      gastosEmpresa: synced.gastosEmpresa,
    };
  } catch (err) {
    console.error('[app] Falha ao sincronizar custos de Tavira', err);
    return {
      obras: stateSlice?.obras || [],
      diarias: stateSlice?.diarias || [],
      gastos: stateSlice?.gastos || [],
      gastosEmpresa: stateSlice?.gastosEmpresa || [],
    };
  }
}

function applyParceriaAcertoModelo(state) {
  return state;
}

function sincronizarCaixaObraComGasto(obras, gasto, previous = null) {
  try {
    if (!gasto?.obraId) return null;
    const obra = (obras || []).find((item) => item && item.id === gasto.obraId);
    if (!obra) return null;
    const next = syncCaixaParceriaComGasto(obra, gasto, previous);
    if (!next || next === obra) return null;
    return next;
  } catch (error) {
    console.error('[parceria] Falha ao sincronizar caixa com gasto', error);
    return null;
  }
}

function applyDomesLakeHotelSeed(state) {
  try {
    const result = ensureDomesLakeHotelObra(state.obras || []);
    if (!result.created && !result.updated) return state;
    return { ...state, obras: result.obras };
  } catch (err) {
    console.error('[app] Falha ao sincronizar Domes Lake Hotel', err);
    return state;
  }
}

function loadFinanceiroState() {
  const seeded = loadEmpresaFinanceiroState();
  return {
    empresaVeiculos: seeded.veiculos,
    empresaDespesasProgramadas: seeded.despesasProgramadas,
    empresaValoresRecuperar: seeded.valoresRecuperar,
    empresaFinanceiroSeedKeys: seeded.appliedKeys,
    gastosEmpresa: seeded.gastosEmpresa,
    empresaFornecedores: loadEmpresaFornecedores(getStorageItem(STORAGE_KEYS.empresaFornecedores, [])),
    empresaIvaRegras: loadEmpresaIvaRegras(getStorageItem(STORAGE_KEYS.empresaIvaRegras, [])),
  };
}

function initState() {
  applyPendingRestoreIfAny();

  let initialized = getStorageItem(STORAGE_KEYS.initialized);
  if (!initialized && storageHasExistingBusinessData()) {
    setStorageItem(STORAGE_KEYS.initialized, true);
    initialized = true;
  }
  if (!initialized) {
    const data = getInitialData();
    Object.entries({
      [STORAGE_KEYS.obras]: data.obras,
      [STORAGE_KEYS.funcionarios]: data.funcionarios,
      [STORAGE_KEYS.diarias]: data.diarias,
      [STORAGE_KEYS.adiantamentos]: data.adiantamentos,
      [STORAGE_KEYS.emprestimos]: data.emprestimos,
      [STORAGE_KEYS.valoresAcerto]: data.valoresAcerto,
      [STORAGE_KEYS.valoresAcertoMigrated]: true,
      [STORAGE_KEYS.gastos]: data.gastos,
      [STORAGE_KEYS.gastosEmpresa]: [],
      [STORAGE_KEYS.gastosEmpresaCategorias]: carregarCatalogoCategorias(null, []),
      [STORAGE_KEYS.ivaEntregar]: [],
      [STORAGE_KEYS.pagamentos]: data.pagamentos,
      [STORAGE_KEYS.fechamentosPagamento]: data.fechamentosPagamento || [],
      [STORAGE_KEYS.configuracoes]: data.configuracoes,
      [STORAGE_KEYS.hotelDommeControles]: [],
      [STORAGE_KEYS.initialized]: true,
    }).forEach(([key, value]) => setStorageItem(key, value));
    const funcionarios = loadFuncionarios();
    const hotelDommeData = loadHotelDommeData(data.obras);
    let obras = Array.isArray(hotelDommeData.obras) ? hotelDommeData.obras : [];
    try {
      obras = applyObraFinancialModels(obras, { funcionarios });
    } catch (err) {
      console.error('[app] Falha ao aplicar modelos financeiros das obras', err);
    }
    const financeiro = loadFinanceiroState();
    const tavira = applyTaviraRealCosts({
      obras,
      funcionarios,
      diarias: getStorageItem(STORAGE_KEYS.diarias, data.diarias),
      gastos: getStorageItem(STORAGE_KEYS.gastos, data.gastos),
      gastosEmpresa: financeiro.gastosEmpresa,
    });
    return applyParceriaAcertoModelo(applyDomesLakeHotelSeed(
      removeHotelDommeFromState({
        ...data,
        ...financeiro,
        obras: tavira.obras,
        diarias: tavira.diarias,
        gastos: tavira.gastos,
        hotelDommeControles: hotelDommeData.controles,
        fechamentosPagamento: data.fechamentosPagamento || [],
        ivaEntregar: [],
        gastosEmpresa: tavira.gastosEmpresa,
        gastosEmpresaCategorias: carregarCatalogoCategorias(null, tavira.gastosEmpresa),
        loading: false,
      })
    ));
  }

  const paymentData = loadPaymentData();
  const funcionarios = loadFuncionarios();
  const storedObras = getStorageItem(STORAGE_KEYS.obras, []);
  const hotelDommeData = loadHotelDommeData(storedObras);
  let obras = Array.isArray(hotelDommeData.obras) ? hotelDommeData.obras : [];
  try {
    obras = applyObraFinancialModels(obras, { funcionarios });
  } catch (err) {
    console.error('[app] Falha ao aplicar modelos financeiros das obras', err);
  }
  const financeiro = loadFinanceiroState();
  const tavira = applyTaviraRealCosts({
    obras,
    funcionarios,
    diarias: paymentData.diarias,
    gastos: getStorageItem(STORAGE_KEYS.gastos, []),
    gastosEmpresa: financeiro.gastosEmpresa,
  });

  return applyParceriaAcertoModelo(applyDomesLakeHotelSeed(
    removeHotelDommeFromState({
      ...financeiro,
      obras: tavira.obras,
      funcionarios,
      diarias: tavira.diarias,
      adiantamentos: getStorageItem(STORAGE_KEYS.adiantamentos, []),
      emprestimos: getStorageItem(STORAGE_KEYS.emprestimos, []),
      valoresAcerto: loadValoresAcerto(),
      gastos: tavira.gastos,
      gastosEmpresa: tavira.gastosEmpresa,
      gastosEmpresaCategorias: carregarCatalogoCategorias(
        getStorageItem(STORAGE_KEYS.gastosEmpresaCategorias, null),
        tavira.gastosEmpresa
      ),
      ivaEntregar: getStorageItem(STORAGE_KEYS.ivaEntregar, []),
      pagamentos: getStorageItem(STORAGE_KEYS.pagamentos, []),
      fechamentosPagamento: paymentData.fechamentos,
      hotelDommeControles: hotelDommeData.controles,
      configuracoes: getStorageItem(STORAGE_KEYS.configuracoes, getInitialData().configuracoes),
      loading: false,
    })
  ));
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_OBRAS':
      return { ...state, obras: action.payload };
    case 'ADD_OBRA':
      return {
        ...state,
        obras: [...state.obras, applyConcluidaEmOnStatusChange(null, action.payload)],
      };
    case 'UPDATE_OBRA': {
      const obraAnterior = state.obras.find((o) => o.id === action.payload.id);
      const obraAtualizada = applyConcluidaEmOnStatusChange(obraAnterior, action.payload);
      return {
        ...state,
        obras: state.obras.map((o) => (o.id === action.payload.id ? obraAtualizada : o)),
      };
    }
    case 'DELETE_OBRA':
      return {
        ...state,
        obras: state.obras.filter((o) => o && o.id !== action.payload),
        diarias: state.diarias
          .map((d) => pruneDiariaObraDeleted(d, action.payload))
          .filter(Boolean),
        gastos: state.gastos.filter((g) => g && g.obraId !== action.payload),
        pagamentos: state.pagamentos.filter((p) => p && p.obraId !== action.payload),
        hotelDommeControles: state.hotelDommeControles.filter(
          (c) => c && c.obraId !== action.payload
        ),
      };
    case 'SET_FUNCIONARIOS':
      return { ...state, funcionarios: action.payload };
    case 'ADD_FUNCIONARIO':
      return { ...state, funcionarios: [...state.funcionarios, action.payload] };
    case 'UPDATE_FUNCIONARIO': {
      const previous = state.funcionarios.find((f) => f.id === action.payload.id);
      let pagamentos = state.pagamentos;

      if (previous && previous.nome !== action.payload.nome) {
        pagamentos = state.pagamentos.map((p) =>
          p.tipo === 'Pagamento a funcionário' && p.pessoaRelacionada === previous.nome
            ? { ...p, pessoaRelacionada: action.payload.nome }
            : p
        );
      }

      return {
        ...state,
        funcionarios: state.funcionarios.map((f) =>
          f.id === action.payload.id ? action.payload : f
        ),
        pagamentos,
      };
    }
    case 'DELETE_FUNCIONARIO': {
      const funcionarioId = action.payload;
      const funcionario = state.funcionarios.find((f) => f.id === funcionarioId);

      return {
        ...state,
        funcionarios: state.funcionarios.filter((f) => f.id !== funcionarioId),
        diarias: state.diarias.filter((d) => d.funcionarioId !== funcionarioId),
        adiantamentos: state.adiantamentos.filter((a) => a.funcionarioId !== funcionarioId),
        emprestimos: state.emprestimos.filter((e) => e.funcionarioId !== funcionarioId),
        valoresAcerto: state.valoresAcerto.filter((v) => v.funcionarioId !== funcionarioId),
        fechamentosPagamento: state.fechamentosPagamento.filter(
          (f) => f.funcionarioId !== funcionarioId
        ),
        pagamentos: state.pagamentos.filter(
          (p) =>
            !(
              funcionario &&
              p.tipo === 'Pagamento a funcionário' &&
              p.pessoaRelacionada === funcionario.nome
            )
        ),
        obras: state.obras.map((o) => ({
          ...o,
          funcionarios: (o.funcionarios || []).filter((id) => id !== funcionarioId),
        })),
      };
    }
    case 'ADD_DIARIA':
      return { ...state, diarias: [...state.diarias, action.payload] };
    case 'UPDATE_DIARIA':
      return {
        ...state,
        diarias: state.diarias.map((d) => (d.id === action.payload.id ? action.payload : d)),
      };
    case 'DELETE_DIARIA':
      return {
        ...state,
        diarias: state.diarias.filter((d) => d.id !== action.payload),
      };
    case 'EXECUTE_FECHAMENTO_PAGAMENTO': {
      const {
        fechamento,
        pagamento,
        diariasUpdates = [],
        funcionarioUpdate,
        valoresAcertoUpdates = [],
        gastos = [],
      } = action.payload;

      const diariaMap = new Map(diariasUpdates.map((d) => [d.id, d]));
      const acertoMap = new Map(valoresAcertoUpdates.map((v) => [v.id, v]));
      const fechamentoFinal = {
        ...fechamento,
        diariaIds:
          diariasUpdates.length > 0
            ? diariasUpdates.map((d) => d.id)
            : fechamento.diariaIds || [],
      };

      return {
        ...state,
        fechamentosPagamento: [...state.fechamentosPagamento, fechamentoFinal],
        pagamentos: pagamento ? [...state.pagamentos, pagamento] : state.pagamentos,
        diarias: state.diarias.map((d) => diariaMap.get(d.id) || d),
        funcionarios: funcionarioUpdate
          ? state.funcionarios.map((f) => (f.id === funcionarioUpdate.id ? funcionarioUpdate : f))
          : state.funcionarios,
        valoresAcerto: state.valoresAcerto.map((v) => acertoMap.get(v.id) || v),
        gastos: [...state.gastos, ...gastos],
      };
    }
    case 'UPDATE_FECHAMENTO_PAGAMENTO':
      return {
        ...state,
        fechamentosPagamento: state.fechamentosPagamento.map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
    case 'ADD_VALOR_ACERTO':
      return { ...state, valoresAcerto: [...state.valoresAcerto, action.payload] };
    case 'UPDATE_VALOR_ACERTO':
      return {
        ...state,
        valoresAcerto: state.valoresAcerto.map((v) =>
          v.id === action.payload.id ? action.payload : v
        ),
      };
    case 'DELETE_VALOR_ACERTO':
      return {
        ...state,
        valoresAcerto: state.valoresAcerto.filter((v) => v.id !== action.payload),
      };
    case 'ADD_ADIANTAMENTO':
      return { ...state, adiantamentos: [...state.adiantamentos, action.payload] };
    case 'UPDATE_ADIANTAMENTO':
      return {
        ...state,
        adiantamentos: state.adiantamentos.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    case 'DELETE_ADIANTAMENTO':
      return {
        ...state,
        adiantamentos: state.adiantamentos.filter((a) => a.id !== action.payload),
      };
    case 'ADD_EMPRESTIMO':
      return { ...state, emprestimos: [...state.emprestimos, action.payload] };
    case 'UPDATE_EMPRESTIMO':
      return {
        ...state,
        emprestimos: state.emprestimos.map((e) =>
          e.id === action.payload.id ? action.payload : e
        ),
      };
    case 'DELETE_EMPRESTIMO':
      return {
        ...state,
        emprestimos: state.emprestimos.filter((e) => e.id !== action.payload),
      };
    case 'ADD_GASTO':
      return { ...state, gastos: [...state.gastos, action.payload] };
    case 'UPDATE_GASTO':
      return {
        ...state,
        gastos: state.gastos.map((g) => (g.id === action.payload.id ? action.payload : g)),
      };
    case 'DELETE_GASTO':
      return {
        ...state,
        gastos: state.gastos.filter((g) => g.id !== action.payload),
      };
    case 'ADD_IVA_ENTREGAR':
      return { ...state, ivaEntregar: [...(state.ivaEntregar || []), action.payload] };
    case 'UPDATE_IVA_ENTREGAR':
      return {
        ...state,
        ivaEntregar: (state.ivaEntregar || []).map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
    case 'DELETE_IVA_ENTREGAR':
      return {
        ...state,
        ivaEntregar: (state.ivaEntregar || []).filter((item) => item.id !== action.payload),
      };
    case 'ADD_GASTOS_EMPRESA':
      return {
        ...state,
        gastosEmpresa: [...(state.gastosEmpresa || []), ...action.payload],
      };
    case 'UPDATE_GASTO_EMPRESA':
      return {
        ...state,
        gastosEmpresa: (state.gastosEmpresa || []).map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
    case 'DELETE_GASTO_EMPRESA':
      return {
        ...state,
        gastosEmpresa: (state.gastosEmpresa || []).filter((item) => item.id !== action.payload),
      };
    case 'RESTORE_GASTO_EMPRESA':
      return {
        ...state,
        gastosEmpresa: (state.gastosEmpresa || []).map((item) => {
          if (item.id !== action.payload) return item;
          const next = { ...item, updatedAt: new Date().toISOString() };
          delete next.deletedAt;
          delete next.deleted_at;
          return next;
        }),
      };
    case 'HARD_DELETE_GASTO_EMPRESA':
      return {
        ...state,
        gastosEmpresa: (state.gastosEmpresa || []).filter((item) => item.id !== action.payload),
      };
    case 'SET_GASTOS_EMPRESA_CATEGORIAS':
      return { ...state, gastosEmpresaCategorias: action.payload };
    case 'RENAME_GASTO_EMPRESA_CATEGORIA':
      return {
        ...state,
        gastosEmpresaCategorias: action.payload.catalog,
        gastosEmpresa: action.payload.gastosEmpresa,
      };
    case 'ADD_EMPRESA_VEICULO':
      return { ...state, empresaVeiculos: [...(state.empresaVeiculos || []), action.payload] };
    case 'UPDATE_EMPRESA_VEICULO':
      return {
        ...state,
        empresaVeiculos: (state.empresaVeiculos || []).map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
    case 'DELETE_EMPRESA_VEICULO':
      return {
        ...state,
        empresaVeiculos: (state.empresaVeiculos || []).filter((item) => item.id !== action.payload),
      };
    case 'SET_EMPRESA_FORNECEDORES':
      return { ...state, empresaFornecedores: action.payload };
    case 'SET_EMPRESA_IVA_REGRAS':
      return { ...state, empresaIvaRegras: action.payload };
    case 'ADD_DESPESA_PROGRAMADA':
      return {
        ...state,
        empresaDespesasProgramadas: [...(state.empresaDespesasProgramadas || []), action.payload],
      };
    case 'UPDATE_DESPESA_PROGRAMADA':
      return {
        ...state,
        empresaDespesasProgramadas: (state.empresaDespesasProgramadas || []).map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
    case 'DELETE_DESPESA_PROGRAMADA':
      return {
        ...state,
        empresaDespesasProgramadas: (state.empresaDespesasProgramadas || []).filter(
          (item) => item.id !== action.payload
        ),
      };
    case 'ADD_VALOR_RECUPERAR':
      return {
        ...state,
        empresaValoresRecuperar: [...(state.empresaValoresRecuperar || []), action.payload],
      };
    case 'UPDATE_VALOR_RECUPERAR':
      return {
        ...state,
        empresaValoresRecuperar: (state.empresaValoresRecuperar || []).map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
    case 'DELETE_VALOR_RECUPERAR':
      return {
        ...state,
        empresaValoresRecuperar: (state.empresaValoresRecuperar || []).filter(
          (item) => item.id !== action.payload
        ),
      };
    case 'ADD_PAGAMENTO': {
      const incoming = action.payload;
      if (
        incoming?.acertoParceriaId &&
        (state.pagamentos || []).some(
          (item) =>
            item &&
            (item.acertoParceriaId === incoming.acertoParceriaId || item.id === incoming.id)
        )
      ) {
        return state;
      }
      return { ...state, pagamentos: [...state.pagamentos, incoming] };
    }
    case 'UPDATE_PAGAMENTO':
      return {
        ...state,
        pagamentos: state.pagamentos.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'DELETE_PAGAMENTO':
      return {
        ...state,
        pagamentos: state.pagamentos.filter((p) => p.id !== action.payload),
      };
    case 'ADD_HOTEL_DOMME_MOVIMENTO':
      return {
        ...state,
        hotelDommeControles: state.hotelDommeControles.map((controle) =>
          controle.obraId === action.payload.obraId
            ? {
                ...controle,
                movimentos: [...(controle.movimentos || []), action.payload.movimento],
              }
            : controle
        ),
      };
    case 'UPDATE_HOTEL_DOMME_MOVIMENTO':
      return {
        ...state,
        hotelDommeControles: state.hotelDommeControles.map((controle) =>
          controle.obraId === action.payload.obraId
            ? {
                ...controle,
                movimentos: (controle.movimentos || []).map((movimento) =>
                  movimento.id === action.payload.movimento.id
                    ? action.payload.movimento
                    : movimento
                ),
              }
            : controle
        ),
      };
    case 'DELETE_HOTEL_DOMME_MOVIMENTO':
      return {
        ...state,
        hotelDommeControles: state.hotelDommeControles.map((controle) =>
          controle.obraId === action.payload.obraId
            ? {
                ...controle,
                movimentos: (controle.movimentos || []).filter(
                  (movimento) => movimento.id !== action.payload.movimentoId
                ),
              }
            : controle
        ),
      };
    case 'UPDATE_CONFIGURACOES':
      return { ...state, configuracoes: action.payload };
    case 'RESET_APPLICATION_DATA':
      return {
        ...state,
        obras: [],
        funcionarios: [],
        diarias: [],
        adiantamentos: [],
        emprestimos: [],
        valoresAcerto: [],
        fechamentosPagamento: [],
        gastos: [],
        gastosEmpresa: [],
        gastosEmpresaCategorias: buildCatalogoCategoriasPadrao(),
        empresaVeiculos: [],
        empresaDespesasProgramadas: [],
        empresaValoresRecuperar: [],
        empresaFinanceiroSeedKeys: [],
        empresaFornecedores: [],
        empresaIvaRegras: [],
        ivaEntregar: [],
        pagamentos: [],
        hotelDommeControles: [],
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, initState);
  const hydratedRef = useRef(false);

  useLayoutEffect(() => {
    compactBackupArchive();
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    persistOfficialState(state);
  }, [state]);

  useEffect(() => {
    runAutomaticBackupIfDue();
  }, []);

  const addObra = useCallback((obra) => {
    const newObra = { ...obra, id: generateId(), createdAt: new Date().toISOString() };
    dispatch({ type: 'ADD_OBRA', payload: newObra });
    return newObra;
  }, []);

  const updateObra = useCallback((obra) => {
    dispatch({ type: 'UPDATE_OBRA', payload: obra });
  }, []);

  const deleteObra = useCallback((obraId) => {
    dispatch({ type: 'DELETE_OBRA', payload: obraId });
  }, []);

  const addFuncionario = useCallback((func) => {
    const newFunc = { ...func, id: generateId(), createdAt: new Date().toISOString() };
    dispatch({ type: 'ADD_FUNCIONARIO', payload: newFunc });
    return newFunc;
  }, []);

  const updateFuncionario = useCallback((func) => {
    dispatch({ type: 'UPDATE_FUNCIONARIO', payload: func });
  }, []);

  const deleteFuncionario = useCallback((funcionarioId) => {
    dispatch({ type: 'DELETE_FUNCIONARIO', payload: funcionarioId });
  }, []);

  const addDiaria = useCallback((diaria) => {
    const newDiaria = { ...diaria, id: generateId(), createdAt: new Date().toISOString() };
    dispatch({ type: 'ADD_DIARIA', payload: newDiaria });
    return newDiaria;
  }, []);

  const updateDiaria = useCallback((diaria) => {
    dispatch({ type: 'UPDATE_DIARIA', payload: diaria });
  }, []);

  const marcarDiariaComoPaga = useCallback(
    (diariaId, dataPagamento = null) => {
      const diaria = state.diarias.find((d) => d.id === diariaId);
      if (!diaria) return { error: 'Diária não encontrada.' };
      if (isDiariaDeParceiro(diaria, state.funcionarios)) {
        return { error: 'Diárias de parceiro são só controlo de presença. Não geram pagamento.' };
      }
      if (!isDiariaPendente(diaria, state.fechamentosPagamento)) {
        return { error: 'Esta diária já está paga.' };
      }

      const updated = markDiariaComoPagaManual(diaria, dataPagamento);
      dispatch({ type: 'UPDATE_DIARIA', payload: updated });
      return { diaria: updated };
    },
    [state.diarias, state.fechamentosPagamento, state.funcionarios]
  );

  const deleteDiaria = useCallback((diariaId) => {
    dispatch({ type: 'DELETE_DIARIA', payload: diariaId });
  }, []);

  const addAdiantamento = useCallback((adv) => {
    const newAdv = { ...adv, id: generateId(), createdAt: new Date().toISOString() };
    dispatch({ type: 'ADD_ADIANTAMENTO', payload: newAdv });
    return newAdv;
  }, []);

  const updateAdiantamento = useCallback((adv) => {
    dispatch({ type: 'UPDATE_ADIANTAMENTO', payload: adv });
  }, []);

  const deleteAdiantamento = useCallback((adiantamentoId) => {
    dispatch({ type: 'DELETE_ADIANTAMENTO', payload: adiantamentoId });
  }, []);

  const addEmprestimo = useCallback((emp) => {
    const newEmp = {
      ...emp,
      id: generateId(),
      valorPago: emp.valorPago || 0,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_EMPRESTIMO', payload: newEmp });
    return newEmp;
  }, []);

  const updateEmprestimo = useCallback((emp) => {
    dispatch({ type: 'UPDATE_EMPRESTIMO', payload: emp });
  }, []);

  const deleteEmprestimo = useCallback((emprestimoId) => {
    dispatch({ type: 'DELETE_EMPRESTIMO', payload: emprestimoId });
  }, []);

  const addValorAcerto = useCallback((valorAcerto) => {
    dispatch({ type: 'ADD_VALOR_ACERTO', payload: valorAcerto });
    return valorAcerto;
  }, []);

  const updateValorAcerto = useCallback((valorAcerto) => {
    dispatch({ type: 'UPDATE_VALOR_ACERTO', payload: valorAcerto });
  }, []);

  const deleteValorAcerto = useCallback((valorAcertoId) => {
    dispatch({ type: 'DELETE_VALOR_ACERTO', payload: valorAcertoId });
  }, []);

  const registerGastoValorAcerto = useCallback((valorAcertoId, gastoForm) => {
    const item = state.valoresAcerto.find((v) => v.id === valorAcertoId);
    if (!item) return { error: 'Registo não encontrado.' };

    const updated = addGastoToAcerto(item, gastoForm);
    dispatch({ type: 'UPDATE_VALOR_ACERTO', payload: updated });
    return { item: updated };
  }, [state.valoresAcerto]);

  const confirmValorAcerto = useCallback((valorAcertoId) => {
    const item = state.valoresAcerto.find((v) => v.id === valorAcertoId);
    if (!item) return { error: 'Registo não encontrado.' };

    const result = confirmAcerto(item);
    if (result.error) return result;

    dispatch({ type: 'UPDATE_VALOR_ACERTO', payload: result.item });

    const func = state.funcionarios.find((f) => f.id === item.funcionarioId);
    const utilizado = result.item.acerto?.valorUtilizado || 0;

    if (utilizado > 0) {
      const newGasto = {
        id: generateId(),
        descricao: `${item.motivo} — acerto (${func?.nome || 'Funcionário'})`,
        categoria: 'Material',
        valor: utilizado,
        data: result.item.acerto.dataAcerto,
        obraId: item.obraId,
        fornecedor: func?.nome || '',
        observacao: item.observacao || '',
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_GASTO', payload: newGasto });
    }

    return { item: result.item };
  }, [state.valoresAcerto, state.funcionarios]);

  const executarFechamentoPagamento = useCallback(
    (payload) => {
      const funcionario = state.funcionarios.find((f) => f.id === payload.funcionarioId);
      if (!funcionario) return { error: 'Funcionário não encontrado.' };
      if (isParceiroFuncionario(funcionario)) {
        return { error: 'Parceiros não entram no fechamento de pagamento. A participação no lucro trata-se na obra.' };
      }

      const preview = buildPaymentPreview({
        funcionario,
        funcionarioId: payload.funcionarioId,
        diarias: state.diarias,
        valoresAcerto: state.valoresAcerto,
        fechamentosPagamento: state.fechamentosPagamento,
        selections: payload.selections,
        referenceDate: payload.data,
        gratificacao: payload.gratificacao,
        ajustesManuais: payload.ajustesManuais,
      });

      if (
        !canConfirmFechamento(
          preview,
          payload.selections,
          payload.gratificacao,
          payload.ajustesManuais
        )
      ) {
        return { error: 'Seleccione diárias, descontos ou valores manuais para fechar o pagamento.' };
      }

      const data = payload.data || new Date().toISOString().slice(0, 10);
      const frequencia = getFrequenciaPagamento(funcionario);
      const paymentPeriod = getCurrentPaymentPeriod(frequencia, data);
      const tipoPagamento =
        payload.tipoPagamento || frequenciaToTipoPagamento(frequencia);
      const semanaMes = payload.semanaMes ?? null;
      const referencia = buildReferenciaPagamento(
        tipoPagamento,
        data,
        payload.referencia,
        semanaMes
      );
      const referenciaMes =
        tipoPagamento === 'Mensal'
          ? buildReferenciaMes(data)
          : payload.referenciaMes || getReferenciaMesAno(data);

      const fechamentoId = generateId();
      let pagamento = null;

      if (preview.totalPago > 0) {
        pagamento = {
          id: generateId(),
          tipo: 'Pagamento a funcionário',
          descricao: buildPagamentoDescricao({ referencia, data }),
          valor: preview.totalPago,
          data,
          obraId: null,
          pessoaRelacionada: funcionario.nome,
          metodoPagamento: payload.metodoPagamento || 'Transferência',
          observacao: payload.observacao?.trim() || '',
          fechamentoPagamentoId: fechamentoId,
          createdAt: new Date().toISOString(),
        };
      }

      const fechamento = buildFechamentoRecord({
        funcionarioId: payload.funcionarioId,
        funcionarioNome: funcionario.nome,
        preview,
        tipoPagamento,
        referencia,
        referenciaMes,
        semanaMes,
        observacao: payload.observacao,
        pagamentoId: pagamento?.id || null,
        data,
        periodoInicio: paymentPeriod?.inicio || null,
        periodoFim: paymentPeriod?.fim || null,
      });
      fechamento.id = fechamentoId;
      fechamento.comprovativoSnapshot = buildComprovativoSnapshot({
        funcionarioNome: funcionario.nome,
        preview,
        dataPagamento: data,
        empresaNome: state.configuracoes?.nomeEmpresa || 'Emerson Pinturas',
      });

      const diariasDoPagamento = preview.diariasSelecionadas || preview.diariasPendentes || [];
      const pendingDiariaIds = new Set(diariasDoPagamento.map((d) => d.id));
      let diariasUpdates = state.diarias
        .filter(
          (d) =>
            pendingDiariaIds.has(d.id) &&
            sameFuncionarioId(d.funcionarioId, payload.funcionarioId) &&
            isDiariaPendente(d, state.fechamentosPagamento)
        )
        .map((d) => markDiariaComoPaga(d, fechamentoId, data));

      if (diariasDoPagamento.length > 0 && diariasUpdates.length === 0) {
        diariasUpdates = state.diarias
          .filter((d) => pendingDiariaIds.has(d.id) && isDiariaPendente(d, state.fechamentosPagamento))
          .map((d) => markDiariaComoPaga(d, fechamentoId, data));
      }

      const applyDetails = {
        data,
        semana: semanaMes,
        fechamentoId,
        mesAno: referenciaMes,
      };

      const parcelasAplicadas = applyParcelasToFuncionario(
        funcionario,
        preview.parcelasSelecionadas,
        applyDetails
      );
      if (parcelasAplicadas?.error) return parcelasAplicadas;

      const recorrentesAplicados = applyRecorrentesToFuncionario(
        parcelasAplicadas.funcionario,
        preview.recorrentesSelecionados,
        applyDetails
      );
      if (recorrentesAplicados?.error) return recorrentesAplicados;

      const funcionarioUpdate = recorrentesAplicados.funcionario;
      const lancamentosDesconto = [
        ...(parcelasAplicadas.lancamentos || []),
        ...(recorrentesAplicados.lancamentos || []),
      ];
      fechamento.parcelasRegistradas = (fechamento.parcelasRegistradas || []).map((linha) => {
        const hit = lancamentosDesconto.find(
          (item) => item.modalidade === 'parcelado' && item.commitmentId === linha.commitmentId
        );
        return hit ? { ...linha, lancamentoId: hit.lancamentoId, valor: hit.valor } : linha;
      });
      fechamento.recorrentesAplicados = (fechamento.recorrentesAplicados || []).map((linha) => {
        const hit = lancamentosDesconto.find(
          (item) => item.modalidade !== 'parcelado' && item.commitmentId === linha.commitmentId
        );
        return hit ? { ...linha, lancamentoId: hit.lancamentoId, valor: hit.valor } : linha;
      });

      const valoresAcertoUpdates = [];
      const gastos = [];

      preview.acertosSelecionados.forEach((item) => {
        const result = confirmAcerto(item);
        if (result.error) return;

        valoresAcertoUpdates.push(result.item);

        const utilizado = result.item.acerto?.valorUtilizado || 0;
        if (utilizado > 0) {
          gastos.push({
            id: generateId(),
            descricao: `${item.motivo} — acerto (${funcionario.nome})`,
            categoria: 'Material',
            valor: utilizado,
            data: result.item.acerto.dataAcerto,
            obraId: item.obraId,
            fornecedor: funcionario.nome,
            observacao: item.observacao || '',
            fechamentoPagamentoId: fechamentoId,
            createdAt: new Date().toISOString(),
          });
        }
      });

      dispatch({
        type: 'EXECUTE_FECHAMENTO_PAGAMENTO',
        payload: {
          fechamento,
          pagamento,
          diariasUpdates,
          funcionarioUpdate,
          valoresAcertoUpdates,
          gastos,
        },
      });

      return { fechamento, pagamento };
    },
    [state.funcionarios, state.diarias, state.valoresAcerto, state.fechamentosPagamento, state.configuracoes]
  );

  const desfazerDescontoLancamento = useCallback(
    (funcionarioId, lancamentoId) => {
      const funcionario = state.funcionarios.find((item) => item.id === funcionarioId);
      if (!funcionario) return { error: 'Funcionário não encontrado.' };

      const listas = ['descontosMensais', 'alugueis'];
      let listKey = null;
      let found = null;
      for (const key of listas) {
        const item = (funcionario[key] || []).find(
          (row) =>
            (row.historicoParcelas || []).some((entry) => entry.id === lancamentoId) ||
            (row.historicoDescontos || []).some((entry) => entry.id === lancamentoId)
        );
        if (item) {
          listKey = key;
          found = item;
          break;
        }
      }
      if (!found) return { error: 'Lançamento não encontrado.' };

      const result = desfazerLancamentoDesconto(found, lancamentoId);
      if (result.error) return result;

      const funcionarioUpdate = {
        ...funcionario,
        [listKey]: (funcionario[listKey] || []).map((row) => (row.id === found.id ? result.item : row)),
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_FUNCIONARIO', payload: funcionarioUpdate });

      const fechamentoId = result.removed?.fechamentoId;
      if (fechamentoId) {
        const fechamento = state.fechamentosPagamento.find((item) => item.id === fechamentoId);
        if (fechamento) {
          const nextFechamento = retirarDescontoDoFechamento(fechamento, {
            lancamentoId,
            commitmentId: found.id,
            valor: result.removed.valor,
            numero: result.removed.numero,
            descricao: found.descricao,
          });
          dispatch({ type: 'UPDATE_FECHAMENTO_PAGAMENTO', payload: nextFechamento });
          if (fechamento.pagamentoId && nextFechamento.totalPago !== fechamento.totalPago) {
            const pagamento = state.pagamentos.find((item) => item.id === fechamento.pagamentoId);
            if (pagamento) {
              dispatch({
                type: 'UPDATE_PAGAMENTO',
                payload: {
                  ...pagamento,
                  valor: nextFechamento.totalPago,
                  updatedAt: new Date().toISOString(),
                },
              });
            }
          }
        }
      }

      return { ok: true, item: result.item, vinculadoPagamento: Boolean(fechamentoId) };
    },
    [state.funcionarios, state.fechamentosPagamento, state.pagamentos]
  );

  const corrigirComprovativoPagamento = useCallback(
    (fechamentoId, { snapshot, observacao = '' }) => {
      const fechamento = state.fechamentosPagamento.find((item) => item.id === fechamentoId);
      if (!fechamento) return { error: 'Pagamento não encontrado.' };
      const original = fechamento.comprovativoSnapshotOriginal || fechamento.comprovativoSnapshot || null;
      const next = {
        ...fechamento,
        comprovativoSnapshotOriginal: original,
        comprovativoSnapshot: snapshot,
        totalPago: snapshot.totalPago,
        corrigidoEm: new Date().toISOString().slice(0, 10),
        correcaoObservacao: observacao.trim(),
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_FECHAMENTO_PAGAMENTO', payload: next });
      if (fechamento.pagamentoId) {
        const pagamento = state.pagamentos.find((item) => item.id === fechamento.pagamentoId);
        if (pagamento && pagamento.valor !== snapshot.totalPago) {
          dispatch({
            type: 'UPDATE_PAGAMENTO',
            payload: { ...pagamento, valor: snapshot.totalPago, updatedAt: new Date().toISOString() },
          });
        }
      }
      return { fechamento: next };
    },
    [state.fechamentosPagamento, state.pagamentos]
  );

  const addGasto = useCallback((gasto) => {
    const salvarFornecedor = gasto?.salvarFornecedor === true;
    const fiscal = gasto?.salvarFornecedorFiscal;
    const rest = stripFornecedorSaveFields(gasto);
    const newGasto = { ...rest, id: rest.id || generateId(), createdAt: rest.createdAt || new Date().toISOString() };
    const result = upsertFornecedorFromRecord(
      state.empresaFornecedores || [],
      { ...newGasto, salvarFornecedorFiscal: fiscal },
      salvarFornecedor
    );
    if (result.fornecedor) {
      newGasto.fornecedorId = result.fornecedor.id;
      newGasto.fornecedor = result.fornecedor.nome;
      newGasto.fornecedorNome = result.fornecedor.nome;
    }
    if (result.changed) dispatch({ type: 'SET_EMPRESA_FORNECEDORES', payload: result.fornecedores });
    dispatch({ type: 'ADD_GASTO', payload: newGasto });
    const obraComCaixa = sincronizarCaixaObraComGasto(state.obras, newGasto, null);
    if (obraComCaixa) dispatch({ type: 'UPDATE_OBRA', payload: obraComCaixa });
    return newGasto;
  }, [state.empresaFornecedores, state.obras]);

  const updateGasto = useCallback((gasto) => {
    const salvarFornecedor = gasto?.salvarFornecedor === true;
    const fiscal = gasto?.salvarFornecedorFiscal;
    const rest = stripFornecedorSaveFields(gasto);
    const result = upsertFornecedorFromRecord(
      state.empresaFornecedores || [],
      { ...rest, salvarFornecedorFiscal: fiscal },
      salvarFornecedor
    );
    if (result.fornecedor) {
      rest.fornecedorId = result.fornecedor.id;
      rest.fornecedor = result.fornecedor.nome;
      rest.fornecedorNome = result.fornecedor.nome;
    }
    if (result.changed) dispatch({ type: 'SET_EMPRESA_FORNECEDORES', payload: result.fornecedores });
    const anterior = (state.gastos || []).find((item) => item && item.id === rest.id) || null;
    dispatch({ type: 'UPDATE_GASTO', payload: rest });
    const obraComCaixa = sincronizarCaixaObraComGasto(state.obras, rest, anterior);
    if (obraComCaixa) dispatch({ type: 'UPDATE_OBRA', payload: obraComCaixa });
  }, [state.empresaFornecedores, state.obras, state.gastos]);

  const deleteGasto = useCallback((gastoId) => {
    const gasto = (state.gastos || []).find((item) => item && item.id === gastoId) || null;
    dispatch({ type: 'DELETE_GASTO', payload: gastoId });
    if (gasto) {
      const obraComCaixa = sincronizarCaixaObraComGasto(state.obras, { ...gasto, pagoPor: 'empresa' }, gasto);
      if (obraComCaixa) dispatch({ type: 'UPDATE_OBRA', payload: obraComCaixa });
    }
  }, [state.gastos, state.obras]);

  const addIvaEntregar = useCallback((record) => {
    const newRecord = { ...record, id: generateId(), createdAt: new Date().toISOString() };
    dispatch({ type: 'ADD_IVA_ENTREGAR', payload: newRecord });
    return newRecord;
  }, []);

  const updateIvaEntregar = useCallback((record) => {
    dispatch({ type: 'UPDATE_IVA_ENTREGAR', payload: record });
  }, []);

  const deleteIvaEntregar = useCallback((id) => {
    dispatch({ type: 'DELETE_IVA_ENTREGAR', payload: id });
  }, []);

  const addGastosEmpresa = useCallback((records) => {
    const now = new Date().toISOString();
    let fornecedores = state.empresaFornecedores || [];
    let fornecedorChanged = false;
    const payload = (Array.isArray(records) ? records : [records]).map((item) => {
      try {
        const salvarFornecedor = item?.salvarFornecedor === true;
        const fiscal = item?.salvarFornecedorFiscal;
        const rest = stripFornecedorSaveFields(item);
        const next = { ...rest, id: rest.id || generateId(), createdAt: rest.createdAt || now };
        const result = upsertFornecedorFromRecord(
          fornecedores,
          { ...next, salvarFornecedorFiscal: fiscal },
          salvarFornecedor
        );
        if (result.fornecedor) {
          next.fornecedorId = result.fornecedor.id;
          next.fornecedorNome = result.fornecedor.nome;
        }
        if (result.changed) {
          fornecedores = result.fornecedores;
          fornecedorChanged = true;
        }
        return next;
      } catch (error) {
        console.error('[Gastos da Empresa] Falha ao associar fornecedor; o gasto será guardado na mesma:', error);
        const rest = stripFornecedorSaveFields(item);
        return { ...rest, id: rest.id || generateId(), createdAt: rest.createdAt || now };
      }
    });
    dispatch({ type: 'ADD_GASTOS_EMPRESA', payload });
    if (fornecedorChanged) dispatch({ type: 'SET_EMPRESA_FORNECEDORES', payload: fornecedores });
    return payload;
  }, [state.empresaFornecedores]);

  const updateGastoEmpresa = useCallback((record) => {
    const existing = (state.gastosEmpresa || []).find((item) => item.id === record?.id);
    const salvarFornecedor = record?.salvarFornecedor === true;
    const fiscal = record?.salvarFornecedorFiscal;
    const rest = stripFornecedorSaveFields(record);
    const merged = existing ? appendGastoEmpresaHistorico(existing, rest) : rest;
    dispatch({ type: 'UPDATE_GASTO_EMPRESA', payload: merged });
    const result = upsertFornecedorFromRecord(
      state.empresaFornecedores || [],
      { ...merged, salvarFornecedorFiscal: fiscal },
      salvarFornecedor
    );
    if (result.changed) dispatch({ type: 'SET_EMPRESA_FORNECEDORES', payload: result.fornecedores });
  }, [state.empresaFornecedores, state.gastosEmpresa]);

  const deleteGastoEmpresa = useCallback((id) => {
    dispatch({ type: 'DELETE_GASTO_EMPRESA', payload: id });
  }, []);

  const restoreGastoEmpresa = useCallback((id) => {
    dispatch({ type: 'RESTORE_GASTO_EMPRESA', payload: id });
  }, []);

  const hardDeleteGastoEmpresa = useCallback((id) => {
    dispatch({ type: 'HARD_DELETE_GASTO_EMPRESA', payload: id });
  }, []);

  const saveGastosEmpresaCategorias = useCallback((catalog) => {
    dispatch({ type: 'SET_GASTOS_EMPRESA_CATEGORIAS', payload: catalog });
  }, []);

  const renameGastoEmpresaCategoria = useCallback((categoriaId, nome) => {
    const result = renomearCategoriaCatalogo(
      state.gastosEmpresaCategorias,
      { categoriaId, nome },
      state.gastosEmpresa || []
    );
    if (result.error) return result;
    dispatch({
      type: 'RENAME_GASTO_EMPRESA_CATEGORIA',
      payload: { catalog: result.catalog, gastosEmpresa: result.gastos },
    });
    return result;
  }, [state.gastosEmpresaCategorias, state.gastosEmpresa]);

  const addEmpresaVeiculo = useCallback((veiculo) => {
    const payload = { ...veiculo, id: veiculo.id || generateId(), createdAt: veiculo.createdAt || new Date().toISOString() };
    dispatch({ type: 'ADD_EMPRESA_VEICULO', payload });
    return payload;
  }, []);

  const updateEmpresaVeiculo = useCallback((veiculo) => {
    dispatch({ type: 'UPDATE_EMPRESA_VEICULO', payload: { ...veiculo, updatedAt: new Date().toISOString() } });
  }, []);

  const deleteEmpresaVeiculo = useCallback((id) => {
    dispatch({ type: 'DELETE_EMPRESA_VEICULO', payload: id });
  }, []);

  const saveEmpresaIvaRegras = useCallback((regras) => {
    dispatch({ type: 'SET_EMPRESA_IVA_REGRAS', payload: regras });
  }, []);

  const saveEmpresaFornecedores = useCallback((fornecedores) => {
    dispatch({ type: 'SET_EMPRESA_FORNECEDORES', payload: fornecedores });
  }, []);

  const addDespesaProgramada = useCallback((despesa) => {
    const payload = { ...despesa, id: despesa.id || generateId(), createdAt: despesa.createdAt || new Date().toISOString() };
    dispatch({ type: 'ADD_DESPESA_PROGRAMADA', payload });
    return payload;
  }, []);

  const updateDespesaProgramada = useCallback((despesa) => {
    dispatch({ type: 'UPDATE_DESPESA_PROGRAMADA', payload: { ...despesa, updatedAt: new Date().toISOString() } });
  }, []);

  const deleteDespesaProgramada = useCallback((id) => {
    dispatch({ type: 'DELETE_DESPESA_PROGRAMADA', payload: id });
  }, []);

  const addValorRecuperar = useCallback((item) => {
    const payload = { ...item, id: item.id || generateId(), createdAt: item.createdAt || new Date().toISOString() };
    dispatch({ type: 'ADD_VALOR_RECUPERAR', payload });
    return payload;
  }, []);

  const updateValorRecuperar = useCallback((item) => {
    dispatch({ type: 'UPDATE_VALOR_RECUPERAR', payload: { ...item, updatedAt: new Date().toISOString() } });
  }, []);

  const deleteValorRecuperar = useCallback((id) => {
    dispatch({ type: 'DELETE_VALOR_RECUPERAR', payload: id });
  }, []);

  const addPagamento = useCallback((pag) => {
    const ligadoAoAcerto = Boolean(pag?.acertoParceriaId);
    const newPag = {
      ...pag,
      id: ligadoAoAcerto ? pag.id || `rec-acerto-${pag.acertoParceriaId}` : generateId(),
      createdAt: ligadoAoAcerto ? pag.createdAt || new Date().toISOString() : new Date().toISOString(),
    };
    dispatch({ type: 'ADD_PAGAMENTO', payload: newPag });
    return newPag;
  }, []);

  const updatePagamento = useCallback((pag) => {
    dispatch({ type: 'UPDATE_PAGAMENTO', payload: pag });
  }, []);

  const deletePagamento = useCallback((pagamentoId) => {
    dispatch({ type: 'DELETE_PAGAMENTO', payload: pagamentoId });
  }, []);

  const updateConfiguracoes = useCallback((config) => {
    dispatch({ type: 'UPDATE_CONFIGURACOES', payload: config });
  }, []);

  const resetApplicationData = useCallback(async () => {
    clearLocalBusinessData();
    dispatch({ type: 'RESET_APPLICATION_DATA' });
  }, []);

  const getFuncionarioById = useCallback(
    (id) => state.funcionarios.find((f) => f.id === id),
    [state.funcionarios]
  );

  const getObraById = useCallback(
    (id) => state.obras.find((o) => o.id === id),
    [state.obras]
  );

  const getHotelDommeControleByObraId = useCallback(
    (obraId) => state.hotelDommeControles.find((c) => c.obraId === obraId) || null,
    [state.hotelDommeControles]
  );

  const addHotelDommeMovimento = useCallback((obraId, movimento) => {
    dispatch({ type: 'ADD_HOTEL_DOMME_MOVIMENTO', payload: { obraId, movimento } });
  }, []);

  const updateHotelDommeMovimentoRecord = useCallback((obraId, movimento) => {
    dispatch({ type: 'UPDATE_HOTEL_DOMME_MOVIMENTO', payload: { obraId, movimento } });
  }, []);

  const deleteHotelDommeMovimento = useCallback((obraId, movimentoId) => {
    dispatch({ type: 'DELETE_HOTEL_DOMME_MOVIMENTO', payload: { obraId, movimentoId } });
  }, []);

  const value = {
    ...state,
    obras: sortObrasForDisplay(state.obras),
    gastosEmpresa: getGastosEmpresaAtivos(state.gastosEmpresa),
    gastosEmpresaLixeira: getGastosEmpresaLixeira(state.gastosEmpresa),
    addObra,
    updateObra,
    deleteObra,
    addFuncionario,
    updateFuncionario,
    deleteFuncionario,
    addDiaria,
    updateDiaria,
    marcarDiariaComoPaga,
    deleteDiaria,
    addAdiantamento,
    updateAdiantamento,
    deleteAdiantamento,
    addEmprestimo,
    updateEmprestimo,
    deleteEmprestimo,
    addValorAcerto,
    updateValorAcerto,
    deleteValorAcerto,
    registerGastoValorAcerto,
    confirmValorAcerto,
    executarFechamentoPagamento,
    desfazerDescontoLancamento,
    corrigirComprovativoPagamento,
    addGasto,
    updateGasto,
    deleteGasto,
    addIvaEntregar,
    updateIvaEntregar,
    deleteIvaEntregar,
    addGastosEmpresa,
    updateGastoEmpresa,
    deleteGastoEmpresa,
    restoreGastoEmpresa,
    hardDeleteGastoEmpresa,
    saveGastosEmpresaCategorias,
    renameGastoEmpresaCategoria,
    addEmpresaVeiculo,
    updateEmpresaVeiculo,
    deleteEmpresaVeiculo,
    saveEmpresaIvaRegras,
    saveEmpresaFornecedores,
    addDespesaProgramada,
    updateDespesaProgramada,
    deleteDespesaProgramada,
    addValorRecuperar,
    updateValorRecuperar,
    deleteValorRecuperar,
    addPagamento,
    updatePagamento,
    deletePagamento,
    updateConfiguracoes,
    resetApplicationData,
    getFuncionarioById,
    getObraById,
    getHotelDommeControleByObraId,
    addHotelDommeMovimento,
    updateHotelDommeMovimentoRecord,
    deleteHotelDommeMovimento,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de AppProvider');
  return context;
}
