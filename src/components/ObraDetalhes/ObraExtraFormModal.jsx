import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormActions } from '../Form/Form';
import {
  EXTRA_STATUS,
  EXTRA_STATUS_LABELS,
  EXTRA_STATUS_OPTIONS,
  createObraExtra,
  getExtraDate,
  normalizeExtraStatus,
  validateObraExtraForm,
} from '../../utils/obraExtras';
import { getTodayISO } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import HelpTip from '../HelpTip/HelpTip';
import ivaStyles from '../GastoForm/GastoForm.module.css';

const EMPTY_FORM = {
  descricao: '',
  valor: '',
  data: '',
  status: EXTRA_STATUS.A_COBRAR,
  observacao: '',
};

export default function ObraExtraFormModal({
  isOpen,
  onClose,
  mode = 'create',
  extra = null,
  showStatus = false,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Editar extra / serviço adicional' : 'Adicionar extra / serviço adicional';

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      isEdit && extra
        ? {
            descricao: extra.descricao || '',
            valor: extra.valor != null ? String(extra.valor) : '',
            data: getExtraDate(extra) || getTodayISO(),
            status: normalizeExtraStatus(extra.status),
            observacao: extra.observacao || '',
          }
        : { ...EMPTY_FORM, data: getTodayISO() }
    );
    setErrors({});
  }, [isOpen, isEdit, extra]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateObraExtraForm(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit(
      createObraExtra(
        {
          id: isEdit ? extra.id : undefined,
          descricao: form.descricao,
          valor: form.valor,
          data: form.data,
          ...(showStatus ? { status: form.status } : {}),
          observacao: form.observacao,
          createdAt: isEdit ? extra.createdAt : undefined,
        },
        isEdit ? extra : null
      )
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
          <Button type="submit" form="obra-extra-form">
            {isEdit ? 'Salvar alterações' : 'Guardar extra'}
          </Button>
        </FormActions>
      }
    >
      <form id="obra-extra-form" onSubmit={handleSubmit}>
        <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {showStatus
            ? 'Serviço adicional desta obra. Não cria uma obra nova. O valor original da obra não é alterado.'
            : 'Acréscimo ao valor desta mesma obra. Não cria uma obra nova nem uma cobrança separada. O valor original não é alterado.'}
        </p>
        <FormGroup label="Nome/descrição do serviço" required error={errors.descricao}>
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            error={errors.descricao}
            placeholder="Ex.: Manutenção, reparação, pintura adicional"
          />
        </FormGroup>
        <FormGroup label="Valor cobrado (€)" required error={errors.valor}>
          <Input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            value={form.valor}
            onChange={handleChange}
            error={errors.valor}
            placeholder="0,00"
          />
        </FormGroup>
        <FormGroup label="Data" required error={errors.data}>
          <Input
            name="data"
            type="date"
            value={form.data}
            onChange={handleChange}
            error={errors.data}
          />
        </FormGroup>
        {showStatus ? (
        <section className={ivaStyles.ivaSection} aria-labelledby="extra-status-title">
          <h3 id="extra-status-title" className={ivaStyles.ivaTitle}>
            Status
          </h3>
          <div className={ivaStyles.radioGroup} role="radiogroup" aria-label="Status do extra">
            {EXTRA_STATUS_OPTIONS.map((status) => (
              <label key={status} className={ivaStyles.radioOption}>
                <input
                  type="radio"
                  name="status"
                  value={status}
                  checked={form.status === status}
                  onChange={handleChange}
                />
                {EXTRA_STATUS_LABELS[status]}
                <HelpTip text={HELP.extras[status] || HELP.extras.status} />
              </label>
            ))}
          </div>
        </section>
        ) : null}
        <FormGroup label="Observação" hint="Opcional">
          <Textarea
            name="observacao"
            value={form.observacao}
            onChange={handleChange}
            placeholder="Notas para o cliente ou internas"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
