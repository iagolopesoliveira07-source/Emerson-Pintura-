import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormActions, FormRow } from '../Form/Form';
import { getCategoriasComDadosExistentes } from '../../constants/gastoCategorias';
import {
  EMPTY_GASTO_FORM,
  gastoToForm,
  validateGastoForm,
  isGastoFormDirty,
  getEmptyGastoForm,
} from '../../utils/gastoForm';
import {
  hasIvaInfo,
  IVA_TAXA_PRESETS,
  formatTaxaIva,
  emptyIvaFormFields,
  isGastoFormComIva,
} from '../../utils/ivaCalculations';
import { formatCurrency } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import HelpTip, { HelpLabel } from '../HelpTip/HelpTip';
import { isPartnershipObra, GASTO_PAGADOR_OPCOES } from '../../utils/obraSpecial';
import {
  DESTINO_GASTO,
  destinoGastoSemObraLabel,
  destinoPrecisaViatura,
  resolveDestinoGastoSemObra,
} from '../../utils/gastoDestinoSemObra';
import { sortObrasForDisplay } from '../../utils/obraStatus';
import ServicoAbatimentoSelect from '../ObraDetalhes/ServicoAbatimentoSelect';
import { useApp } from '../../context/AppContext';
import { generateId } from '../../services/storageService';
import { buildIvaSnapshotFromForm } from '../../utils/empresaIvaRules';
import {
  suggestFornecedores,
  findFornecedorByNome,
  findFornecedorRegraConhecida,
  applyFornecedorRegraToForm,
  getFornecedorRegraFiscal,
  podeSalvarFornecedorRegra,
  resolveFornecedorParaPreenchimento,
} from '../../utils/empresaFornecedores';
import {
  TIPO_DOCUMENTO,
  applySinal,
  listFaturasRelacionaveis,
  aplicarFaturaOriginalAoForm,
} from '../../utils/gastoDocumentoTipo';
import GastoTipoDocumentoFields from './GastoTipoDocumentoFields';
import styles from './GastoForm.module.css';

