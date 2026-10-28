import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, Tags, Settings, Building2, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import DocumentoTipoBadge from '../../components/Gastos/DocumentoTipoBadge';
import Table from '../../components/Table/Table';
import PeriodFilter from '../../components/PeriodFilter/PeriodFilter';
import GastoEmpresaFormModal from '../../components/GastoEmpresaForm/GastoEmpresaFormModal';
import VeiculoFormModal from '../../components/EmpresaFinanceiro/VeiculoFormModal';
import DespesaProgramadaFormModal from '../../components/EmpresaFinanceiro/DespesaProgramadaFormModal';
import ValorRecuperarFormModal from '../../components/EmpresaFinanceiro/ValorRecuperarFormModal';
import ViaVerdeDistribuicaoModal from '../../components/EmpresaFinanceiro/ViaVerdeDistribuicaoModal';
import GastoFixoDetalheModal from '../../components/EmpresaFinanceiro/GastoFixoDetalheModal';
import VeiculoFinanceiroCard from '../../components/EmpresaFinanceiro/VeiculoFinanceiroCard';
import RegistrarPagamentoProgramadaModal from '../../components/EmpresaFinanceiro/RegistrarPagamentoProgramadaModal';
import DespesasProgramadasAgenda from '../../components/EmpresaFinanceiro/DespesasProgramadasAgenda';
import ControleDoMes from '../../components/EmpresaFinanceiro/ControleDoMes';
import CaixaEmpresa from '../../components/EmpresaFinanceiro/CaixaEmpresa';
import CustoMensalEmpresa from '../../components/EmpresaFinanceiro/CustoMensalEmpresa';
import { FormGroup, Input, FormActions } from '../../components/Form/Form';
import Modal from '../../components/Modal/Modal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import confirmStyles from '../../components/ConfirmDialog/ConfirmDialog.module.css';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';
import { filterByPeriod, GASTOS_EMPRESA_PERIOD_PRESETS, GASTOS_EMPRESA_TOTAL_LABELS } from '../../utils/periodFilter';
import {
  buildCreateGastoEmpresaRecords,
  buildGastoEmpresaUpdate,
} from '../../utils/gastoEmpresaForm';
import {
  filterGastosEmpresa,
  summarizeGastosEmpresa,
  getCompromissosEmpresa,
  getGastoEmpresaDisplayEstado,
  getGastoEmpresaEstadoLabel,
  getGastoEmpresaEstadoVariant,
  getGastoEmpresaValor,
  buildMarcarPago,
  GASTO_EMPRESA_ESTADOS,
  isGastoEmpresaEfetivo,
} from '../../utils/gastoEmpresaCalculations';
import { summarizeGastosIvaAssinado, sumValoresAssinados } from '../../utils/gastoDocumentoSinal';
import {
  applyPagamentoProgramada,
  buildGastoFromProgramada,
  CATEGORIA_COMBUSTIVEL,
  DESPESA_NATUREZA,
  formatYearMonth,
  getGastosDoVeiculo,
  getValorGastoNoVeiculo,
  getViaVerdeStatus,
  getYearMonth,
  isCategoriaCombustivel,
  isCategoriaViaVerde,
  listProximosPagamentosHome,
  listViaVerdePorConferir,
  marcarValorRecuperado,
  summarizeVariaveisMes,
  summarizeVeiculoCustos,
  summarizeViaVerde,
  temPagamentoRegistadoNoPeriodo,
  VALOR_RECUPERAR_STATUS,
  VIA_VERDE_STATUS_LABELS,
  getEstadoFixoBadgeVariant,
} from '../../utils/empresaFinanceiroCalculations';
import { buildAgendaProgramadas } from '../../utils/despesasProgramadasAgenda';
import { buildControleDoMes } from '../../utils/controleDoMes';
import { buildCaixaEmpresa, buildCustoMensalEmpresa } from '../../utils/empresaVisoesFinanceiro';
import { getGruposParaSelect } from '../../utils/gastoEmpresaCategoriaCatalog';
import GerenciarCategoriasEmpresaModal from '../../components/GerenciarCategoriasEmpresa/GerenciarCategoriasEmpresaModal';
import IvaRegrasModal from '../../components/EmpresaFinanceiro/IvaRegrasModal';
import EmpresaDocumentosPanel from '../../components/EmpresaFinanceiro/EmpresaDocumentosPanel';
import FornecedoresModal from '../../components/EmpresaFinanceiro/FornecedoresModal';
import {
  resolveFornecedorIvaOptions,
} from '../../utils/empresaFornecedores';
import { DOCUMENTO_STATUS, DOCUMENTO_STATUS_LABELS } from '../../constants/empresaIva';
import { getDocumentoStatus } from '../../utils/empresaDocumentos';
import { formatGastoEmpresaIvaHint } from '../../utils/empresaIvaRules';
import { hasIvaInfo } from '../../utils/ivaCalculations';
import {
  getGastoEmpresaFornecedorLabel,
  UNDO_GASTO_EMPRESA_MS,
} from '../../utils/gastoEmpresaSeguranca';
import { formatCurrency, formatDate, formatDateTime, getTodayISO } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import HelpTip from '../../components/HelpTip/HelpTip';
import { sortObrasForDisplay } from '../../utils/obraStatus';
import shared from '../shared.module.css';
import styles from './GastosEmpresa.module.css';

const AREAS_GASTOS = [
  ['visao', 'Visão geral'],
  ['lancamentos', 'Lançamentos'],
  ['programadas', 'Gastos fixos'],
  ['impostos', 'Impostos / IVA'],
  ['configuracoes', 'Configurações'],
];

const PRESETS_GASTOS = [
  ...GASTOS_EMPRESA_PERIOD_PRESETS,
  { id: 'mes_anterior', label: 'Mês anterior' },
  { id: 'personalizado', label: 'Escolher período' },
];

