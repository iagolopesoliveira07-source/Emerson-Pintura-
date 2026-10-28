import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormActions } from '../Form/Form';
import { formatCurrency } from '../../utils/formatters';
import { roundMoney } from '../../utils/ivaCalculations';
import { HELP } from '../../utils/helpTexts';
import {
  CONTROLE_CUSTOS,
  INTERVENCAO_STATUS,
  INTERVENCAO_STATUS_FORM,
  INTERVENCAO_STATUS_LABELS,
  canonicalIntervencaoStatus,
  createIntervencao,
  getSaldoAntesDaIntervencao,
  isIntervencaoAbatida,
  validateIntervencaoForm,
} from '../../utils/obraPrepaidCredit';
import ivaStyles from '../GastoForm/GastoForm.module.css';

const EMPTY_FORM = {
  descricao: '',
  observacoes: '',
  valorFinal: '',
  status: INTERVENCAO_STATUS.EM_ANDAMENTO,
};

export default function IntervencaoFormModal({
  isOpen,
  onClose,
  mode = 'create',
  intervencao = null,
  summary = null,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Editar serviço' : 'Novo serviço';

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      isEdit && intervencao
        ? {
            descricao: intervencao.descricao || '',
            observacoes: intervencao.observacoes || '',
            valorFinal: intervencao.valorFinal != null ? String(intervencao.valorFinal) : '',
            status: canonicalIntervencaoStatus(intervencao),
          }
        : { ...EMPTY_FORM }
    );
    setErrors({});
  }, [isOpen, isEdit, intervencao]);

  const saldoAntes = isEdit
    ? getSaldoAntesDaIntervencao(summary, intervencao?.id)
    : roundMoney(summary?.saldoDisponivel || 0);
  const valorNumerico = parseFloat(form.valorFinal);
  const valorDefinido = Number.isFinite(valorNumerico) && valorNumerico > 0 ? roundMoney(valorNumerico) : 0;
  const vaiAbater = canonicalIntervencaoStatus({ status: form.status }) === INTERVENCAO_STATUS.ABATIDO;
  const saldoDepois = vaiAbater ? roundMoney(saldoAntes - valorDefinido) : saldoAntes;
  const jaEstavaAbatido = isEdit && isIntervencaoAbatida(intervencao);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateIntervencaoForm({
      ...form,
      controleCustos: isEdit ? intervencao?.controleCustos : CONTROLE_CUSTOS.EM_REGISTO,
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit(
      createIntervencao({
        id: isEdit ? intervencao.id : undefined,
        descricao: form.descricao,
        observacoes: form.observacoes,
        valorFinal: form.valorFinal === '' ? null : form.valorFinal,
        controleCustos: isEdit
          ? intervencao.controleCustos || CONTROLE_CUSTOS.EM_REGISTO
          : CONTROLE_CUSTOS.EM_REGISTO,
        status: canonicalIntervencaoStatus({ status: form.status }),
        createdAt: isEdit ? intervencao.createdAt : undefined,
        seedKey: isEdit ? intervencao.seedKey : undefined,
        periodoInicio: isEdit ? intervencao.periodoInicio : null,
        periodoFim: isEdit ? intervencao.periodoFim : null,
        periodoLabel: isEdit ? intervencao.periodoLabel : '',
        data: isEdit ? intervencao.data : null,
      })
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="intervencao-form">
            {isEdit ? 'Salvar alterações' : 'Guardar serviço'}
          </Button>
        </FormActions>
      }
    >
      <form id="intervencao-form" onSubmit={handleSubmit}>
        <FormGroup label="Nome do serviço" required error={errors.descricao}>
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            error={errors.descricao}
            placeholder="Ex.: Emergência no quarto 214"
          />
        </FormGroup>
        <FormGroup label="Descrição" hint="Opcional">
          <Textarea
            name="observacoes"
            value={form.observacoes}
            onChange={handleChange}
            placeholder="Notas internas sobre este trabalho"
          />
        </FormGroup>
        <FormGroup
          label="Valor do serviço (€)"
          hint="Pode ficar em branco até saber o preço. Só reduz o crédito quando o status for Abatido no crédito."
          error={errors.valorFinal}
          help={HELP.obra.abatidoCredito}
        >
          <Input
            name="valorFinal"
            type="number"
            step="0.01"
            min="0.01"
            value={form.valorFinal}
            onChange={handleChange}
            error={errors.valorFinal}
            placeholder="Ainda sem valor"
          />
        </FormGroup>
        <section className={ivaStyles.ivaSection} aria-labelledby="servico-status-title">
          <h3 id="servico-status-title" className={ivaStyles.ivaTitle}>
            Status
          </h3>
          <div className={ivaStyles.radioGroup} role="radiogroup" aria-label="Status do serviço">
            {INTERVENCAO_STATUS_FORM.map((status) => (
              <label key={status} className={ivaStyles.radioOption}>
                <input
                  type="radio"
                  name="status"
                  value={status}
                  checked={form.status === status}
                  onChange={handleChange}
                />
                {INTERVENCAO_STATUS_LABELS[status]}
              </label>
            ))}
          </div>
        </section>
        {valorDefinido > 0 && vaiAbater ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {jaEstavaAbatido
              ? `Este serviço já estava abatido. O valor passa a ${formatCurrency(valorDefinido)} sem duplicar o desconto.`
              : `Saldo antes: ${formatCurrency(saldoAntes)}. Serviço: ${formatCurrency(valorDefinido)}. Saldo depois: ${formatCurrency(saldoDepois)}.`}
          </p>
        ) : valorDefinido > 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Valor definido: {formatCurrency(valorDefinido)}. Só entra no saldo quando marcar
            «Abatido no crédito».
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
