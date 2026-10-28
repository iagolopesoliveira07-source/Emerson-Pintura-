import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../Form/Form';
import { useApp } from '../../context/AppContext';
import { OBRA_STATUS } from '../../utils/obraStatus';
import {
  EMPTY_OBRA_FORM,
  obraToForm,
  validateObraForm,
  isObraFormDirty,
} from '../../utils/obraForm';
import { OBRA_IVA_TAXAS, previewObraIvaFromForm, formatTaxaIva, isObraIvaDefinido } from '../../utils/obraIva';
import { isLodgingOffsetObra, isPrepaidCreditObra, TIPO_OBRA, TIPO_OBRA_OPTIONS } from '../../utils/obraSpecial';
import { getParceiroFuncionarios } from '../../utils/funcionarioTipo';
import { formatCurrency } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import ivaStyles from '../GastoForm/GastoForm.module.css';

export default function ObraFormModal({
  isOpen,
  onClose,
  mode = 'create',
  obra = null,
  onSubmit,
}) {
  const { funcionarios = [] } = useApp();
  const [form, setForm] = useState(EMPTY_OBRA_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_OBRA_FORM);
  const [errors, setErrors] = useState({});

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Editar obra' : 'Nova obra';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Guardar obra';

  useEffect(() => {
    if (!isOpen) return;

    const initial = isEdit && obra ? obraToForm(obra) : EMPTY_OBRA_FORM;
    setForm(initial);
    setInitialForm(initial);
    setErrors({});
  }, [isOpen, isEdit, obra]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'estado' && value !== 'Pausada') {
        next.motivoPausa = '';
      }
      if (name === 'ivaObra' && value !== 'sim') {
        next.taxaIva = '';
      }
      if (name === 'tipoObra') {
        next.parceriaObra = value === 'parceria' ? 'sim' : 'nao';
        if (value === 'parceria' && !next.parceiroNome) next.parceiroNome = 'Fábio';
      }
      if (name === 'creditoPrePago' && value !== 'sim') {
        next.creditoInicial = '';
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const ivaPreview = previewObraIvaFromForm(form);
  const tipoObra = form.tipoObra || TIPO_OBRA.NORMAL;
  const isTavira = tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA;
  const isParceria = tipoObra === TIPO_OBRA.PARCERIA;
  const isCredito = tipoObra === TIPO_OBRA.CREDITO;
  const parceirosDisponiveis = getParceiroFuncionarios(funcionarios);
  const showPrepaid = isEdit && obra && isPrepaidCreditObra(obra);
  const valorLabel = isCredito
    ? 'Valor acordado / previsto (€)'
    : form.ivaObra === 'sim'
      ? 'Valor contratado (sem IVA) (€)'
      : 'Valor contratado (€)';
  const obraAntigaSemIva = isEdit && obra && !isObraIvaDefinido(obra);

  const handleClose = () => {
    if (isObraFormDirty(form, initialForm)) {
      const confirmed = window.confirm('Tem certeza que deseja sair sem salvar as alterações?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateObraForm(form, {
      allowZeroValor: (isEdit && isLodgingOffsetObra(obra)) || form.creditoPrePago === 'sim' || isTavira || isCredito,
      existingObra: isEdit ? obra : null,
      funcionarios,
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form="obra-form">
            {submitLabel}
          </Button>
        </FormActions>
      }
    >
      <form id="obra-form" onSubmit={handleSubmit}>
        <FormGroup label="Nome da obra" required error={errors.nome}>
          <Input name="nome" value={form.nome} onChange={handleChange} error={errors.nome} />
        </FormGroup>
        <FormGroup label="Tipo de obra" required error={errors.tipoObra} help={isCredito ? HELP.obra.credito : undefined}>
          <Select name="tipoObra" value={tipoObra} onChange={handleChange} error={errors.tipoObra}>
            {TIPO_OBRA_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormGroup>
        {isTavira ? (
          <p className={ivaStyles.ivaHint}>
            Remodelação completa em troca de 1 ano de aluguel. Não é obrigatório um valor contratado
            em euros.
          </p>
        ) : null}
        <FormRow>
          {isTavira ? null : (
          <FormGroup label="Cliente" required={!isTavira} error={errors.cliente}>
            <Input name="cliente" value={form.cliente} onChange={handleChange} error={errors.cliente} />
          </FormGroup>
          )}
          <FormGroup label="Telefone" error={errors.telefone}>
            <Input name="telefone" value={form.telefone} onChange={handleChange} error={errors.telefone} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Morada">
          <Input name="morada" value={form.morada} onChange={handleChange} />
        </FormGroup>
        <FormRow>
          {isTavira ? (
            <div />
          ) : (
            <FormGroup
              label={valorLabel}
              required={!isCredito}
              error={errors.valorContratado}
              help={HELP.obra.valorOriginal}
            >
              <Input
                name="valorContratado"
                type="number"
                step="0.01"
                value={form.valorContratado}
                onChange={handleChange}
                error={errors.valorContratado}
              />
            </FormGroup>
          )}
          <FormGroup label="Status" required error={errors.estado}>
            <Select name="estado" value={form.estado} onChange={handleChange} error={errors.estado}>
              {OBRA_STATUS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        {!isTavira && (
        <section className={ivaStyles.ivaSection} aria-labelledby="obra-iva-title">
          <h3 id="obra-iva-title" className={ivaStyles.ivaTitle}>
            IVA
          </h3>
          <p className={ivaStyles.ivaHint}>
            A taxa fica registada nesta obra. Alterações futuras nas taxas padrão do sistema não
            mudam obras já guardadas.
          </p>
          {obraAntigaSemIva && (
            <p className={ivaStyles.ivaLegacyNote}>
              Esta obra antiga não tem IVA definido. Os valores atuais mantêm-se. Só serão
              calculados se escolher «Sim» e guardar.
            </p>
          )}
          <FormGroup label="Obra com IVA?" required error={errors.ivaObra}>
            <div className={ivaStyles.radioGroup} role="radiogroup" aria-label="Obra com IVA">
              <label className={ivaStyles.radioOption}>
                <input
                  type="radio"
                  name="ivaObra"
                  value="sim"
                  checked={form.ivaObra === 'sim'}
                  onChange={handleChange}
                />
                Sim
              </label>
              <label className={ivaStyles.radioOption}>
                <input
                  type="radio"
                  name="ivaObra"
                  value="nao"
                  checked={form.ivaObra === 'nao'}
                  onChange={handleChange}
                />
                Não
              </label>
            </div>
          </FormGroup>
          {form.ivaObra === 'sim' && (
            <>
              <FormGroup label="Taxa de IVA" required error={errors.taxaIva} help={HELP.iva.taxa}>
                <Select
                  name="taxaIva"
                  value={form.taxaIva}
                  onChange={handleChange}
                  error={errors.taxaIva}
                >
                  <option value="">Seleccionar taxa</option>
                  {OBRA_IVA_TAXAS.map((taxa) => (
                    <option key={taxa.id} value={taxa.value}>
                      {taxa.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              {ivaPreview && (
                <div className={ivaStyles.ivaPreview} aria-live="polite">
                  <div className={ivaStyles.ivaPreviewRow}>
                    <span>Valor sem IVA</span>
                    <strong>{formatCurrency(ivaPreview.valorSemIva)}</strong>
                  </div>
                  <div className={ivaStyles.ivaPreviewRow}>
                    <span>IVA {formatTaxaIva(ivaPreview.taxaPercent)}</span>
                    <strong>{formatCurrency(ivaPreview.valorIva)}</strong>
                  </div>
                  <div className={`${ivaStyles.ivaPreviewRow} ${ivaStyles.ivaPreviewTotal}`}>
                    <span>Total com IVA</span>
                    <strong>{formatCurrency(ivaPreview.valorComIva)}</strong>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
        )}
        {isParceria && (
        <section className={ivaStyles.ivaSection} aria-labelledby="obra-parceria-title">
          <h3 id="obra-parceria-title" className={ivaStyles.ivaTitle}>
            Parceria
          </h3>
          <p className={ivaStyles.ivaHint}>
            Juliano e Fábio são parceiros: as diárias deles servem só para controlo de presença (sem
            pagamento). A percentagem combina a divisão do lucro real da obra, depois dos gastos e da
            mão de obra dos funcionários. Deixe as percentagens vazias se ainda não estiverem
            combinadas.
          </p>
          <FormGroup label="Parceiro" required error={errors.parceiroNome}>
            <Select
              name="parceiroNome"
              value={form.parceiroNome}
              onChange={handleChange}
              error={errors.parceiroNome}
            >
              {parceirosDisponiveis.length === 0 ? (
                <option value={form.parceiroNome || 'Fábio'}>{form.parceiroNome || 'Fábio'}</option>
              ) : null}
              {parceirosDisponiveis.map((f) => (
                <option key={f.id} value={f.nome}>
                  {f.nome}
                </option>
              ))}
              {form.parceiroNome &&
              !parceirosDisponiveis.some((f) => f.nome === form.parceiroNome) ? (
                <option value={form.parceiroNome}>{form.parceiroNome}</option>
              ) : null}
            </Select>
          </FormGroup>
          <FormRow>
            <FormGroup label="Participação Emerson (%)" error={errors.percentagemEmpresa}>
              <Input
                name="percentagemEmpresa"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.percentagemEmpresa}
                onChange={handleChange}
                error={errors.percentagemEmpresa}
                placeholder="Não informada"
              />
            </FormGroup>
            <FormGroup label="Participação do parceiro (%)" error={errors.percentagemParceiro}>
              <Input
                name="percentagemParceiro"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.percentagemParceiro}
                onChange={handleChange}
                error={errors.percentagemParceiro}
                placeholder="Não informada"
              />
            </FormGroup>
          </FormRow>
        </section>
        )}
        {showPrepaid && (
        <section className={ivaStyles.ivaSection} aria-labelledby="obra-credito-title">
          <h3 id="obra-credito-title" className={ivaStyles.ivaTitle}>
            Crédito pré-pago
          </h3>
          <p className={ivaStyles.ivaHint}>
            O cliente entrega um valor antecipado que fica como crédito para pequenas
            intervenções. Os valores abatidos são sem IVA. Não cria uma obra nova para cada
            serviço.
          </p>
          <FormGroup label="Obra com crédito pré-pago?" required error={errors.creditoPrePago}>
            <div className={ivaStyles.radioGroup} role="radiogroup" aria-label="Obra com crédito pré-pago">
              <label className={ivaStyles.radioOption}>
                <input
                  type="radio"
                  name="creditoPrePago"
                  value="sim"
                  checked={form.creditoPrePago === 'sim'}
                  onChange={handleChange}
                />
                Sim
              </label>
              <label className={ivaStyles.radioOption}>
                <input
                  type="radio"
                  name="creditoPrePago"
                  value="nao"
                  checked={form.creditoPrePago !== 'sim'}
                  onChange={handleChange}
                />
                Não
              </label>
            </div>
          </FormGroup>
          {form.creditoPrePago === 'sim' && (
            <FormGroup label="Crédito inicial (sem IVA) (€)" required error={errors.creditoInicial}>
              <Input
                name="creditoInicial"
                type="number"
                step="0.01"
                min="0.01"
                value={form.creditoInicial}
                onChange={handleChange}
                error={errors.creditoInicial}
              />
            </FormGroup>
          )}
        </section>
        )}
        {form.estado === 'Pausada' && (
          <FormGroup label="Motivo da pausa">
            <Input
              name="motivoPausa"
              value={form.motivoPausa}
              onChange={handleChange}
              placeholder="Ex: Falta de material"
            />
          </FormGroup>
        )}
        <FormRow>
          <FormGroup label="Data de início" error={errors.dataInicio}>
            <Input
              name="dataInicio"
              type="date"
              value={form.dataInicio}
              onChange={handleChange}
              error={errors.dataInicio}
            />
          </FormGroup>
          <FormGroup label="Previsão de término (opcional)" error={errors.dataPrevistaTermino}>
            <Input
              name="dataPrevistaTermino"
              type="date"
              value={form.dataPrevistaTermino}
              onChange={handleChange}
              error={errors.dataPrevistaTermino}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Observações">
          <Textarea name="observacoes" value={form.observacoes} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