export default function GastosEmpresa() {
  const {
    gastosEmpresa = [],
    gastosEmpresaLixeira = [],
    gastosEmpresaCategorias,
    empresaVeiculos = [],
    empresaDespesasProgramadas = [],
    empresaValoresRecuperar = [],
    obras = [],
    funcionarios = [],
    diarias = [],
    fechamentosPagamento = [],
    addGastosEmpresa,
    updateGastoEmpresa,
    deleteGastoEmpresa,
    restoreGastoEmpresa,
    hardDeleteGastoEmpresa,
    saveGastosEmpresaCategorias,
    renameGastoEmpresaCategoria,
    addEmpresaVeiculo,
    updateEmpresaVeiculo,
    addDespesaProgramada,
    updateDespesaProgramada,
    addValorRecuperar,
    updateValorRecuperar,
    empresaIvaRegras = [],
    saveEmpresaIvaRegras,
    empresaFornecedores = [],
    saveEmpresaFornecedores,
  } = useApp();
  const period = usePeriodFilter('este_mes', PRESETS_GASTOS);
  const [aba, setAba] = useState('visao');
  const [pesquisa, setPesquisa] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipoLancamento, setFiltroTipoLancamento] = useState('');
  const [filtroVeiculo, setFiltroVeiculo] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState(null);
  const [undo, setUndo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [categoriasOpen, setCategoriasOpen] = useState(false);
  const [gastoDefaults, setGastoDefaults] = useState({});
  const [veiculoModalOpen, setVeiculoModalOpen] = useState(false);
  const [programadaModalOpen, setProgramadaModalOpen] = useState(false);
  const [recuperarModalOpen, setRecuperarModalOpen] = useState(false);
  const [pagamentoProgramadaOpen, setPagamentoProgramadaOpen] = useState(false);
  const [selectedVeiculo, setSelectedVeiculo] = useState(null);
  const [selectedProgramada, setSelectedProgramada] = useState(null);
  const [selectedRecuperar, setSelectedRecuperar] = useState(null);
  const [viaVerdeOpen, setViaVerdeOpen] = useState(false);
  const [detalheFixo, setDetalheFixo] = useState(null);
  const [receberItem, setReceberItem] = useState(null);
  const [receberData, setReceberData] = useState(getTodayISO());
  const [agendaMes, setAgendaMes] = useState(getYearMonth);
  const [controleMes, setControleMes] = useState(getYearMonth);
  const [pagamentoMesRef, setPagamentoMesRef] = useState('');
  const [ivaRegrasOpen, setIvaRegrasOpen] = useState(false);
  const [fornecedoresOpen, setFornecedoresOpen] = useState(false);
  const [filtroDocumento, setFiltroDocumento] = useState('');
  const [documentosMes, setDocumentosMes] = useState(getYearMonth);
  const [documentosPeriodo, setDocumentosPeriodo] = useState('este_mes');

  const gastoIvaOptions = (form) => ({
    veiculo: (empresaVeiculos || []).find((item) => item?.id === form?.veiculoId) || null,
    ...resolveFornecedorIvaOptions(form, { fornecedores: empresaFornecedores, regras: empresaIvaRegras }),
  });

  const gruposCategoria = useMemo(
    () => getGruposParaSelect(gastosEmpresaCategorias, { apenasAtivas: false }),
    [gastosEmpresaCategorias]
  );

  const filtered = useMemo(() => {
    const byPeriod = filterByPeriod(gastosEmpresa, period.range);
    return filterGastosEmpresa(byPeriod, {
      categoria: filtroCategoria,
      estado: filtroEstado,
      tipoLancamento: filtroTipoLancamento,
      veiculoId: filtroVeiculo,
      obraId: filtroObra,
    });
  }, [
    gastosEmpresa,
    period.range,
    filtroCategoria,
    filtroEstado,
    filtroTipoLancamento,
    filtroVeiculo,
    filtroObra,
  ]);

  const sorted = useMemo(
    () =>
      [...filtered]
        .filter((item) => item && typeof item === 'object')
        .sort((a, b) => {
        const da = a.data || '';
        const db = b.data || '';
        if (da === db) return (b.id || '').localeCompare(a.id || '');
        return db.localeCompare(da);
      }),
    [filtered]
  );

  const lancamentosVisiveis = useMemo(() => {
    const q = pesquisa.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((row) => {
      const obraNome = obras.find((obra) => obra.id === row.obraId)?.nome || '';
      const texto = [row.descricao, row.fornecedorNome, row.categoria, row.veiculo, row.local, obraNome]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return texto.includes(q);
    });
  }, [sorted, pesquisa, obras]);

  const recentes = useMemo(
    () =>
      [...gastosEmpresa]
        .filter((item) => item && typeof item === 'object')
        .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
        .slice(0, 6),
    [gastosEmpresa]
  );

  const resumo = useMemo(() => summarizeGastosEmpresa(filtered), [filtered]);
  const efetivosFiltrados = useMemo(
    () => filtered.filter(isGastoEmpresaEfetivo),
    [filtered]
  );
  const ivaResumo = useMemo(
    () => summarizeGastosIvaAssinado(efetivosFiltrados),
    [efetivosFiltrados]
  );
  const totalPeriodoAssinado = sumValoresAssinados(efetivosFiltrados, getGastoEmpresaValor);
  const totalFixosPeriodo = sumValoresAssinados(
    efetivosFiltrados.filter((item) => item.tipo === 'recorrente' || item.despesaProgramadaId),
    getGastoEmpresaValor
  );
  const categoriasImposto = new Set(
    (gruposCategoria.find((grupo) => /imposto/i.test(grupo.grupo || ''))?.categorias || [])
  );
  const totalImpostosPeriodo = sumValoresAssinados(
    efetivosFiltrados.filter((item) => categoriasImposto.has(item.categoria)),
    getGastoEmpresaValor
  );

  const categoriasOrdenadas = useMemo(
    () =>
      Object.entries(resumo?.porCategoria || {}).sort((a, b) => b[1] - a[1]),
    [resumo.porCategoria]
  );

  const compromissos = useMemo(() => {
    const abertos = getCompromissosEmpresa(gastosEmpresa);
    const inPeriod = filterByPeriod(abertos, period.range, (item) => item.dataVencimento || item.data);
    const vencidos = abertos.filter((item) => item.vencido);
    const merged = [...inPeriod];
    vencidos.forEach((item) => {
      if (!merged.some((row) => row.id === item.id)) merged.push(item);
    });
    return merged.sort((a, b) => {
      if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
      const da = a.dataVencimento || a.data || '';
      const db = b.dataVencimento || b.data || '';
      return da.localeCompare(db);
    });
  }, [gastosEmpresa, period.range]);

  const variaveisMes = useMemo(
    () => summarizeVariaveisMes(gastosEmpresa, getYearMonth()),
    [gastosEmpresa]
  );

  const viaVerdePendentes = useMemo(
    () => listViaVerdePorConferir(gastosEmpresa),
    [gastosEmpresa]
  );

  const combustivelTotalEmpresa = useMemo(
    () =>
      gastosEmpresa
        .filter((item) => item.estado !== 'previsto' && isCategoriaCombustivel(item.categoria))
        .reduce((sum, item) => sum + getGastoEmpresaValor(item), 0),
    [gastosEmpresa]
  );

  const proximas = useMemo(
    () =>
      listProximosPagamentosHome(empresaDespesasProgramadas, {
        gastos: gastosEmpresa,
        veiculos: empresaVeiculos,
      }),
    [empresaDespesasProgramadas, gastosEmpresa, empresaVeiculos]
  );

  const caixaEmpresa = useMemo(
    () =>
      buildCaixaEmpresa({
        gastos: gastosEmpresa,
        programadas: empresaDespesasProgramadas,
        veiculos: empresaVeiculos,
        range: period.range,
      }),
    [gastosEmpresa, empresaDespesasProgramadas, empresaVeiculos, period.range]
  );

  const custoMensal = useMemo(
    () =>
      buildCustoMensalEmpresa({
        programadas: empresaDespesasProgramadas,
        veiculos: empresaVeiculos,
        gastos: gastosEmpresa,
      }),
    [empresaDespesasProgramadas, empresaVeiculos, gastosEmpresa]
  );

  const agendaProgramadas = useMemo(
    () =>
      buildAgendaProgramadas(empresaDespesasProgramadas, {
        gastos: gastosEmpresa,
        veiculos: empresaVeiculos,
        yearMonth: agendaMes,
      }),
    [empresaDespesasProgramadas, gastosEmpresa, empresaVeiculos, agendaMes]
  );

  const controleDoMes = useMemo(() => {
    // Só calcula quando a aba está activa — evita derrubar a página inteira no mount.
    if (aba !== 'controle') return null;
    try {
      return buildControleDoMes({
        yearMonth: controleMes,
        programadas: empresaDespesasProgramadas,
        gastos: gastosEmpresa,
        veiculos: empresaVeiculos,
        funcionarios,
        diarias,
        fechamentosPagamento,
      });
    } catch (err) {
      console.error('[GastosEmpresa] Falha no Controle do mês (página mantém-se aberta):', err);
      return null;
    }
  }, [
    aba,
    controleMes,
    empresaDespesasProgramadas,
    gastosEmpresa,
    empresaVeiculos,
    funcionarios,
    diarias,
    fechamentosPagamento,
  ]);

  useEffect(() => {
    if (aba === 'programadas') setAgendaMes(getYearMonth());
    if (aba === 'controle') setControleMes(getYearMonth());
  }, [aba]);

  useEffect(() => {
    if (!undo) return undefined;
    const timer = window.setTimeout(() => setUndo(null), UNDO_GASTO_EMPRESA_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const handleCreate = (form) => {
    try {
      if (form.despesaProgramadaId) {
        const programada = empresaDespesasProgramadas.find((item) => item?.id === form.despesaProgramadaId);
        if (programada && temPagamentoRegistadoNoPeriodo(programada, { gastos: gastosEmpresa, data: form.data })) {
          window.alert('Este período já está marcado como pago neste gasto fixo.');
          return;
        }
      }
      addGastosEmpresa(buildCreateGastoEmpresaRecords(form, gastoIvaOptions(form)));
      if (form.despesaProgramadaId) {
        const programada = empresaDespesasProgramadas.find((item) => item?.id === form.despesaProgramadaId);
        if (programada) {
          updateDespesaProgramada(
            applyPagamentoProgramada(programada, { dataPagamento: form.dataPagamento || form.data })
          );
        }
      }
      setCreateOpen(false);
      setGastoDefaults({});
      setAba('lancamentos');
    } catch (error) {
      console.error('[Gastos da Empresa] Falha ao guardar o gasto:', error);
      window.alert('Não foi possível guardar o gasto. Verifique os campos e tente novamente.');
    }
  };

  const handleEdit = (form) => {
    try {
      updateGastoEmpresa(buildGastoEmpresaUpdate(selected, form, gastoIvaOptions(form)));
      setEditOpen(false);
      setSelected(null);
    } catch (error) {
      console.error('[Gastos da Empresa] Falha ao atualizar o gasto:', error);
      window.alert('Não foi possível guardar as alterações. Tente novamente.');
    }
  };

  const handleDeleteById = (id) => {
    if (!id) return;
    const snapshot =
      (selected?.id === id ? selected : null) ||
      gastosEmpresa.find((item) => item.id === id) ||
      gastosEmpresaLixeira.find((item) => item.id === id);
    deleteGastoEmpresa(id);
    setUndo(snapshot ? { record: snapshot } : null);
    setDeleteOpen(false);
    setEditOpen(false);
    setSelected(null);
  };

  const handleDelete = () => {
    if (!selected?.id) return;
    handleDeleteById(selected.id);
  };

  const handleUndoDelete = () => {
    if (undo?.record) {
      addGastosEmpresa([undo.record]);
    } else if (undo?.id) {
      restoreGastoEmpresa(undo.id);
    }
    setUndo(null);
  };

  const handleRestore = (gasto) => {
    if (!gasto?.id) return;
    restoreGastoEmpresa(gasto.id);
    if (undo?.id === gasto.id) setUndo(null);
  };

  const handleHardDelete = () => {
    if (!hardDeleteTarget?.id) return;
    hardDeleteGastoEmpresa(hardDeleteTarget.id);
    if (undo?.id === hardDeleteTarget.id) setUndo(null);
    setHardDeleteOpen(false);
    setHardDeleteTarget(null);
  };

  const handleMarcarPago = (gasto) => {
    updateGastoEmpresa(buildMarcarPago(gasto));
  };

  const handleDistribuirViaVerde = (gastoAtualizado) => {
    updateGastoEmpresa(gastoAtualizado);
    setViaVerdeOpen(false);
    setSelected(null);
  };

  const handleDocumentoStatus = (gasto, documentoStatus) => {
    updateGastoEmpresa({
      ...gasto,
      documentoStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const openCreateGasto = (defaults = {}) => {
    setGastoDefaults(defaults);
    setCreateOpen(true);
  };

  const openGastoVeiculo = (veiculo, categoria) => {
    openCreateGasto({
      veiculoId: veiculo.id,
      veiculo: veiculo.nome,
      categoria,
      natureza: DESPESA_NATUREZA.VARIAVEL,
      tipo: 'unico',
      estado: 'pago',
      dataPagamento: getTodayISO(),
      descricao: categoria === CATEGORIA_COMBUSTIVEL ? `Combustível — ${veiculo.nome}` : `Manutenção — ${veiculo.nome}`,
    });
  };

  const getObraNome = (obraId) => (obras || []).find((obra) => obra?.id === obraId)?.nome || '';

  const handleSaveVeiculo = (veiculo) => {
    if (selectedVeiculo) updateEmpresaVeiculo(veiculo);
    else addEmpresaVeiculo(veiculo);
    setVeiculoModalOpen(false);
    setSelectedVeiculo(null);
  };

  const handleSaveProgramada = (despesa) => {
    if (selectedProgramada) updateDespesaProgramada(despesa);
    else addDespesaProgramada(despesa);
    setProgramadaModalOpen(false);
    setSelectedProgramada(null);
  };

  const handleSaveRecuperar = (item) => {
    if (selectedRecuperar) updateValorRecuperar(item);
    else addValorRecuperar(item);
    setRecuperarModalOpen(false);
    setSelectedRecuperar(null);
  };

  const handleRegistarPagamentoProgramada = ({ data, estado, valor, mesReferencia, observacao = '' }) => {
    if (!selectedProgramada) return;
    const periodoMes = mesReferencia || pagamentoMesRef || getYearMonth(data);
    if (estado === 'pago' && temPagamentoRegistadoNoPeriodo(selectedProgramada, { gastos: gastosEmpresa, yearMonth: periodoMes })) {
      setPagamentoProgramadaOpen(false);
      setSelectedProgramada(null);
      setPagamentoMesRef('');
      return;
    }
    const veiculo = empresaVeiculos.find((item) => item.id === selectedProgramada.veiculoId);
    addGastosEmpresa([
      buildGastoFromProgramada(selectedProgramada, {
        data,
        estado,
        dataPagamento: estado === 'pago' ? data : '',
        veiculoNome: veiculo?.nome || '',
        valor,
        mesReferencia: periodoMes,
        observacao,
      }),
    ]);
    if (estado === 'pago') {
      updateDespesaProgramada(applyPagamentoProgramada(selectedProgramada, { dataPagamento: data }));
    }
    setPagamentoProgramadaOpen(false);
    setSelectedProgramada(null);
    setPagamentoMesRef('');
    setDetalheFixo(null);
  };

  const openPagamentoProgramada = (despesa, mesOcorrencia = '') => {
    setSelectedProgramada(despesa);
    setPagamentoMesRef(mesOcorrencia || '');
    setPagamentoProgramadaOpen(true);
  };

  const openDetalheProgramada = (programada, mesOcorrencia = '') => {
    if (!programada) return;
    const veiculo = empresaVeiculos.find((item) => item.id === programada.veiculoId) || null;
    setDetalheFixo({
      id: programada.id,
      kind: 'programada',
      titulo: programada.titulo,
      programada,
      veiculo,
      mesOcorrencia: mesOcorrencia || '',
    });
  };

  const handleMarcarRecuperado = (item) => {
    setReceberItem(item);
    setReceberData(getTodayISO());
  };

  const handleConfirmarRecebido = () => {
    if (!receberItem) return;
    updateValorRecuperar(marcarValorRecuperado(receberItem, receberData));
    setReceberItem(null);
  };

  const columns = [
    {
      key: 'data',
      label: 'Data',
      render: (row) => formatDate(row.data),
    },
    {
      key: 'descricao',
      label: 'Descrição',
      render: (row) => (
        <div className={styles.descCell}>
          <span className={styles.descMain}>
            {row.descricao || '—'}
            {' '}
            <DocumentoTipoBadge gasto={row} />
          </span>
          {row.local ? <span className={styles.descMeta}>{row.local}</span> : null}
          {row.veiculo ? <span className={styles.descMeta}>{row.veiculo}</span> : null}
          {row.fornecedorNome ? <span className={styles.descMeta}>{row.fornecedorNome}</span> : null}
          {row.obraId ? <span className={styles.descMeta}>Obra: {getObraNome(row.obraId)}</span> : null}
          {isCategoriaViaVerde(row.categoria) && getViaVerdeStatus(row) ? (
            <span className={styles.descMeta}>
              {VIA_VERDE_STATUS_LABELS[getViaVerdeStatus(row)] || getViaVerdeStatus(row)}
              {getViaVerdeStatus(row) !== 'geral'
                ? ` · distribuído ${formatCurrency(summarizeViaVerde(row)?.distribuido || 0)}`
                : ''}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'categoria',
      label: 'Categoria',
      render: (row) => row.categoria || '—',
    },
    {
      key: 'valor',
      label: 'Valor',
      align: 'right',
      render: (row) => (
        <div className={styles.valorCell}>
          <strong>{formatCurrency(getGastoEmpresaValor(row))}</strong>
          {hasIvaInfo(row) && formatGastoEmpresaIvaHint(row, formatCurrency) ? (
            <small>{formatGastoEmpresaIvaHint(row, formatCurrency)}</small>
          ) : null}
        </div>
      ),
    },
    {
      key: 'vencimento',
      label: 'Vencimento',
      render: (row) => (row.dataVencimento ? formatDate(row.dataVencimento) : '—'),
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => {
        const estado = getGastoEmpresaDisplayEstado(row);
        return (
          <Badge variant={getGastoEmpresaEstadoVariant(estado)}>
            {getGastoEmpresaEstadoLabel(estado)}
          </Badge>
        );
      },
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (row) => (row.tipo === 'recorrente' ? 'Recorrente' : 'Único'),
    },
    {
      key: 'documento',
      label: '',
      render: (row) => {
        const status = getDocumentoStatus(row);
        if (status === DOCUMENTO_STATUS.SEM_DOCUMENTO) return null;
        return (
          <span className={styles.docMark} title={DOCUMENTO_STATUS_LABELS[status]}>
            📎
          </span>
        );
      },
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (row) => (
        <div className={shared.tableActions}>
          {row.estado !== 'pago' && (
            <Button
              variant="secondary"
              size="sm"
              icon={CheckCircle}
              title="Marcar como pago"
              aria-label="Marcar como pago"
              onClick={() => handleMarcarPago(row)}
            />
          )}
          {isCategoriaViaVerde(row.categoria) && (
            <Button
              variant="secondary"
              size="sm"
              title="Distribuir por veículo"
              aria-label="Distribuir Via Verde por veículo"
              onClick={() => {
                setSelected(row);
                setViaVerdeOpen(true);
              }}
            >
              Distribuir
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            title="Editar"
            aria-label="Editar gasto da empresa"
            onClick={() => {
              setSelected(row);
              setEditOpen(true);
            }}
          />
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            title="Apagar gasto"
            aria-label="Apagar gasto"
            onClick={() => {
              setSelected(row);
              setDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className={shared.page}>
      <PageHeader
        title="Gastos da Empresa"
        subtitle="Visão geral, lançamentos e o que já está configurado"
        help={HELP.gasto.empresa}
        actions={
          <Button icon={Plus} onClick={() => openCreateGasto()}>
            Novo gasto
          </Button>
        }
      />

      {undo ? (
        <div className={styles.undoBanner} role="status">
          <span>Gasto apagado</span>
          <Button type="button" variant="secondary" size="sm" onClick={handleUndoDelete}>
            Desfazer
          </Button>
        </div>
      ) : null}

      {aba === 'visao' || aba === 'caixa' || aba === 'lancamentos' ? (
        <PeriodFilter
          presets={PRESETS_GASTOS}
          preset={period.preset}
          onPresetChange={period.setPreset}
          customInicio={period.customInicio}
          customFim={period.customFim}
          onCustomInicioChange={period.setCustomInicio}
          onCustomFimChange={period.setCustomFim}
          label={period.label}
        />
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label="Áreas de gastos da empresa">
        {AREAS_GASTOS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${aba === id ? styles.tabActive : ''} ${id === 'lixeira' ? styles.tabQuiet : ''}`}
            onClick={() => setAba(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'visao' && (
        <>
          <dl className={styles.resumoLinha}>
            <div>
              <dt>Total de gastos do período</dt>
              <dd>{formatCurrency(totalPeriodoAssinado)}</dd>
            </div>
            <div>
              <dt>Gastos fixos</dt>
              <dd>{formatCurrency(totalFixosPeriodo)}</dd>
            </div>
            <div>
              <dt>Impostos</dt>
              <dd>{formatCurrency(totalImpostosPeriodo)}</dd>
            </div>
            <div>
              <dt>IVA dedutível</dt>
              <dd>{formatCurrency(ivaResumo.ivaDedutivel)}</dd>
            </div>
          </dl>

          <section className={styles.listaSimples} aria-labelledby="recentes-title">
            <div className={styles.listaCabeca}>
              <h2 id="recentes-title" className={styles.sectionTitle}>Últimos lançamentos</h2>
              <Button variant="secondary" size="sm" onClick={() => setAba('lancamentos')}>
                Ver todos
              </Button>
            </div>
            {recentes.length === 0 ? (
              <p className={styles.nota}>Ainda não há lançamentos.</p>
            ) : (
              <ul className={styles.linhas}>
                {recentes.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.linhaBtn}
                      onClick={() => {
                        setSelected(item);
                        setEditOpen(true);
                      }}
                    >
                      <span>
                        <strong>{item.descricao || item.categoria || 'Gasto'}</strong>
                        <small>
                          {item.data ? formatDate(item.data) : 'Sem data'}
                          {item.categoria ? ` · ${item.categoria}` : ''}
                          {item.local ? ` · ${item.local}` : ''}
                        </small>
                      </span>
                      <strong>{formatCurrency(getGastoEmpresaValor(item))}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <nav className={styles.atalhosTexto} aria-label="Outras áreas">
            <button type="button" onClick={() => setAba('lancamentos')}>Ver lançamentos</button>
            <button type="button" onClick={() => setAba('programadas')}>Gastos fixos</button>
            <button type="button" onClick={() => setAba('impostos')}>Impostos / IVA</button>
          </nav>

          <details className={styles.maisConsultas}>
            <summary>Outras consultas</summary>
            <div className={styles.atalhosTexto}>
              <button type="button" onClick={() => setAba('controle')}>Controlo do mês</button>
              <button type="button" onClick={() => setAba('caixa')}>Caixa</button>
              <button type="button" onClick={() => setAba('custo')}>Custo mensal</button>
              <button type="button" onClick={() => setAba('lixeira')}>
                Lixeira{gastosEmpresaLixeira.length ? ` (${gastosEmpresaLixeira.length})` : ''}
              </button>
            </div>
          </details>
        </>
      )}

      {aba !== 'visao' && !AREAS_GASTOS.some(([id]) => id === aba) ? (
        <p className={styles.nota}>
          <button type="button" className={styles.linkVoltar} onClick={() => setAba('visao')}>
            Voltar à visão geral
          </button>
        </p>
      ) : null}

      {aba === 'controle' && controleDoMes && (
        <ControleDoMes
          modelo={controleDoMes}
          yearMonth={controleMes}
          onYearMonthChange={setControleMes}
          onAbrirRecorrente={(item) => openDetalheProgramada(item.programada, item.mesOcorrencia)}
          onDescontarRecorrente={(item) => openPagamentoProgramada(item.programada, item.mesOcorrencia)}
          onAbrirOutro={(gasto) => {
            setSelected(gasto);
            setEditOpen(true);
          }}
        />
      )}
      {aba === 'controle' && !controleDoMes ? (
        <p className={styles.meta}>Não foi possível carregar o Controlo do mês. As outras abas continuam disponíveis.</p>
      ) : null}

      {aba === 'caixa' && (
        <>
          <CaixaEmpresa
            caixa={caixaEmpresa}
            periodLabel={GASTOS_EMPRESA_TOTAL_LABELS[period.preset] || 'Total do período'}
            onAbrirGasto={(gasto) => {
              setSelected(gasto);
              setEditOpen(true);
            }}
            onAbrirProgramada={(programada) => openDetalheProgramada(programada)}
          />

          {viaVerdePendentes.length > 0 && (
            <section className={styles.compromissos} aria-labelledby="via-verde-title">
              <h2 id="via-verde-title" className={styles.sectionTitle} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                Via Verde por conferir
                <HelpTip text={HELP.viatura.viaVerde} />
              </h2>
              <ul className={styles.compromissoList}>
                {viaVerdePendentes.map((item) => {
                  const info = summarizeViaVerde(item);
                  return (
                    <li key={item.id} className={styles.compromissoItem}>
                      <div>
                        <strong>{item.descricao || 'Via Verde'}</strong>
                        <span>
                          {item.data ? formatDate(item.data) : 'Não informado'} · Débito{' '}
                          {formatCurrency(info.debito)} · Distribuído {formatCurrency(info.distribuido)} ·
                          Diferença {formatCurrency(info.diferenca)}
                        </span>
                      </div>
                      <div className={styles.compromissoValor}>
                        <Badge variant="warning">Por conferir</Badge>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelected(item);
                            setViaVerdeOpen(true);
                          }}
                        >
                          Distribuir
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {proximas.length > 0 && (
            <section className={styles.compromissos} aria-labelledby="proximas-title">
              <h2 id="proximas-title" className={styles.sectionTitle}>
                Obrigações futuras conhecidas
              </h2>
              <p className={styles.nota}>
                Só entram cobranças com data ou recorrência confirmada. Cobertura/validade por si só
                não gera uma linha aqui.
              </p>
              <ul className={styles.compromissoList}>
                {proximas.map((item) => (
                  <li key={item.id} className={styles.compromissoItem}>
                    <div>
                      <strong>{item.tituloHome}</strong>
                      {item.quandoLabel ? <span>{item.quandoLabel}</span> : null}
                    </div>
                    <div className={styles.compromissoValor}>
                      <Badge variant={getEstadoFixoBadgeVariant(item.estado)}>
                        {item.estado?.label || 'Pendente'}
                      </Badge>
                      <strong>{formatCurrency(item.valor)}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {aba === 'custo' && (
        <CustoMensalEmpresa
          custo={custoMensal}
          gastos={gastosEmpresa}
          onAbrir={(programada) => openDetalheProgramada(programada)}
        />
      )}

      {aba === 'lancamentos' && (
        <>
      <p className={styles.nota}>
        Total do período {formatCurrency(totalPeriodoAssinado)}. Pagos {formatCurrency(resumo.pago)} ·
        Pendentes {formatCurrency(resumo.pendente)} · Previstos {formatCurrency(resumo.previsto)}.
        Sem IVA {formatCurrency(resumo.totalSemIva)} · Com IVA {formatCurrency(resumo.totalComIva)}.
      </p>

      {compromissos.length > 0 && (
        <section className={styles.compromissos} aria-labelledby="compromissos-title">
          <h2 id="compromissos-title" className={styles.sectionTitle}>
            Gastos pendentes
          </h2>
          <ul className={styles.compromissoList}>
            {compromissos.slice(0, 8).map((item) => (
              <li
                key={item.id}
                className={`${styles.compromissoItem} ${item.vencido ? styles.compromissoVencido : ''}`}
              >
                <div>
                  <strong>{item.descricao}</strong>
                  <span>
                    {item.categoria}
                    {item.dataVencimento ? ` — vence ${formatDate(item.dataVencimento)}` : ''}
                  </span>
                </div>
                <div className={styles.compromissoValor}>
                  <Badge variant={getGastoEmpresaEstadoVariant(item.displayEstado)}>
                    {getGastoEmpresaEstadoLabel(item.displayEstado)}
                  </Badge>
                  <strong>{formatCurrency(getGastoEmpresaValor(item))}</strong>
                </div>
              </li>
            ))}
          </ul>
          {compromissos.length > 8 && (
            <p className={styles.nota}>A mostrar os 8 mais urgentes. Use os filtros para ver todos.</p>
          )}
        </section>
      )}

      {categoriasOrdenadas.length > 0 && (
        <details className={styles.maisConsultas}>
          <summary>Totais por categoria</summary>
          <ul className={styles.linhas}>
            {categoriasOrdenadas.map(([categoria, total]) => (
              <li key={categoria} className={styles.linhaEstatica}>
                <span>{categoria}</span>
                <strong>{formatCurrency(total)}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={shared.filters}>
        <input
          className={shared.filterInput}
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          placeholder="Pesquisar descrição, fornecedor, categoria, veículo ou local"
          aria-label="Pesquisar lançamentos"
        />
        <select
          className={shared.filterInput}
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {gruposCategoria.map((grupo) => (
            <optgroup key={grupo.grupo} label={grupo.grupo}>
              {grupo.categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          className={shared.filterInput}
          value={filtroVeiculo}
          onChange={(e) => setFiltroVeiculo(e.target.value)}
          aria-label="Filtrar por veículo"
        >
          <option value="">Todos os veículos</option>
          {(empresaVeiculos || []).filter(Boolean).map((veiculo) => (
            <option key={veiculo.id} value={veiculo.id}>
              {veiculo.nome}
            </option>
          ))}
        </select>
        <select
          className={shared.filterInput}
          value={filtroObra}
          onChange={(e) => setFiltroObra(e.target.value)}
          aria-label="Filtrar por obra"
        >
          <option value="">Todas as obras</option>
          {sortObrasForDisplay(obras).map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nome}
            </option>
          ))}
        </select>
        <select
          className={shared.filterInput}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Pago e pendente</option>
          {GASTO_EMPRESA_ESTADOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          <option value="vencido">Vencido</option>
        </select>
        <select
          className={shared.filterInput}
          value={filtroTipoLancamento}
          onChange={(e) => setFiltroTipoLancamento(e.target.value)}
          aria-label="Filtrar por tipo de despesa"
        >
          <option value="">Recorrentes e variáveis</option>
          <option value="recorrente">Recorrentes</option>
          <option value="variavel">Variáveis</option>
        </select>
      </div>

      <div className={shared.tableScroll}>
        <Table
          columns={columns}
          data={lancamentosVisiveis}
          emptyMessage="Nenhum gasto da empresa neste período."
        />
      </div>
        </>
      )}

      {aba === 'impostos' && (
        <section className={styles.listaSimples}>
          <h2 className={styles.sectionTitle}>IVA deste período</h2>
          <dl className={styles.resumoLinha}>
            <div>
              <dt>IVA</dt>
              <dd>{formatCurrency(ivaResumo.iva)}</dd>
            </div>
            <div>
              <dt>IVA dedutível</dt>
              <dd>{formatCurrency(ivaResumo.ivaDedutivel)}</dd>
            </div>
            <div>
              <dt>IVA não dedutível</dt>
              <dd>{formatCurrency(ivaResumo.ivaNaoDedutivel)}</dd>
            </div>
          </dl>
          <p className={styles.nota}>
            Estes valores usam as regras de IVA já configuradas. As regras em si estão em Configurações.
          </p>
        </section>
      )}

      {aba === 'impostos' && (
        <EmpresaDocumentosPanel
          gastos={gastosEmpresa}
          yearMonth={documentosMes}
          onYearMonthChange={setDocumentosMes}
          periodPreset={documentosPeriodo}
          onPeriodPresetChange={setDocumentosPeriodo}
          filtroStatus={filtroDocumento}
          onFiltroStatusChange={setFiltroDocumento}
          onAbrir={(gasto) => {
            setSelected(gasto);
            setEditOpen(true);
          }}
          onMarcarStatus={handleDocumentoStatus}
        />
      )}

      {aba === 'programadas' && (
        <DespesasProgramadasAgenda
          agenda={agendaProgramadas}
          yearMonth={agendaMes}
          onYearMonthChange={setAgendaMes}
          onNova={() => {
            setSelectedProgramada(null);
            setProgramadaModalOpen(true);
          }}
          onAbrir={(item) => openDetalheProgramada(item.programada, item.mesOcorrencia)}
          onPagar={(item) => openPagamentoProgramada(item.programada, item.mesOcorrencia)}
        />
      )}

      {aba === 'configuracoes' && (
        <section>
          <h2 className={styles.sectionTitle}>Configurações</h2>
          <div className={styles.atalhos}>
            <Button variant="secondary" icon={Tags} onClick={() => setCategoriasOpen(true)}>
              Categorias
            </Button>
            <Button variant="secondary" icon={Building2} onClick={() => setFornecedoresOpen(true)}>
              Fornecedores
            </Button>
            <Button variant="secondary" icon={Settings} onClick={() => setIvaRegrasOpen(true)}>
              Regras de IVA
            </Button>
          </div>
        </section>
      )}

      {aba === 'configuracoes' && (
        <section>
          <div className={shared.sectionHeader}>
            <h2 className={styles.sectionTitle} style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              Veículos
              <HelpTip text={HELP.viatura.associar} />
            </h2>
            <Button
              icon={Plus}
              size="sm"
              onClick={() => {
                setSelectedVeiculo(null);
                setVeiculoModalOpen(true);
              }}
            >
              Novo veículo
            </Button>
          </div>
          <p className={styles.nota}>
            Combustível deste mês: {formatCurrency(variaveisMes.combustivel)}. Total acumulado:{' '}
            {formatCurrency(combustivelTotalEmpresa)}.
          </p>
          <div className={styles.infoGrid}>
            {empresaVeiculos.map((veiculo) => (
              <VeiculoFinanceiroCard
                key={veiculo.id}
                veiculo={veiculo}
                custos={summarizeVeiculoCustos(veiculo, gastosEmpresa, empresaDespesasProgramadas)}
                valoresRecuperar={empresaValoresRecuperar.filter((item) => item.veiculoId === veiculo.id)}
                onCombustivel={() => openGastoVeiculo(veiculo, CATEGORIA_COMBUSTIVEL)}
                onManutencao={() => openGastoVeiculo(veiculo, 'Manutenção')}
                onOutro={() =>
                  openCreateGasto({
                    veiculoId: veiculo.id,
                    veiculo: veiculo.nome,
                    natureza: DESPESA_NATUREZA.VARIAVEL,
                  })
                }
                onHistorico={() => setSelectedVeiculo(veiculo)}
                onEditar={() => {
                  setSelectedVeiculo(veiculo);
                  setVeiculoModalOpen(true);
                }}
                onMarcarRecuperado={handleMarcarRecuperado}
              />
            ))}
          </div>
          {selectedVeiculo && !veiculoModalOpen && (
            <div className={styles.detailBox} style={{ marginTop: '1rem' }}>
              <div className={shared.sectionHeader}>
                <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                  Histórico — {selectedVeiculo.nome}
                </h3>
                <Button variant="secondary" size="sm" onClick={() => setSelectedVeiculo(null)}>
                  Fechar
                </Button>
              </div>
              <Table
                columns={[
                  { key: 'data', label: 'Data', render: (row) => formatDate(row.data) },
                  { key: 'descricao', label: 'Descrição', render: (row) => row.descricao },
                  { key: 'categoria', label: 'Tipo', render: (row) => row.categoria },
                  {
                    key: 'valor',
                    label: 'Valor',
                    align: 'right',
                    render: (row) => formatCurrency(getValorGastoNoVeiculo(row, selectedVeiculo)),
                  },
                  {
                    key: 'estado',
                    label: 'Estado',
                    render: (row) => getGastoEmpresaEstadoLabel(getGastoEmpresaDisplayEstado(row)),
                  },
                ]}
                data={[...getGastosDoVeiculo(gastosEmpresa, selectedVeiculo)].sort((a, b) =>
                  String(b.data || '').localeCompare(String(a.data || ''))
                )}
                emptyMessage="Ainda não há gastos neste veículo."
              />
            </div>
          )}
        </section>
      )}

      {aba === 'impostos' && (
        <section className={styles.detailBox}>
          <div className={shared.sectionHeader}>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
              Valores a recuperar
            </h2>
            <Button
              icon={Plus}
              size="sm"
              onClick={() => {
                setSelectedRecuperar(null);
                setRecuperarModalOpen(true);
              }}
            >
              Novo valor
            </Button>
          </div>
          <p className={styles.nota}>
            Estes valores não entram como receita até serem marcados como recebidos.
          </p>
          <Table
            columns={[
              { key: 'descricao', label: 'Descrição', render: (row) => row.descricao },
              {
                key: 'valor',
                label: 'Valor',
                align: 'right',
                render: (row) => formatCurrency(row.valor),
              },
              {
                key: 'previsao',
                label: 'Previsão',
                render: (row) => formatYearMonth(row.previsaoMes),
              },
              {
                key: 'status',
                label: 'Estado',
                render: (row) => (
                  <Badge variant={row.status === VALOR_RECUPERAR_STATUS.RECEBIDO ? 'success' : 'warning'}>
                    {row.status === VALOR_RECUPERAR_STATUS.RECEBIDO ? 'Recebido' : 'Pendente'}
                  </Badge>
                ),
              },
              {
                key: 'dataRecebido',
                label: 'Recebido em',
                render: (row) => (row.dataRecebido ? formatDate(row.dataRecebido) : '—'),
              },
              {
                key: 'acoes',
                label: 'Ações',
                align: 'right',
                render: (row) => (
                  <div className={shared.tableActions}>
                    {row.status !== VALOR_RECUPERAR_STATUS.RECEBIDO && (
                      <Button size="sm" onClick={() => handleMarcarRecuperado(row)}>
                        Marcar recebido
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      onClick={() => {
                        setSelectedRecuperar(row);
                        setRecuperarModalOpen(true);
                      }}
                    />
                  </div>
                ),
              },
            ]}
            data={empresaValoresRecuperar}
            emptyMessage="Sem valores a recuperar."
          />
        </section>
      )}

      {aba === 'lixeira' && (
        <section className={styles.lixeiraBox} aria-labelledby="lixeira-title">
          <h2 id="lixeira-title" className={styles.sectionTitle}>
            Lixeira
          </h2>
          <p className={styles.nota}>
            Gastos apagados recentemente. Restaurar devolve o registo original. Apagar
            definitivamente remove o gasto de vez.
          </p>
          {gastosEmpresaLixeira.length === 0 ? (
            <p className={styles.nota}>Nenhum gasto na lixeira.</p>
          ) : (
            <ul className={styles.lixeiraList}>
              {gastosEmpresaLixeira.map((gasto) => (
                <li key={gasto.id} className={styles.lixeiraItem}>
                  <div>
                    <strong>{getGastoEmpresaFornecedorLabel(gasto)}</strong>
                    <span>
                      {formatCurrency(getGastoEmpresaValor(gasto))}
                      {gasto.data ? ` · ${formatDate(gasto.data)}` : ''}
                      {gasto.categoria ? ` · ${gasto.categoria}` : ''}
                    </span>
                    <span className={styles.lixeiraMeta}>
                      Apagado {formatDateTime(gasto.deletedAt || gasto.deleted_at)}
                    </span>
                  </div>
                  <div className={shared.tableActions}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => handleRestore(gasto)}
                    >
                      Restaurar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => {
                        setHardDeleteTarget(gasto);
                        setHardDeleteOpen(true);
                      }}
                    >
                      Apagar definitivamente
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <GerenciarCategoriasEmpresaModal
        isOpen={categoriasOpen}
        onClose={() => setCategoriasOpen(false)}
        catalog={gastosEmpresaCategorias}
        gastos={gastosEmpresa}
        onSaveCatalog={saveGastosEmpresaCategorias}
        onRenameCategoria={({ categoriaId, nome }) =>
          renameGastoEmpresaCategoria(categoriaId, nome)
        }
      />

      <IvaRegrasModal
        isOpen={ivaRegrasOpen}
        onClose={() => setIvaRegrasOpen(false)}
        regras={empresaIvaRegras}
        onSave={saveEmpresaIvaRegras}
      />

      <FornecedoresModal
        isOpen={fornecedoresOpen}
        onClose={() => setFornecedoresOpen(false)}
        fornecedores={empresaFornecedores}
        onSave={saveEmpresaFornecedores}
      />

      <GastoEmpresaFormModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setGastoDefaults({});
        }}
        mode="create"
        gastos={gastosEmpresa}
        defaults={gastoDefaults}
        onSubmit={handleCreate}
      />

      <GastoEmpresaFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        mode="edit"
        gasto={selected}
        gastos={gastosEmpresa}
        onSubmit={handleEdit}
        onDistribuir={() => {
          setEditOpen(false);
          setViaVerdeOpen(true);
        }}
        onDelete={handleDeleteById}
      />

      <VeiculoFormModal
        isOpen={veiculoModalOpen}
        onClose={() => {
          setVeiculoModalOpen(false);
          if (!selectedVeiculo?.id) setSelectedVeiculo(null);
        }}
        veiculo={veiculoModalOpen ? selectedVeiculo : null}
        onSubmit={handleSaveVeiculo}
      />

      <DespesaProgramadaFormModal
        isOpen={programadaModalOpen}
        onClose={() => {
          setProgramadaModalOpen(false);
          setSelectedProgramada(null);
        }}
        despesa={programadaModalOpen ? selectedProgramada : null}
        onSubmit={handleSaveProgramada}
      />

      <ValorRecuperarFormModal
        isOpen={recuperarModalOpen}
        onClose={() => {
          setRecuperarModalOpen(false);
          setSelectedRecuperar(null);
        }}
        item={recuperarModalOpen ? selectedRecuperar : null}
        onSubmit={handleSaveRecuperar}
      />

      <RegistrarPagamentoProgramadaModal
        isOpen={pagamentoProgramadaOpen}
        onClose={() => {
          setPagamentoProgramadaOpen(false);
          setSelectedProgramada(null);
          setPagamentoMesRef('');
        }}
        despesa={selectedProgramada}
        gastos={gastosEmpresa}
        mesReferencia={pagamentoMesRef}
        onSubmit={handleRegistarPagamentoProgramada}
      />

      <GastoFixoDetalheModal
        isOpen={Boolean(detalheFixo)}
        onClose={() => setDetalheFixo(null)}
        linha={detalheFixo}
        gastos={gastosEmpresa}
        programadas={empresaDespesasProgramadas}
        valoresRecuperar={empresaValoresRecuperar}
        onRegistar={(despesa) => {
          const mes = detalheFixo?.mesOcorrencia || agendaMes;
          setDetalheFixo(null);
          openPagamentoProgramada(despesa, mes);
        }}
        onEditar={(despesa) => {
          setDetalheFixo(null);
          setSelectedProgramada(despesa);
          setProgramadaModalOpen(true);
        }}
        onEditarVeiculo={(veiculo) => {
          setDetalheFixo(null);
          setSelectedVeiculo(veiculo);
          setVeiculoModalOpen(true);
        }}
        onMarcarRecuperado={(item) => {
          setDetalheFixo(null);
          handleMarcarRecuperado(item);
        }}
      />

      <ViaVerdeDistribuicaoModal
        isOpen={viaVerdeOpen}
        onClose={() => {
          setViaVerdeOpen(false);
          setSelected(null);
        }}
        gasto={viaVerdeOpen ? selected : null}
        onSubmit={handleDistribuirViaVerde}
      />

      <Modal
        isOpen={Boolean(receberItem)}
        onClose={() => setReceberItem(null)}
        title="Marcar valor como recebido"
        footer={
          <FormActions>
            <Button variant="secondary" type="button" onClick={() => setReceberItem(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmarRecebido}>
              Confirmar recebido
            </Button>
          </FormActions>
        }
      >
        {receberItem ? (
          <>
            <p>{receberItem.descricao} — {formatCurrency(receberItem.valor)}</p>
            <FormGroup label="Data real do recebimento">
              <Input type="date" value={receberData} onChange={(e) => setReceberData(e.target.value)} />
            </FormGroup>
          </>
        ) : null}
      </Modal>

      {selected && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title="Tem certeza que deseja apagar este gasto?"
          cancelLabel="Cancelar"
          confirmLabel="Apagar"
        >
          <div className={confirmStyles.details}>
            {[
              ['Fornecedor', getGastoEmpresaFornecedorLabel(selected)],
              ['Data', selected.data ? formatDate(selected.data) : '—'],
              ['Valor', formatCurrency(getGastoEmpresaValor(selected))],
            ].map(([label, value]) => (
              <div key={label} className={confirmStyles.detailRow}>
                <span className={confirmStyles.detailLabel}>{label}:</span>
                <span className={confirmStyles.detailValue}>{value}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}

      {hardDeleteTarget && (
        <ConfirmDialog
          isOpen={hardDeleteOpen}
          onClose={() => {
            setHardDeleteOpen(false);
            setHardDeleteTarget(null);
          }}
          onConfirm={handleHardDelete}
          title="Apagar definitivamente?"
          cancelLabel="Cancelar"
          confirmLabel="Apagar definitivamente"
        >
          <p className={confirmStyles.message}>Esta ação não poderá ser desfeita.</p>
          <div className={confirmStyles.details}>
            {[
              ['Fornecedor', getGastoEmpresaFornecedorLabel(hardDeleteTarget)],
              ['Valor', formatCurrency(getGastoEmpresaValor(hardDeleteTarget))],
              ['Data', hardDeleteTarget.data ? formatDate(hardDeleteTarget.data) : '—'],
            ].map(([label, value]) => (
              <div key={label} className={confirmStyles.detailRow}>
                <span className={confirmStyles.detailLabel}>{label}:</span>
                <span className={confirmStyles.detailValue}>{value}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
