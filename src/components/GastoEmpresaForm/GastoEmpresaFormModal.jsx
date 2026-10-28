import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow } from '../Form/Form';
import { METODOS_PAGAMENTO } from '../../data/mockData';
import { useApp } from '../../context/AppContext';
import { getGruposParaSelect } from '../../utils/gastoEmpresaCategoriaCatalog';
import {
  EMPTY_GASTO_EMPRESA_FORM,
  getEmptyGastoEmpresaForm,
  gastoEmpresaToForm,
  validateGastoEmpresaForm,
  isGastoEmpresaFormDirty,
} from '../../utils/gastoEmpresaForm';
import { GASTO_EMPRESA_ESTADOS, GASTO_EMPRESA_PERIODICIDADES, getGastoEmpresaValor } from '../../utils/gastoEmpresaCalculations';
import {
  inferNaturezaFromCategoria,
  isCategoriaViaVerde,
  VIA_VERDE_STATUS,
} from '../../utils/empresaFinanceiroCalculations';
import {
  IVA_TAXA_PRESETS,
  previewIvaFromForm,
  formatTaxaIva,
  emptyIvaFormFields,
  getTaxaPresetId,
  emptyIvaPersistFields,
} from '../../utils/ivaCalculations';
import { formatCurrency, formatDate, formatDateTime, getTodayISO } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import HelpTip from '../HelpTip/HelpTip';
import { formatGastoEmpresaHistoricoValor, getGastoEmpresaFornecedorLabel } from '../../utils/gastoEmpresaSeguranca';
import {
  TIPOS_GASTO_RAPIDOS,
  getLayoutTipoRapido,
  inferTipoRapido,
  layoutTemCampo,
  sugerirFormularioTipoRapido,
  categoriaCombinaBusca,
} from '../../utils/gastoEmpresaTipoRapido';
import {
  getVatRule,
  getVeiculoCombustivelLabel,
  isCategoriaMaterial,
  isCategoriaCarregamento,
  isVeiculoChapolim,
  aplicarPreenchimentoIvaCarregamento,
  buildIvaSnapshotFromForm,
} from '../../utils/empresaIvaRules';
import {
  suggestFornecedores,
  findPossibleDuplicateGasto,
  findFornecedorByNome,
  findFornecedorRegraConhecida,
  applyFornecedorRegraToForm,
  getFornecedorRegraFiscal,
  podeSalvarFornecedorRegra,
  resolveFornecedorParaPreenchimento,
} from '../../utils/empresaFornecedores';
import { generateId } from '../../services/storageService';
import { sortObrasForDisplay } from '../../utils/obraStatus';
import { fileToAnexo } from '../../utils/empresaDocumentos';
import {
  TIPO_DOCUMENTO,
  applySinal,
  listFaturasRelacionaveis,
  aplicarFaturaOriginalAoForm,
} from '../../utils/gastoDocumentoTipo';
import GastoTipoDocumentoFields from '../GastoForm/GastoTipoDocumentoFields';
import {
  CATEGORIA_CARREGAMENTO_ELETRICO,
  DOCUMENTO_STATUS,
  DOCUMENTO_STATUS_LABELS,
  IVA_REGRA_ORIGEM_LABELS,
  VEICULO_COMBUSTIVEL,
} from '../../constants/empresaIva';
import ServicoAbatimentoSelect from '../ObraDetalhes/ServicoAbatimentoSelect';
import ivaStyles from '../GastoForm/GastoForm.module.css';
import styles from './GastoEmpresaForm.module.css';

const MAX_ANEXO_BYTES = 2.5 * 1024 * 1024;