export default function GastoFormModal({
  isOpen,
  onClose,
  mode = 'create',
  gasto = null,
  obras = [],
  gastos = [],
  fixedObraId = null,
  fixedIntervencaoId = null,
  onSubmit,
}) {
  const { empresaFornecedores = [], empresaIvaRegras = [], empresaVeiculos = [] } = useApp();
  const [form, setForm] = useState(EMPTY_GASTO_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_GASTO_FORM);
  const [errors, setErrors] = useState({});
  const [fornecedorQuery, setFornecedorQuery] = useState('');
  const [showFornecedorList, setShowFornecedorList] = useState(false);

  const isEdit = mode === 'edit';
  const isNotaCreditoForm = form.tipoDocumento === TIPO_DOCUMENTO.NOTA_CREDITO;
  const title = isEdit
    ? isNotaCreditoForm
      ? 'Editar nota de crédito'
      : 'Editar gasto'
    : isNotaCreditoForm
      ? 'Adicionar nota de crédito'
      : 'Adicionar gasto';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Guardar';
  const gastoAntigoSemIva = isEdit && gasto && !hasIvaInfo(gasto);
  const categoriasOpcoes = getCategoriasComDadosExistentes(gastos);

  useEffect(() => {
    if (!isOpen) return;

    const obraInicial =
      obras.find((item) => item.id === ((isEdit && gasto?.obraId) || fixedObraId)) || null;
    const initial =
      isEdit && gasto
        ? gastoToForm(gasto, obraInicial)
        : getEmptyGastoForm(fixedObraId ? { obraId: fixedObraId, ...(fixedIntervencaoId ? { intervencaoId: fixedIntervencaoId } : {}) } : {});

    setForm(initial);
    setInitialForm(initial);
    setErrors({});
    setFornecedorQuery(initial.fornecedorNome || initial.fornecedor || '');
    setShowFornecedorList(false);
  }, [isOpen, isEdit, gasto, fixedObraId, fixedIntervencaoId, obras]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'obraId' && value !== prev.obraId) {
        next.pagoPor = 'empresa';
        next.intervencaoId = '';
        next.destinoSemObra = '';
      }
      if (name === 'veiculoId') {
        const veiculo = empresaVeiculos.find((item) => item.id === value);
        next.veiculo = veiculo?.nome || veiculo?.matricula || '';
      }
      if (name === 'categoria' && !prev.obraId) {
        next.destinoSemObra = '';
      }
      if (name === 'temIva' && value === 'nao') {
        Object.assign(next, emptyIvaFormFields());
        next.temIva = 'nao';
        next.percentagemDedutivel = '';
        next.ivaManual = 'nao';
      }
      if (name === 'temIva' && value === 'sim') {
        if (!next.valorBaseTipo) next.valorBaseTipo = 'com_iva';
        if (!next.taxaIvaPreset && next.faturaMultiplasTaxas !== 'sim') next.taxaIvaPreset = '23';
      }
      if (name === 'percentagemDedutivel') next.ivaManual = 'sim';
      if (name === 'faturaMultiplasTaxas' && value === 'sim' && !(prev.ivaLinhas || []).length) {
        next.ivaLinhas = [{ id: generateId(), valorBase: '', taxaIva: '' }];
      }
      if (name === 'faturaOriginalId') {
        const fatura = gastos.find((item) => item.id === value);
        if (fatura) return aplicarFaturaOriginalAoForm(next, fatura);
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev, [name]: null };
      if (name === 'temIva' && value === 'nao') {
        next.valorBaseTipo = null;
        next.taxaIvaPreset = null;
        next.taxaIvaOutra = null;
        next.ivaDedutivel = null;
        if (prev.valor === 'Não foi possível calcular o IVA. Verifique o valor e a taxa.') {
          next.valor = null;
        }
      }
      return next;
    });
  };

  const aplicarFornecedor = (item) => {
    if (!item) return;
    setFornecedorQuery(item.nome);
    setShowFornecedorList(false);
    setForm((prev) => {
      const next = applyFornecedorRegraToForm(
        { ...prev, fornecedorNome: prev.fornecedorNome || prev.fornecedor },
        item
      );
      next.fornecedor = next.fornecedorNome;
      next.salvarFornecedor = 'nao';
      return next;
    });
  };

  const reconhecerFornecedor = (nome) => {
    const resolved = resolveFornecedorParaPreenchimento(empresaFornecedores, nome);
    if (!resolved) return;
    if (resolved.id && form.fornecedorId && resolved.id === form.fornecedorId) return;
    aplicarFornecedor(resolved);
  };

  const handleClose = () => {
    if (isGastoFormDirty(form, initialForm)) {
      const confirmed = window.confirm('Tem certeza que deseja sair sem salvar as alterações?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payloadForm = {
      ...form,
      fornecedor: (form.fornecedorNome || form.fornecedor || fornecedorQuery || '').trim(),
      fornecedorNome: (form.fornecedorNome || form.fornecedor || fornecedorQuery || '').trim(),
    };
    const validation = validateGastoForm(payloadForm);
    const obraSubmit = obras.find((item) => item.id === (payloadForm.obraId || fixedObraId)) || null;
    if (isPartnershipObra(obraSubmit)) {
      const pagador = payloadForm.pagoPor;
      if (pagador !== 'empresa' && pagador !== 'fabio' && pagador !== 'juliano' && pagador !== 'caixa') {
        setErrors({ ...validation.errors, pagoPor: 'Indique quem pagou este gasto.' });
        return;
      }
    }
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const destino = !isEdit && !payloadForm.obraId && !fixedObraId
      ? resolveDestinoGastoSemObra(payloadForm)
      : null;
    if (destino === DESTINO_GASTO.EMPRESA && destinoPrecisaViatura(payloadForm.categoria) && empresaVeiculos.length && !payloadForm.veiculoId) {
      setErrors({ ...validation.errors, veiculoId: 'Indique o veículo.' });
      return;
    }

    if (gastoAntigoSemIva && isIvaBeingAdded(payloadForm) && gasto) {
      const original = Number(gasto.valor);
      const typed = parseFloat(payloadForm.valor);
      if (Number.isFinite(original) && Number.isFinite(typed) && Math.abs(typed - original) > 0.001) {
        const confirmed = window.confirm(
          `O valor original deste gasto é ${formatCurrency(original)}. Confirma a alteração para ${formatCurrency(typed)}?`
        );
        if (!confirmed) return;
      }
    }

    onSubmit(payloadForm);
  };

  const categoriaOptions =
    form.categoria && !categoriasOpcoes.includes(form.categoria)
      ? [...categoriasOpcoes, form.categoria]
      : categoriasOpcoes;

  const fornecedorRegra = useMemo(() => {
    const existing =
      (form.fornecedorId && empresaFornecedores.find((item) => item.id === form.fornecedorId)) ||
      findFornecedorByNome(empresaFornecedores, form.fornecedorNome || form.fornecedor || fornecedorQuery);
    if (existing) return getFornecedorRegraFiscal(existing);
    const known = findFornecedorRegraConhecida(form.fornecedorNome || form.fornecedor || fornecedorQuery);
    if (!known) return null;
    return getFornecedorRegraFiscal({
      nome: form.fornecedorNome || form.fornecedor || fornecedorQuery,
      categoriaPadrao: known.categoriaPadrao,
      taxaMaisComum: known.taxaIva,
      percentagemIvaRecuperavel: known.percentagemIvaRecuperavel,
      ivaVariavel: known.ivaVariavel,
      seedKey: known.seedKey,
    });
  }, [empresaFornecedores, form.fornecedorId, form.fornecedorNome, form.fornecedor, fornecedorQuery]);

  const ivaSnapshot = useMemo(
    () => buildIvaSnapshotFromForm(form, { regras: empresaIvaRegras, fornecedor: fornecedorRegra }),
    [form, empresaIvaRegras, fornecedorRegra]
  );
  const previewIva = (value) => (value == null ? null : applySinal(value, form));
  const faturasRelacionaveis = useMemo(
    () =>
      listFaturasRelacionaveis(gastos, {
        fornecedorId: form.fornecedorId,
        fornecedorNome: form.fornecedorNome || form.fornecedor || fornecedorQuery,
        excludeId: gasto?.id,
      }),
    [gastos, form.fornecedorId, form.fornecedorNome, form.fornecedor, fornecedorQuery, gasto?.id]
  );
  const selectedObra = obras.find((obra) => obra.id === (form.obraId || fixedObraId)) || null;
  const isPartnership = isPartnershipObra(selectedObra);
  const destinoSemObra =
    !isEdit && !fixedObraId && !form.obraId ? resolveDestinoGastoSemObra(form) : null;
  const mostrarViatura =
    destinoSemObra === DESTINO_GASTO.EMPRESA && destinoPrecisaViatura(form.categoria);
  const fornecedorSugestoes = suggestFornecedores(empresaFornecedores, fornecedorQuery);

  const valorLabel = !isGastoFormComIva(form)
    ? isNotaCreditoForm
      ? 'Valor total da nota de crédito (€)'
      : 'Valor total do gasto (€)'
    : form.valorBaseTipo === 'sem_iva'
      ? 'Valor sem IVA (€)'
      : form.valorBaseTipo === 'com_iva'
        ? 'Valor com IVA (€)'
        : isNotaCreditoForm
          ? 'Valor da nota de crédito (€)'
          : 'Valor da fatura (€)';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="lg"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form="gasto-form">
            {submitLabel}
          </Button>
        </FormActions>
      }
    >
      <form id="gasto-form" onSubmit={handleSubmit}>
        <FormGroup label="Data" required error={errors.data}>
          <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
        </FormGroup>

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
                  ? empresaFornecedores.find((item) => item.id === prev.fornecedorId)
                  : null;
                const stillSame = actual && findFornecedorByNome([actual], value);
                return {
                  ...prev,
                  fornecedor: value,
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
                    onClick={() => aplicarFornecedor(item)}
                  >
                    {item.nome}
                    {item.categoriaPadrao ? ` · ${item.categoriaPadrao}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </FormGroup>

        {!podeSalvarFornecedorRegra(form.fornecedorNome || form.fornecedor || fornecedorQuery) ? null : (
          <div className={styles.radioOption}>
            <label className={styles.radioOption} style={{ margin: 0 }}>
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
        )}

        <GastoTipoDocumentoFields
          form={form}
          onChange={handleChange}
          faturasRelacionaveis={faturasRelacionaveis}
          mostrarTipo={false}
        />

        <FormGroup
          label="Tipo de gasto"
          required
          error={errors.categoria}
          help={form.categoria === 'Combustível' ? HELP.gasto.combustivel : undefined}
        >
          <Select name="categoria" value={form.categoria} onChange={handleChange} error={errors.categoria}>
            {categoriaOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Descrição" hint="Opcional. O que foi comprado ou gasto.">
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            placeholder='Ex.: Tintas e materiais para acabamento'
          />
        </FormGroup>

        <FormGroup
          label={valorLabel}
          required
          error={errors.valor}
          hint={
            isGastoFormComIva(form) && form.faturaMultiplasTaxas !== 'sim'
              ? isNotaCreditoForm
                ? 'Valor que tem na nota de crédito'
                : 'Valor que tem na fatura'
              : undefined
          }
        >
          <Input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            value={form.valor}
            onChange={handleChange}
            error={errors.valor}
          />
        </FormGroup>

        <section className={styles.ivaSection} aria-labelledby="iva-section-title">
          <h3 id="iva-section-title" className={styles.ivaTitle}>
            IVA
          </h3>

          {gastoAntigoSemIva && (
            <p className={styles.ivaLegacyNote}>
              Este gasto não tem IVA registado. Pode manter assim ou indicar que passou a ter IVA.
              O valor original ({gasto ? formatCurrency(gasto.valor) : '—'}) só é alterado se o
              modificar e confirmar.
            </p>
          )}

          <FormGroup label="Tem IVA?" required error={errors.temIva}>
            <div className={styles.radioGroup} role="radiogroup" aria-label="Tem IVA?">
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="temIva"
                  value="sim"
                  checked={form.temIva === 'sim'}
                  onChange={handleChange}
                />
                Sim
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="temIva"
                  value="nao"
                  checked={form.temIva === 'nao'}
                  onChange={handleChange}
                />
                Não
              </label>
            </div>
          </FormGroup>

          {form.temIva === 'nao' ? (
            <p className={styles.ivaHint}>O valor informado é o total do gasto. Sem cálculo de IVA.</p>
          ) : null}

          {isGastoFormComIva(form) ? (
            <>
              {form.faturaMultiplasTaxas === 'sim' || fornecedorRegra?.ivaVariavel ? (
                <div className={styles.ivaLinhasBox}>
                  <p className={styles.ivaHint}>
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
              ) : (
                <>
                  <FormGroup label="Tipo de valor" required error={errors.valorBaseTipo}>
                    <div className={styles.radioGroup} role="radiogroup" aria-label="Tipo de valor">
                      <label className={styles.radioOption}>
                        <input
                          type="radio"
                          name="valorBaseTipo"
                          value="sem_iva"
                          checked={form.valorBaseTipo === 'sem_iva'}
                          onChange={handleChange}
                        />
                        Valor sem IVA
                      </label>
                      <label className={styles.radioOption}>
                        <input
                          type="radio"
                          name="valorBaseTipo"
                          value="com_iva"
                          checked={form.valorBaseTipo === 'com_iva'}
                          onChange={handleChange}
                        />
                        Valor com IVA
                      </label>
                    </div>
                  </FormGroup>

                  <FormRow>
                    <FormGroup label="Taxa de IVA" required error={errors.taxaIvaPreset} help={HELP.iva.taxa}>
                      <Select
                        name="taxaIvaPreset"
                        value={form.taxaIvaPreset}
                        onChange={handleChange}
                        error={errors.taxaIvaPreset}
                      >
                        <option value="">Seleccionar taxa</option>
                        {IVA_TAXA_PRESETS.map((taxa) => (
                          <option key={taxa.id} value={taxa.id}>
                            {taxa.label}
                          </option>
                        ))}
                      </Select>
                    </FormGroup>

                    {form.taxaIvaPreset === 'outra' && (
                      <FormGroup label="Taxa personalizada (%)" required error={errors.taxaIvaOutra}>
                        <Input
                          name="taxaIvaOutra"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={form.taxaIvaOutra}
                          onChange={handleChange}
                          error={errors.taxaIvaOutra}
                          placeholder="Ex.: 5"
                        />
                      </FormGroup>
                    )}
                  </FormRow>
                </>
              )}

              <FormGroup
                label="% de IVA dedutível"
                help={HELP.iva.dedutivel}
                hint={HELP.iva.alteracaoManual}
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
                  placeholder="Ex.: 50 ou 100"
                />
              </FormGroup>

              {ivaSnapshot.valorIva != null ? (
                <div className={styles.ivaPreview} aria-live="polite">
                  <div className={styles.ivaPreviewRow}>
                    <span>Valor sem IVA</span>
                    <strong>{formatCurrency(previewIva(ivaSnapshot.valorSemIva))}</strong>
                  </div>
                  <div className={styles.ivaPreviewRow}>
                    <span>IVA {ivaSnapshot.taxaIva != null ? formatTaxaIva(ivaSnapshot.taxaIva) : ''}</span>
                    <strong>{formatCurrency(previewIva(ivaSnapshot.valorIva))}</strong>
                  </div>
                  <div className={styles.ivaPreviewRow}>
                    <HelpLabel text={HELP.iva.dedutivel}>IVA dedutível</HelpLabel>
                    <strong>
                      {ivaSnapshot.ivaDedutivelValor != null
                        ? formatCurrency(previewIva(ivaSnapshot.ivaDedutivelValor))
                        : '—'}
                    </strong>
                  </div>
                  <div className={styles.ivaPreviewRow}>
                    <HelpLabel text={HELP.iva.naoDedutivel}>IVA não dedutível</HelpLabel>
                    <strong>
                      {ivaSnapshot.ivaNaoDedutivelValor != null
                        ? formatCurrency(previewIva(ivaSnapshot.ivaNaoDedutivelValor))
                        : '—'}
                    </strong>
                  </div>
                  <div className={`${styles.ivaPreviewRow} ${styles.ivaPreviewTotal}`}>
                    <span>Total com IVA</span>
                    <strong>{formatCurrency(previewIva(ivaSnapshot.valorComIva))}</strong>
                  </div>
                  {ivaSnapshot.percentagemDedutivel === 50 && ivaSnapshot.taxaIva === 23 ? (
                    <p className={styles.ivaHint}>
                      A taxa da fatura é 23%. Recupera-se 50% desse IVA, não uma taxa de 11,5%.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        {!fixedObraId && (
          <FormGroup
            label="Obra"
            hint="Opcional. Sem obra, a classificação depende da categoria — pode alterar antes de guardar."
            help={HELP.gasto.semObra}
          >
            <Select name="obraId" value={form.obraId} onChange={handleChange}>
              <option value="">Sem obra específica</option>
              {sortObrasForDisplay(obras).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Select>
          </FormGroup>
        )}
        {destinoSemObra ? (
          <div className={styles.destinoBox}>
            <p className={styles.destinoTitle}>
              Este gasto será registrado em: {destinoGastoSemObraLabel(destinoSemObra)}
            </p>
            <div className={styles.radioGroup} role="radiogroup" aria-label="Classificação do gasto">
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="destinoSemObra"
                  value={DESTINO_GASTO.EMPRESA}
                  checked={destinoSemObra === DESTINO_GASTO.EMPRESA}
                  onChange={handleChange}
                />
                Gastos da Empresa
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="destinoSemObra"
                  value={DESTINO_GASTO.OBRA_SEM_ESPECIFICA}
                  checked={destinoSemObra === DESTINO_GASTO.OBRA_SEM_ESPECIFICA}
                  onChange={handleChange}
                />
                Gastos das Obras — Sem obra específica
              </label>
            </div>
          </div>
        ) : null}
        {mostrarViatura ? (
          <FormGroup label="Viatura" required={empresaVeiculos.length > 0} error={errors.veiculoId}>
            <Select name="veiculoId" value={form.veiculoId} onChange={handleChange} error={errors.veiculoId}>
              <option value="">Seleccione a viatura</option>
              {empresaVeiculos.map((veiculo) => (
                <option key={veiculo.id} value={veiculo.id}>
                  {veiculo.nome || veiculo.matricula || veiculo.id}
                </option>
              ))}
            </Select>
          </FormGroup>
        ) : null}
        {!fixedIntervencaoId && form.obraId ? (
          <ServicoAbatimentoSelect
            obras={obras}
            obraId={form.obraId || fixedObraId}
            value={form.intervencaoId}
            onChange={handleChange}
          />
        ) : null}

        {isPartnership && (
          <FormGroup
            label="Quem pagou?"
            required
            error={errors.pagoPor}
            hint={
              form.pagoPor === 'caixa'
                ? 'Custa à obra, mas não gera reembolso. O dinheiro sai do Caixa da Parceria.'
                : form.pagoPor === 'fabio' || form.pagoPor === 'juliano'
                ? 'Este gasto entra no custo e acerto da parceria, mas não nos gastos/IVA da Emerson Pinturas.'
                : 'Entra como custo da obra. Se Emerson pagou, segue as regras normais de IVA da empresa.'
            }
          >
            <div className={styles.radioGroup} role="radiogroup" aria-label="Quem pagou este gasto">
              {GASTO_PAGADOR_OPCOES.map((opcao) => (
                <label key={opcao.id} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="pagoPor"
                    value={opcao.id}
                    checked={form.pagoPor === opcao.id}
                    onChange={handleChange}
                  />
                  {opcao.label}
                </label>
              ))}
            </div>
          </FormGroup>
        )}

        <FormGroup label="Observações">
          <Textarea
            name="observacao"
            value={form.observacao}
            onChange={handleChange}
            placeholder="Informações extras (opcional)"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}

function isIvaBeingAdded(form) {
  return isGastoFormComIva(form) && Boolean(form.valorBaseTipo && (form.taxaIvaPreset || form.faturaMultiplasTaxas === 'sim'));
}
