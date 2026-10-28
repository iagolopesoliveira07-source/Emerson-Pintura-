import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormActions } from '../Form/Form';
import { validateNumber, validateRequired, validateForm } from '../../utils/validators';
import { getTodayISO } from '../../utils/formatters';

const EMPTY_FORM = {
  valor: '',
  data: '',
  observacao: '',
};

export default function ParceiroReembolsoModal({
  isOpen,
  onClose,
  partnerName = 'Parceiro',
  title,
  hint,
  submitLabel = 'Guardar reembolso',
  onSubmit,
  repasse = null,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (repasse) {
      setForm({
        valor: String(repasse.valor ?? ''),
        data: String(repasse.data || '').slice(0, 10),
        observacao: repasse.observacao || '',
      });
    } else {
      setForm({
        valor: '',
        data: getTodayISO(),
        observacao: '',
      });
    }
    setErrors({});
  }, [isOpen, repasse]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      valor: validateNumber(form.valor, 'Valor', 0.01),
      data: validateRequired(form.data, 'Data'),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit({
      valor: parseFloat(form.valor),
      data: form.data,
      observacao: form.observacao,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || `Reembolso a ${partnerName}`}
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="parceiro-reembolso-form">
            {submitLabel}
          </Button>
        </FormActions>
      }
    >
      <form id="parceiro-reembolso-form" onSubmit={handleSubmit}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          {hint || 'Isto não cria um novo gasto. A despesa original já está no custo da obra.'}
        </p>
        <FormGroup label="Valor (€)" required error={errors.valor}>
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
        <FormGroup label="Data" required error={errors.data}>
          <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
        </FormGroup>
        <FormGroup label="Observações">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
