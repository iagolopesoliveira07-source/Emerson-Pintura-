import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormRow, FormActions } from '../Form/Form';
import { getTodayISO } from '../../utils/formatters';
import { validateRequired, validateNumber, validateForm } from '../../utils/validators';

const emptyForm = () => ({
  data: getTodayISO(),
  valor: '',
  motivo: '',
  observacao: '',
});

export default function AdiantamentoFormModal({
  isOpen,
  onClose,
  onSubmit,
  adiantamento = null,
}) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(adiantamento);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      adiantamento
        ? {
            data: adiantamento.data || getTodayISO(),
            valor: String(adiantamento.valor ?? ''),
            motivo: adiantamento.motivo || '',
            observacao: adiantamento.observacao || '',
          }
        : emptyForm()
    );
    setErrors({});
  }, [isOpen, adiantamento]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      data: validateRequired(form.data, 'Data'),
      valor: validateNumber(form.valor, 'Valor', 0.01),
      motivo: validateRequired(form.motivo, 'Descrição'),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit({
      ...form,
      valor: parseFloat(form.valor),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar adiantamento' : 'Adicionar adiantamento'}
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEdit ? 'Guardar' : 'Adicionar'}</Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormRow>
          <FormGroup label="Data" required error={errors.data}>
            <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
          </FormGroup>
          <FormGroup label="Valor (€)" required error={errors.valor}>
            <Input name="valor" type="number" step="0.01" value={form.valor} onChange={handleChange} error={errors.valor} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Descrição" required error={errors.motivo}>
          <Input name="motivo" value={form.motivo} onChange={handleChange} error={errors.motivo} />
        </FormGroup>
        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