export default function GastoEmpresaFormModal({
  isOpen,
  onClose,
  mode = 'create',
  gasto = null,
  defaults = {},
  onSubmit,
  onDistribuir,
  onDelete,
}) {
  const {
    gastosEmpresaCategorias,
    empresaVeiculos = [],
    empresaDespesasProgramadas = [],
    empresaFornecedores = [],
    empresaIvaRegras = [],
    gastosEmpresa = [],
    obras = [],
    funcionarios = [],
  } = useApp();
  const [form, setForm] = useState(EMPTY_GASTO_EMPRESA_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_GASTO_EMPRESA_FORM);
  const [errors, setErrors] = useState({});
  const [tipoRapido, setTipoRapido] = useState('');
  const [sugestaoHint, setSugestaoHint] = useState('');
  const [fornecedorQuery, setFornecedorQuery] = useState('');
  const [showFornecedorList, setShowFornecedorList] = useState(false);
  const [avisoDuplicado, setAvisoDuplicado] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pesquisaCategoria, setPesquisaCategoria] = useState('');

  const isEdit = mode === 'edit';
  const isNotaCreditoForm = form.tipoDocumento === TIPO_DOCUMENTO.NOTA_CREDITO;
  const title = isEdit
    ? isNotaCreditoForm
      ? 'Editar nota de crédito'
      : 'Editar gasto da empresa'
    : isNotaCreditoForm
      ? 'Adicionar nota de crédito'
      : 'Adicionar gasto';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Guardar';
  const gruposCategoria = getGruposParaSelect(gastosEmpresaCategorias, {
    apenasAtivas: true,
    incluirNome: form.categoria,
  });
  const categoriasFiltradas = gruposCategoria
    .map((grupo) => ({
      ...grupo,
      categorias: (grupo.categorias || []).filter((nome) => categoriaCombinaBusca(nome, pesquisaCategoria)),
    }))
    .filter((grupo) => grupo.categorias.length > 0);
  const locaisConhecidos = [
    'Garagem',
    'Galpão / armazém',
    ...(obras || [])
      .filter((obra) => /tavira|apartamento|garagem|galp[aã]o|armaz[eé]m/i.test(obra?.nome || ''))
      .map((obra) => obra.nome),
  ].filter((nome, index, lista) => nome && lista.indexOf(nome) === index);

  useEffect(() => {
    if (!isOpen) return;
    const initial =
      isEdit && gasto
        ? gastoEmpresaToForm(gasto)
        : getEmptyGastoEmpresaForm(defaults);
    setForm(initial);
    setInitialForm(initial);
    setErrors({});
    setSugestaoHint('');
    setFornecedorQuery(initial.fornecedorNome || '');
    setAvisoDuplicado(null);
    setConfirmDelete(false);
    setPesquisaCategoria('');
    setTipoRapido(
      isEdit && gasto
        ? inferTipoRapido(gasto.categoria)
        : defaults.categoria
          ? inferTipoRapido(defaults.categoria)
          : ''
    );
  }, [isOpen, isEdit, gasto, defaults.veiculoId, defaults.natureza, defaults.categoria, defaults.estado, defaults.descricao, defaults.viaVerdeModo]);

  const layout = getLayoutTipoRapido(tipoRapido);
  const viaVerde = isCategoriaViaVerde(form.categoria) || tipoRapido === 'via_verde';
  const viaVerdeConferida = isEdit && gasto?.viaVerde?.distribuicaoStatus === VIA_VERDE_STATUS.CONFERIDO;
  const selectedVeiculo = empresaVeiculos.find((item) => item?.id === form.veiculoId) || null;
  const combustivelLabel = getVeiculoCombustivelLabel(selectedVeiculo?.combustivel || form.combustivelTipo);

  const aplicarSugestao = (next, tipoId, veiculoId) => {
    const sugestao = sugerirFormularioTipoRapido(tipoId, {
      programadas: empresaDespesasProgramadas,
      veiculoId,
    });
    if (!sugestao) {
      next.despesaProgramadaId = '';
      setSugestaoHint('');
      return next;
    }
    if (sugestao.valor) next.valor = sugestao.valor;
    if (sugestao.categoria) next.categoria = sugestao.categoria;
    if (sugestao.descricao) next.descricao = sugestao.descricao;
    if (sugestao.natureza) next.natureza = sugestao.natureza;
    if (sugestao.despesaProgramadaId) next.despesaProgramadaId = sugestao.despesaProgramadaId;
    if (sugestao.periodicidade) next.periodicidade = sugestao.periodicidade;
    if (sugestao.data) next.data = sugestao.data;
    setSugestaoHint(sugestao.hint || '');
    return next;
  };

  const aplicarVeiculo = (next, veiculoId, tipoId = tipoRapido) => {
    const veiculo = empresaVeiculos.find((item) => item?.id === veiculoId);
    next.veiculo = veiculo?.nome || '';
    next.combustivelTipo = veiculo?.combustivel || '';
    if (
      veiculo?.combustivel === VEICULO_COMBUSTIVEL.ELETRICO &&
      (tipoId === 'combustivel' || tipoId === 'carregamento')
    ) {
      next.categoria = CATEGORIA_CARREGAMENTO_ELETRICO;
      if (tipoId === 'combustivel') setTipoRapido('carregamento');
    }
    Object.assign(next, aplicarPreenchimentoIvaCarregamento(next, veiculo));
    return next;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'estado' && value === 'pago' && !prev.dataPagamento) {
        next.dataPagamento = getTodayISO();
      }
      if (name === 'tipo' && value === 'unico') {
        next.gerarPrevistos = 'nao';
      }
      if (name === 'veiculoId') {
        aplicarVeiculo(next, value);
        if (viaVerde && !value && !next.viaVerdeModo) {
          next.viaVerdeModo = VIA_VERDE_STATUS.POR_CONFERIR;
        }
        if (tipoRapido === 'prestacao' || tipoRapido === 'seguro') {
          return aplicarSugestao(next, tipoRapido, value);
        }
      }
      if (name === 'temIva') {
        if (value === 'nao') {
          Object.assign(next, emptyIvaFormFields());
          next.temIva = 'nao';
          next.percentagemDedutivel = '';
          next.ivaManual = 'nao';
        } else if (value === 'sim') {
          if (!next.valorBaseTipo) next.valorBaseTipo = 'com_iva';
          if (!next.taxaIvaPreset && next.faturaMultiplasTaxas !== 'sim') next.taxaIvaPreset = '23';
          if (isCategoriaMaterial(next.categoria) && !next.faturaEmNomeEmpresa) {
            next.faturaEmNomeEmpresa = 'sim';
          }
        }
      }
      if (name === 'categoria') {
        if (!prev.natureza) next.natureza = inferNaturezaFromCategoria(value);
        if (!prev.descricao || prev.descricao === prev.categoria) next.descricao = value;
        if (isCategoriaViaVerde(value) && !next.veiculoId) {
          next.viaVerdeModo = prev.viaVerdeModo || VIA_VERDE_STATUS.POR_CONFERIR;
          if (!isEdit) {
            next.estado = 'pago';
            next.dataPagamento = prev.dataPagamento || getTodayISO();
          }
        }
        setTipoRapido(inferTipoRapido(value));
        const veiculo = empresaVeiculos.find((item) => item?.id === next.veiculoId);
        Object.assign(next, aplicarPreenchimentoIvaCarregamento(next, veiculo));
      }
      if (name === 'faturaMultiplasTaxas' && value === 'sim' && !(prev.ivaLinhas || []).length) {
        next.ivaLinhas = [{ id: generateId(), valorBase: '', taxaIva: '' }];
      }
      if (name === 'percentagemDedutivel') {
        next.ivaManual = 'sim';
      }
      if (name === 'faturaOriginalId') {
        const fatura = gastosEmpresa.find((item) => item.id === value);
        if (fatura) return aplicarFaturaOriginalAoForm(next, fatura);
      }
      if (name === 'ivaManual' && value === 'nao') {
        const veiculo = empresaVeiculos.find((item) => item?.id === prev.veiculoId);
        if (isCategoriaCarregamento(next.categoria) && isVeiculoChapolim(veiculo)) {
          next.percentagemDedutivel = '100';
          if (next.faturaMultiplasTaxas !== 'sim') {
            next.taxaIvaPreset = '23';
            next.taxaIvaOutra = '';
          }
        } else {
          const existing =
            (prev.fornecedorId && empresaFornecedores.find((item) => item?.id === prev.fornecedorId)) ||
            findFornecedorByNome(empresaFornecedores, prev.fornecedorNome);
          const regra = existing
            ? getFornecedorRegraFiscal(existing)
            : findFornecedorRegraConhecida(prev.fornecedorNome);
          if (regra?.percentagemIvaRecuperavel != null) {
            next.percentagemDedutivel = String(regra.percentagemIvaRecuperavel);
          }
        }
      }
      if (name === 'obraId') next.intervencaoId = '';
      if (name === 'local') {
        const obraLocal = obras.find((obra) => obra?.nome === value);
        if (obraLocal) next.obraId = obraLocal.id;
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev, [name]: null };
      if (name === 'temIva' && value === 'nao') {
        next.taxaIvaPreset = null;
        next.taxaIvaOutra = null;
        next.valorBaseTipo = null;
        next.percentagemDedutivel = null;
      }
      return next;
    });
  };

  const handlePickCategoria = (nome) => {
    const tipoId = inferTipoRapido(nome);
    setTipoRapido(tipoId);
    setPesquisaCategoria('');
    setForm((prev) => {
      const next = {
        ...prev,
        categoria: nome,
        descricao: prev.descricao && prev.descricao !== prev.categoria ? prev.descricao : nome,
        natureza: inferNaturezaFromCategoria(nome),
      };
      if (tipoId === 'via_verde') {
        next.viaVerdeModo = prev.viaVerdeModo || VIA_VERDE_STATUS.POR_CONFERIR;
        next.estado = prev.estado || 'pago';
      } else if (!isCategoriaViaVerde(nome)) {
        next.viaVerdeModo = '';
      }
      if (!layoutTemCampo(getLayoutTipoRapido(tipoId), 'veiculo')) {
        next.veiculoId = '';
        next.veiculo = '';
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, categoria: null, descricao: null }));
  };

  const handleSelectTipo = (tipo) => {
    setTipoRapido(tipo.id);
    setForm((prev) => {
      const next = {
        ...prev,
        categoria: tipo.categoria,
        descricao: tipo.id === 'outros' ? prev.descricao : tipo.label,
        natureza: inferNaturezaFromCategoria(tipo.categoria),
        despesaProgramadaId: '',
      };
      if (tipo.id === 'via_verde') {
        next.viaVerdeModo = prev.viaVerdeModo || VIA_VERDE_STATUS.POR_CONFERIR;
        next.estado = 'pago';
        next.dataPagamento = prev.dataPagamento || getTodayISO();
        next.veiculoId = prev.veiculoId || '';
        if (!next.veiculoId) next.veiculo = '';
      } else if (!isCategoriaViaVerde(tipo.categoria)) {
        next.viaVerdeModo = '';
      }
      if (tipo.id === 'material' && next.temIva === 'sim' && !next.faturaEmNomeEmpresa) {
        next.faturaEmNomeEmpresa = 'sim';
      }
      aplicarVeiculo(next, next.veiculoId, tipo.id);
      return aplicarSugestao(next, tipo.id, next.veiculoId);
    });
    setErrors((prev) => ({ ...prev, categoria: null, descricao: null }));
  };

  const aplicarFornecedor = (item) => {
    if (!item) return;
    setFornecedorQuery(item.nome);
    setShowFornecedorList(false);
    setForm((prev) => {
      const next = applyFornecedorRegraToForm(prev, item);
      next.salvarFornecedor = 'nao';
      const cat = next.categoria || prev.categoria;
      if (cat) {
        next.natureza = next.natureza || inferNaturezaFromCategoria(cat);
        setTipoRapido(inferTipoRapido(cat));
      }
      const veiculo = empresaVeiculos.find((itemVeiculo) => itemVeiculo?.id === next.veiculoId);
      return aplicarPreenchimentoIvaCarregamento(next, veiculo);
    });
  };

  const handleSelectFornecedor = (item) => {
    aplicarFornecedor(item);
  };

  const reconhecerFornecedor = (nome) => {
    const resolved = resolveFornecedorParaPreenchimento(empresaFornecedores, nome);
    if (!resolved) return;
    if (resolved.id && form.fornecedorId && resolved.id === form.fornecedorId) return;
    aplicarFornecedor(resolved);
  };

  const handleAnexo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_ANEXO_BYTES) {
      window.alert('O ficheiro é demasiado grande. Use uma fotografia ou PDF até cerca de 2,5 MB.');
      return;
    }
    try {
      const anexo = await fileToAnexo(file);
      setForm((prev) => ({
        ...prev,
        anexos: [...(prev.anexos || []), anexo],
        documentoStatus:
          prev.documentoStatus === DOCUMENTO_STATUS.PRONTA_CONTABILIDADE ||
          prev.documentoStatus === DOCUMENTO_STATUS.ENVIADA_CONTABILIDADE
            ? prev.documentoStatus
            : DOCUMENTO_STATUS.FATURA_ANEXADA,
      }));
    } catch {
      window.alert('Não foi possível anexar o ficheiro.');
    }
  };

  const handleClose = () => {
    if (isGastoEmpresaFormDirty(form, initialForm)) {
      const confirmed = window.confirm('Tem certeza que deseja sair sem salvar as alterações?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const taxaFromSnapshot =
      ivaSnapshot?.taxaIva != null && Number.isFinite(Number(ivaSnapshot.taxaIva))
        ? getTaxaPresetId(ivaSnapshot.taxaIva)
        : '';
    const payloadForm = {
      ...form,
      descricao: (form.descricao || '').trim() || form.categoria,
      fornecedorNome: (form.fornecedorNome || fornecedorQuery || '').trim(),
      tipoDocumento: form.tipoDocumento || TIPO_DOCUMENTO.FATURA,
      taxaIvaPreset: form.taxaIvaPreset || taxaFromSnapshot,
      taxaIvaOutra:
        form.taxaIvaOutra ||
        ((form.taxaIvaPreset || taxaFromSnapshot) === 'outra' && ivaSnapshot?.taxaIva != null
          ? String(ivaSnapshot.taxaIva)
          : form.taxaIvaOutra),
      percentagemDedutivel:
        form.percentagemDedutivel !== '' && form.percentagemDedutivel != null
          ? form.percentagemDedutivel
          : ivaSnapshot?.percentagemDedutivel != null
            ? String(ivaSnapshot.percentagemDedutivel)
            : '',
    };
    const validation = validateGastoEmpresaForm(payloadForm);
    if (layout.exigeDescricao && !(form.descricao || '').trim()) {
      setErrors({ ...validation.errors, descricao: 'Indique o que foi gasto.' });
      return;
    }
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    const duplicado = findPossibleDuplicateGasto(gastosEmpresa, {
      fornecedorNome: payloadForm.fornecedorNome,
      numeroFatura: payloadForm.numeroFatura,
      valor: payloadForm.valor,
      excludeId: gasto?.id,
    });
    if (duplicado && !avisoDuplicado) {
      setAvisoDuplicado(duplicado);
      return;
    }
    try {
      onSubmit(payloadForm);
    } catch (error) {
      console.error('[Gastos da Empresa] Falha ao guardar o gasto:', error);
      setErrors({
        ...validation.errors,
        categoria: 'Não foi possível guardar o gasto. Verifique os campos e tente novamente.',
      });
    }
  };

  const fornecedorRegra = useMemo(() => {
    const existing =
      (form.fornecedorId && empresaFornecedores.find((item) => item?.id === form.fornecedorId)) ||
      findFornecedorByNome(empresaFornecedores, form.fornecedorNome || fornecedorQuery);
    if (existing) return getFornecedorRegraFiscal(existing);
    const known = findFornecedorRegraConhecida(form.fornecedorNome || fornecedorQuery);
    if (!known) return null;
    return getFornecedorRegraFiscal({
      nome: form.fornecedorNome || fornecedorQuery,
      categoriaPadrao: known.categoriaPadrao,
      subcategoriaPadrao: known.subcategoriaPadrao,
      taxaMaisComum: known.taxaIva,
      percentagemIvaRecuperavel: known.percentagemIvaRecuperavel,
      ivaVariavel: known.ivaVariavel,
      combustivelTipo: known.combustivelTipo,
      seedKey: known.seedKey,
    });
  }, [empresaFornecedores, form.fornecedorId, form.fornecedorNome, fornecedorQuery]);

  const ivaPreview = useMemo(() => previewIvaFromForm({
    ...form,
    temIva: form.temIva,
    valorBaseTipo: form.valorBaseTipo || 'com_iva',
  }), [form]);
  const ivaSnapshot = useMemo(() => {
    try {
      return buildIvaSnapshotFromForm(form, {
        veiculo: selectedVeiculo,
        regras: empresaIvaRegras,
        fornecedor: fornecedorRegra,
      });
    } catch {
      return emptyIvaPersistFields();
    }
  }, [form, selectedVeiculo, empresaIvaRegras, fornecedorRegra]);
  const previewIva = (value) => (value == null ? null : applySinal(value, form));
  const faturasRelacionaveis = useMemo(
    () =>
      listFaturasRelacionaveis(gastosEmpresa, {
        fornecedorId: form.fornecedorId,
        fornecedorNome: form.fornecedorNome || fornecedorQuery,
        excludeId: gasto?.id,
      }),
    [gastosEmpresa, form.fornecedorId, form.fornecedorNome, fornecedorQuery, gasto?.id]
  );
  const regraPreview = useMemo(() => {
    try {
      return getVatRule({
        regras: empresaIvaRegras,
        categoria: form.categoria,
        veiculo: selectedVeiculo,
        faturaEmNomeEmpresa: form.faturaEmNomeEmpresa,
        temIva: form.temIva === 'sim',
        fornecedor: fornecedorRegra,
        tipoDespesa: form.tipoDespesa || form.descricao || '',
      });
    } catch {
      return {
        percentagemDedutivel: null,
        origem: 'por_determinar',
        regra: null,
        observacao: '',
      };
    }
  }, [empresaIvaRegras, form.categoria, form.faturaEmNomeEmpresa, form.temIva, form.tipoDespesa, form.descricao, selectedVeiculo, fornecedorRegra]);

  const veiculosAtivos = (empresaVeiculos || []).filter((item) => item && item.ativo !== false);
  const fornecedorSugestoes = suggestFornecedores(empresaFornecedores, fornecedorQuery);
  const temIva = form.temIva === 'sim';

  const veiculoSelect = layoutTemCampo(layout, 'veiculo') ? (
    <FormGroup
      label="Veículo"
      hint={layout.veiculoHint || 'Opcional'}
      required={layout.veiculoObrigatorio}
      error={errors.veiculoId}
      help={
        tipoRapido === 'combustivel'
          ? HELP.gasto.combustivel
          : tipoRapido === 'carregamento'
            ? HELP.viatura.carregamento
            : tipoRapido === 'via_verde'
              ? HELP.viatura.viaVerde
              : HELP.viatura.associar
      }
    >
      <Select name="veiculoId" value={form.veiculoId} onChange={handleChange}>
        <option value="">{layout.veiculoGeral ? 'Geral / Por conferir' : 'Nenhum'}</option>
        {veiculosAtivos.map((veiculo) => (
          <option key={veiculo.id} value={veiculo.id}>
            {veiculo.nome}
            {veiculo.modelo ? ` · ${veiculo.modelo}` : ''}
            {veiculo.propriedadeEmpresa === false ? ' (uso da empresa)' : ''}
          </option>
        ))}
      </Select>
      {combustivelLabel ? (
        <p className={styles.recorrenteHint}>
          {selectedVeiculo?.modelo ? `${selectedVeiculo.modelo} · ` : ''}
          {combustivelLabel}
          {selectedVeiculo?.combustivel === VEICULO_COMBUSTIVEL.ELETRICO
            ? isCategoriaCarregamento(form.categoria)
              ? ' · Carregamento / Eletricidade'
              : ' / Carregamento'
            : ''}
        </p>
      ) : null}
    </FormGroup>
  ) : null;

  const obraSelect = layoutTemCampo(layout, 'obra') ? (
    <FormGroup label="Obra" hint={layout.obraHint || 'Opcional'}>
      <Select name="obraId" value={form.obraId} onChange={handleChange}>
        <option value="">Nenhuma</option>
        {sortObrasForDisplay(obras).map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nome}
            </option>
          ))}
      </Select>
    </FormGroup>
  ) : null;

  const handleConfirmDelete = () => {
    if (!gasto?.id || !onDelete) return;
    onDelete(gasto.id);
  };

  if (confirmDelete && isEdit && gasto?.id) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => setConfirmDelete(false)}
        title="Tem certeza que deseja apagar este gasto?"
        footer={
          <div className={styles.footerBar}>
            <Button variant="secondary" type="button" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" type="button" onClick={handleConfirmDelete}>
              Apagar
            </Button>
          </div>
        }
      >
        <div className={styles.confirmDetails}>
          {[
            ['Fornecedor', getGastoEmpresaFornecedorLabel(gasto)],
            ['Data', gasto.data ? formatDate(gasto.data) : '—'],
            ['Valor', formatCurrency(getGastoEmpresaValor(gasto))],
          ].map(([label, value]) => (
            <div key={label} className={styles.confirmRow}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      footer={
        <div className={styles.footerBar}>
          {isEdit && onDelete && gasto?.id ? (
            <Button
              type="button"
              variant="danger"
              className={styles.apagarBtn}
              onClick={() => setConfirmDelete(true)}
            >
              Apagar gasto
            </Button>
          ) : null}
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form={`gasto-empresa-form-${mode}`} disabled={!form.categoria}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id={`gasto-empresa-form-${mode}`} onSubmit={handleSubmit} noValidate>
        {Object.values(errors).some(Boolean) ? (
          <p className={styles.avisoDuplicado} role="alert">
            Não foi possível guardar. Verifique os campos obrigatórios assinalados.
          </p>
        ) : null}
        <FormRow>
          <FormGroup label="Data" required error={errors.data}>
            <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
          </FormGroup>
          <FormGroup label="Valor (€)" required error={errors.valor}>
            <Input
              name="valor"
              type="number"
              step="0.01"
              min="0.01"
              value={form.valor}
              onChange={handleChange}
              error={errors.valor}
              placeholder="Ex.: 75"
              inputMode="decimal"
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Descrição">
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            placeholder="Ex.: Luz da garagem"
          />
        </FormGroup>
        <FormGroup label="Categoria" required error={errors.categoria}>
          <Input
            value={pesquisaCategoria}
            onChange={(e) => setPesquisaCategoria(e.target.value)}
            placeholder="Pesquisar categoria..."
            autoComplete="off"
          />
          {form.categoria ? (
            <p className={styles.recorrenteHint}>Seleccionada: {form.categoria}</p>
          ) : (
            <p className={styles.recorrenteHint}>Escreva, por exemplo, luz, seguro, garagem ou imposto.</p>
          )}
          {pesquisaCategoria.trim() ? (
            categoriasFiltradas.length === 0 ? (
              <p className={styles.recorrenteHint}>
                Nenhuma categoria com esse nome. Pode usar Outras despesas da empresa e explicar na descrição.
              </p>
            ) : (
              <ul className={styles.suggestList}>
                {categoriasFiltradas.map((grupo) => (
                  <li key={grupo.grupo}>
                    <span className={styles.categoriaGrupo}>{grupo.grupo}</span>
                    <ul>
                      {grupo.categorias.map((nome) => (
                        <li key={nome}>
                          <button type="button" onClick={() => handlePickCategoria(nome)}>
                            {nome}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </FormGroup>

        <details className={styles.maisOpcoes}>
          <summary>Atalhos habituais</summary>
          <div className={styles.tipoGrid} role="group" aria-label="Tipo de gasto">
            {TIPOS_GASTO_RAPIDOS.map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                className={`${styles.tipoChip} ${tipoRapido === tipo.id ? styles.tipoChipActive : ''}`}
                onClick={() => handleSelectTipo(tipo)}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </details>

        {form.categoria ? (
          <>
            {sugestaoHint ? <p className={styles.recorrenteHint}>{sugestaoHint}</p> : null}

            <GastoTipoDocumentoFields
              form={form}
              onChange={handleChange}
              faturasRelacionaveis={faturasRelacionaveis}
              mostrarDetalhesNc={false}
            />

            <FormGroup label="Fornecedor" help={HELP.iva.regraFornecedor}>
              <Input
                value={fornecedorQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setFornecedorQuery(value);
                  setShowFornecedorList(true);
                  setForm((prev) => {
                    const actual = prev.fornecedorId
                      ? empresaFornecedores.find((item) => item?.id === prev.fornecedorId)
                      : null;
                    const stillSame = actual && findFornecedorByNome([actual], value);
                    return {
                      ...prev,
                      fornecedorNome: value,
                      fornecedorId: stillSame ? prev.fornecedorId : '',
                    };
                  });
                }}
                onFocus={() => setShowFornecedorList(true)}
                onBlur={() => {
                  window.setTimeout(() => {
                    setShowFornecedorList(false);
                    reconhecerFornecedor(fornecedorQuery);
                  }, 120);
                }}
                placeholder="Procurar ou escrever o nome"
                autoComplete="off"
              />
              {showFornecedorList && fornecedorSugestoes.length > 0 ? (
                <ul className={styles.suggestList}>
                  {fornecedorSugestoes.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectFornecedor(item)}
                      >
                        {item.nome}
                        {item.categoriaPadrao ? ` · ${item.categoriaPadrao}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </FormGroup>

            {podeSalvarFornecedorRegra(form.fornecedorNome || fornecedorQuery) ? (
              <div className={ivaStyles.radioOption}>
                <label className={ivaStyles.radioOption} style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.salvarFornecedor === 'sim'}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        salvarFornecedor: e.target.checked ? 'sim' : 'nao',
                      }))
                    }
                  />
                  Salvar fornecedor para próximas faturas
                </label>
                <HelpTip text={HELP.iva.salvarFornecedor} />
              </div>
            ) : null}

            <GastoTipoDocumentoFields
              form={form}
              onChange={handleChange}
              faturasRelacionaveis={faturasRelacionaveis}
              mostrarTipo={false}
            />

            {layoutTemCampo(layout, 'veiculo') ? veiculoSelect : null}
            {layoutTemCampo(layout, 'local') ? (
              <FormGroup label="Local" hint="Opcional. A categoria continua a ser o tipo de gasto.">
                <Input
                  name="local"
                  value={form.local}
                  onChange={handleChange}
                  placeholder="Ex.: Garagem"
                  list="gastos-empresa-locais"
                  autoComplete="off"
                />
                <datalist id="gastos-empresa-locais">
                  {locaisConhecidos.map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
              </FormGroup>
            ) : null}

            <FormGroup label="Tem IVA?" required error={errors.temIva}>
              <div className={ivaStyles.radioGroup} role="radiogroup" aria-label="Tem IVA?">
                <label className={ivaStyles.radioOption}>
                  <input type="radio" name="temIva" value="sim" checked={form.temIva === 'sim'} onChange={handleChange} />
                  Sim
                </label>
                <label className={ivaStyles.radioOption}>
                  <input type="radio" name="temIva" value="nao" checked={form.temIva === 'nao'} onChange={handleChange} />
                  Não
                </label>
              </div>
            </FormGroup>

            {form.temIva === 'nao' ? (
              <p className={styles.recorrenteHint}>O valor informado é o total do gasto. Sem cálculo de IVA.</p>
            ) : null}

            {temIva ? (
              <>
                {(layoutTemCampo(layout, 'faturaEmpresa') || isCategoriaMaterial(form.categoria)) && (
                  <FormGroup label="Fatura em nome da empresa?">
                    <div className={ivaStyles.radioGroup} role="radiogroup" aria-label="Fatura da empresa">
                      <label className={ivaStyles.radioOption}>
                        <input
                          type="radio"
                          name="faturaEmNomeEmpresa"
                          value="sim"
                          checked={form.faturaEmNomeEmpresa === 'sim'}
                          onChange={handleChange}
                        />
                        Sim
                      </label>
                      <label className={ivaStyles.radioOption}>
                        <input
                          type="radio"
                          name="faturaEmNomeEmpresa"
                          value="nao"
                          checked={form.faturaEmNomeEmpresa === 'nao'}
                          onChange={handleChange}
                        />
                        Não
                      </label>
                    </div>
                  </FormGroup>
                )}

                {form.faturaMultiplasTaxas === 'sim' || fornecedorRegra?.ivaVariavel ? (
                  <div className={styles.ivaLinhasBox}>
                    <p className={styles.recorrenteHint}>
                      {fornecedorRegra?.ivaVariavel
                        ? 'Esta fatura pode ter várias taxas. Não aplicar 23% sobre o total. Informe cada linha.'
                        : 'Adicione as taxas reais da fatura.'}
                    </p>
                    {(form.ivaLinhas || []).map((linha) => (
                      <div key={linha.id} className={styles.ivaLinhaRow}>
                        <FormGroup label="Base sem IVA (€)">
                          <Input
                            type="number"
                            step="0.01"
                            value={linha.valorBase}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                faturaMultiplasTaxas: 'sim',
                                ivaLinhas: (prev.ivaLinhas || []).map((item) =>
                                  item.id === linha.id ? { ...item, valorBase: e.target.value } : item
                                ),
                              }))
                            }
                          />
                        </FormGroup>
                        <FormGroup label="Taxa (%)">
                          <Input
                            type="number"
                            step="0.01"
                            value={linha.taxaIva}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                faturaMultiplasTaxas: 'sim',
                                ivaLinhas: (prev.ivaLinhas || []).map((item) =>
                                  item.id === linha.id ? { ...item, taxaIva: e.target.value } : item
                                ),
                              }))
                            }
                          />
                        </FormGroup>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              ivaLinhas: (prev.ivaLinhas || []).filter((item) => item.id !== linha.id),
                            }))
                          }
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          faturaMultiplasTaxas: 'sim',
                          ivaLinhas: [...(prev.ivaLinhas || []), { id: generateId(), valorBase: '', taxaIva: '' }],
                        }))
                      }
                    >
                      Adicionar taxa
                    </Button>
                  </div>
                ) : null}

                <FormRow>
                    <FormGroup
                      label="Taxa de IVA da fatura"
                      required={form.faturaMultiplasTaxas !== 'sim'}
                      error={errors.taxaIvaPreset}
                      help={HELP.iva.taxa}
                    >
                      <Select name="taxaIvaPreset" value={form.taxaIvaPreset} onChange={handleChange} error={errors.taxaIvaPreset}>
                        <option value="">Seleccionar</option>
                        {IVA_TAXA_PRESETS.map((taxa) => (
                          <option key={taxa.id} value={taxa.id}>
                            {taxa.label}
                          </option>
                        ))}
                      </Select>
                    </FormGroup>
                    {form.taxaIvaPreset === 'outra' ? (
                      <FormGroup label="Taxa (%)" error={errors.taxaIvaOutra}>
                        <Input name="taxaIvaOutra" type="number" step="0.01" value={form.taxaIvaOutra} onChange={handleChange} />
                      </FormGroup>
                    ) : null}
                  </FormRow>

                <div className={styles.ivaResumo}>
                  <div><span>Fornecedor</span><strong>{form.fornecedorNome || fornecedorQuery || '—'}</strong></div>
                  <FormGroup label="Categoria" error={errors.categoria}>
                    <Select name="categoria" value={form.categoria} onChange={handleChange} error={errors.categoria}>
                      <option value="">Seleccionar</option>
                      {gruposCategoria.map((grupo) => (
                        <optgroup key={grupo.grupo} label={grupo.grupo}>
                          {grupo.categorias.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </FormGroup>
                  <FormGroup label="Tipo">
                    <Input
                      name="tipoDespesa"
                      value={form.tipoDespesa}
                      onChange={handleChange}
                      placeholder={tipoRapido === 'carregamento' ? 'Ex.: Carregamento' : 'Ex.: Gasóleo simples'}
                    />
                  </FormGroup>
                  <div>
                    <span>Valor sem IVA</span>
                    <strong>{ivaSnapshot.valorSemIva != null ? formatCurrency(previewIva(ivaSnapshot.valorSemIva)) : '—'}</strong>
                  </div>
                  <div>
                    <span>IVA da fatura</span>
                    <strong>
                      {ivaSnapshot.valorIva != null ? formatCurrency(previewIva(ivaSnapshot.valorIva)) : '—'}
                      {ivaSnapshot.taxaIva != null ? ` (${formatTaxaIva(ivaSnapshot.taxaIva)})` : ''}
                    </strong>
                  </div>
                  <FormGroup
                    label="% de IVA recuperável"
                    help={HELP.iva.dedutivel}
                    hint={HELP.iva.alteracaoManual}
                    error={errors.percentagemDedutivel}
                  >
                    <Input
                      name="percentagemDedutivel"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={
                        form.ivaManual === 'sim' || form.percentagemDedutivel !== ''
                          ? form.percentagemDedutivel
                          : ivaSnapshot.percentagemDedutivel != null
                            ? String(ivaSnapshot.percentagemDedutivel)
                            : form.percentagemDedutivel
                      }
                      onChange={handleChange}
                      placeholder="Ex.: 50"
                    />
                  </FormGroup>
                  <div>
                    <span>IVA recuperável</span>
                    <strong>
                      {ivaSnapshot.ivaDedutivelValor != null ? formatCurrency(previewIva(ivaSnapshot.ivaDedutivelValor)) : '—'}
                    </strong>
                  </div>
                  <div>
                    <span>IVA não recuperável</span>
                    <strong>
                      {ivaSnapshot.ivaNaoDedutivelValor != null
                        ? formatCurrency(previewIva(ivaSnapshot.ivaNaoDedutivelValor))
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span>Total da fatura</span>
                    <strong>{ivaSnapshot.valorComIva != null ? formatCurrency(previewIva(ivaSnapshot.valorComIva)) : '—'}</strong>
                  </div>
                  {ivaSnapshot.percentagemDedutivel === 50 && ivaSnapshot.taxaIva === 23 ? (
                    <p>
                      A taxa da fatura é 23%. Recupera-se 50% desse IVA, não uma taxa de 11,5%.
                    </p>
                  ) : ivaSnapshot.regraIvaOrigem ? (
                    <p>{IVA_REGRA_ORIGEM_LABELS[ivaSnapshot.regraIvaOrigem]}{ivaSnapshot.regraIvaObservacao ? ` — ${ivaSnapshot.regraIvaObservacao}` : ''}</p>
                  ) : (
                    <p>Dedutibilidade: por determinar. Pode indicar a percentagem acima.</p>
                  )}
                </div>
              </>
            ) : null}

            {viaVerde && layoutTemCampo(layout, 'viaVerdeEstado') && !form.veiculoId ? (
              <FormGroup
                label="Estado da distribuição"
                hint="A distribuição não cria um novo gasto."
                help={HELP.viatura.viaVerde}
              >
                {viaVerdeConferida ? (
                  <p className={styles.recorrenteHint}>Distribuição conferida. Altere em Distribuir.</p>
                ) : (
                  <div className={ivaStyles.radioGroup} role="radiogroup" aria-label="Via Verde">
                    <label className={ivaStyles.radioOption}>
                      <input
                        type="radio"
                        name="viaVerdeModo"
                        value={VIA_VERDE_STATUS.POR_CONFERIR}
                        checked={form.viaVerdeModo !== VIA_VERDE_STATUS.GERAL}
                        onChange={handleChange}
                      />
                      Por conferir
                    </label>
                    <label className={ivaStyles.radioOption}>
                      <input
                        type="radio"
                        name="viaVerdeModo"
                        value={VIA_VERDE_STATUS.GERAL}
                        checked={form.viaVerdeModo === VIA_VERDE_STATUS.GERAL}
                        onChange={handleChange}
                      />
                      Via Verde — Geral
                    </label>
                  </div>
                )}
              </FormGroup>
            ) : null}

            {obraSelect}
            {layoutTemCampo(layout, 'servico') ? (
              <ServicoAbatimentoSelect
                obras={obras}
                obraId={form.obraId}
                value={form.intervencaoId}
                onChange={handleChange}
              />
            ) : null}

            {form.tipoDocumento !== TIPO_DOCUMENTO.NOTA_CREDITO ? (
              <FormGroup label="Nº da fatura">
                <Input name="numeroFatura" value={form.numeroFatura} onChange={handleChange} />
              </FormGroup>
            ) : null}

            <FormGroup label="Anexar fatura">
              <input type="file" accept="image/*,application/pdf" onChange={handleAnexo} />
              {(form.anexos || []).length > 0 ? (
                <ul className={styles.anexoList}>
                  {form.anexos.map((item) => (
                    <li key={item.id}>
                      📎 {item.nome}
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            anexos: (prev.anexos || []).filter((anexo) => anexo.id !== item.id),
                          }))
                        }
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.recorrenteHint}>Fotografia ou PDF. Fica ligado a este gasto.</p>
              )}
            </FormGroup>

            {layoutTemCampo(layout, 'observacao') ? (
              <FormGroup label={tipoRapido === 'manutencao' ? 'Descrição' : 'Observação'}>
                <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
              </FormGroup>
            ) : null}

            {avisoDuplicado ? (
              <p className={styles.avisoDuplicado}>
                Possível gasto duplicado (mesmo fornecedor, nº de fatura e valor). Confirme Guardar
                outra vez se forem registos diferentes.
              </p>
            ) : null}

            {isEdit && viaVerde && onDistribuir ? (
              <div className={styles.veiculoActionsWrap}>
                <Button type="button" variant="secondary" onClick={onDistribuir}>
                  Distribuir por veículos
                </Button>
              </div>
            ) : null}

            <details className={styles.maisOpcoes}>
              <summary>Mais detalhes / informações fiscais</summary>
              <FormGroup label="Estado do documento">
                <Select name="documentoStatus" value={form.documentoStatus} onChange={handleChange}>
                  {Object.entries(DOCUMENTO_STATUS_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              {temIva ? (
                <>
                  <FormGroup label="O valor informado é" error={errors.valorBaseTipo}>
                    <Select name="valorBaseTipo" value={form.valorBaseTipo || 'com_iva'} onChange={handleChange}>
                      <option value="com_iva">Com IVA (total da fatura)</option>
                      <option value="sem_iva">Sem IVA (base tributável)</option>
                    </Select>
                  </FormGroup>
                  <FormRow>
                    <FormGroup label="Taxa da fatura" required error={errors.taxaIvaPreset} help={HELP.iva.taxa}>
                      <Select name="taxaIvaPreset" value={form.taxaIvaPreset} onChange={handleChange} error={errors.taxaIvaPreset}>
                        <option value="">Seleccionar</option>
                        {IVA_TAXA_PRESETS.map((taxa) => (
                          <option key={taxa.id} value={taxa.id}>
                            {taxa.label}
                          </option>
                        ))}
                      </Select>
                    </FormGroup>
                    {form.taxaIvaPreset === 'outra' ? (
                      <FormGroup label="Taxa (%)" error={errors.taxaIvaOutra}>
                        <Input name="taxaIvaOutra" type="number" step="0.01" value={form.taxaIvaOutra} onChange={handleChange} />
                      </FormGroup>
                    ) : null}
                  </FormRow>
                  {ivaPreview && form.faturaMultiplasTaxas !== 'sim' ? (
                    <p className={styles.recorrenteHint}>
                      Base {formatCurrency(ivaPreview.valorSemIva)} · IVA {formatCurrency(ivaPreview.valorIva)} (
                      {formatTaxaIva(ivaPreview.taxaPercent)})
                    </p>
                  ) : null}
                  <FormGroup label="Alterar regra fiscal">
                    <div className={ivaStyles.radioGroup}>
                      <label className={ivaStyles.radioOption}>
                        <input
                          type="radio"
                          name="ivaManual"
                          value="nao"
                          checked={form.ivaManual !== 'sim'}
                          onChange={handleChange}
                        />
                        Usar regra automática
                        {regraPreview.percentagemDedutivel != null
                          ? ` (${regraPreview.percentagemDedutivel}%)`
                          : regraPreview.origem === 'por_determinar'
                            ? ' (por determinar)'
                            : ''}
                      </label>
                      <label className={ivaStyles.radioOption}>
                        <input
                          type="radio"
                          name="ivaManual"
                          value="sim"
                          checked={form.ivaManual === 'sim'}
                          onChange={handleChange}
                        />
                        Definir manualmente
                      </label>
                    </div>
                  </FormGroup>
                  {form.ivaManual === 'sim' ? (
                    <>
                      <FormGroup
                        label="Percentagem dedutível (%)"
                        error={errors.percentagemDedutivel}
                        help={HELP.iva.dedutivel}
                      >
                        <Input
                          name="percentagemDedutivel"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={form.percentagemDedutivel}
                          onChange={handleChange}
                        />
                      </FormGroup>
                      <FormGroup label="Justificação (opcional)">
                        <Input
                          name="regraIvaObservacao"
                          value={form.regraIvaObservacao}
                          onChange={handleChange}
                          placeholder="Ex.: Confirmado pelo contabilista"
                        />
                      </FormGroup>
                    </>
                  ) : null}
                  <FormGroup label="Fatura com múltiplas taxas">
                    <div className={ivaStyles.radioGroup}>
                      <label className={ivaStyles.radioOption}>
                        <input
                          type="radio"
                          name="faturaMultiplasTaxas"
                          value="nao"
                          checked={form.faturaMultiplasTaxas !== 'sim'}
                          onChange={handleChange}
                        />
                        Não
                      </label>
                      <label className={ivaStyles.radioOption}>
                        <input
                          type="radio"
                          name="faturaMultiplasTaxas"
                          value="sim"
                          checked={form.faturaMultiplasTaxas === 'sim'}
                          onChange={handleChange}
                        />
                        Sim
                      </label>
                    </div>
                    {form.faturaMultiplasTaxas === 'sim' ? (
                      <p className={styles.recorrenteHint}>
                        As linhas de taxa estão no resumo de IVA acima. Alterar aqui não muda a regra global do fornecedor.
                      </p>
                    ) : null}
                  </FormGroup>
                </>
              ) : null}
              <FormGroup label="Forma de pagamento">
                <Select name="formaPagamento" value={form.formaPagamento} onChange={handleChange}>
                  {METODOS_PAGAMENTO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              <FormRow>
                <FormGroup label="Estado financeiro" required error={errors.estado}>
                  <Select name="estado" value={form.estado} onChange={handleChange} error={errors.estado}>
                    {GASTO_EMPRESA_ESTADOS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
                {form.estado === 'pago' && (
                  <FormGroup label="Data do pagamento" error={errors.dataPagamento}>
                    <Input
                      name="dataPagamento"
                      type="date"
                      value={form.dataPagamento}
                      onChange={handleChange}
                      error={errors.dataPagamento}
                    />
                  </FormGroup>
                )}
              </FormRow>
            </details>

            {isEdit && (gasto?.historicoAlteracoes || []).length > 0 ? (
              <details className={styles.maisOpcoes}>
                <summary>Alterações recentes</summary>
                <ul className={styles.historicoList}>
                  {[...(gasto.historicoAlteracoes || [])].reverse().slice(0, 8).map((entrada, index) => (
                    <li key={`${entrada.em || 'alt'}-${index}`} className={styles.historicoItem}>
                      <span className={styles.historicoQuando}>{formatDateTime(entrada.em)}</span>
                      {(entrada.alteracoes || []).map((alt) => (
                        <p key={`${alt.campo}-${alt.de}-${alt.para}`}>
                          <strong>{alt.label || alt.campo}:</strong>{' '}
                          {formatGastoEmpresaHistoricoValor(alt.campo, alt.de, {
                            obras,
                            veiculos: empresaVeiculos,
                          })}{' '}
                          →{' '}
                          {formatGastoEmpresaHistoricoValor(alt.campo, alt.para, {
                            obras,
                            veiculos: empresaVeiculos,
                          })}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

          </>
        ) : (
          <p className={styles.recorrenteHint}>
            Escolha a categoria para ver fornecedor, local, veículo ou IVA, só quando fizerem falta.
          </p>
        )}
      </form>
    </Modal>
  );
}
