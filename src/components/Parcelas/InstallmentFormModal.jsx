import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormRow, FormActions } from '../Form/Form';
import { getTodayISO } from '../../utils/formatters';
import { validateNumber, validateRequired, validateForm } from '../../utils/validators';

export default function InstallmentFormModal({
  isOpen,
  onClose,
  parcela = null,
  obra,
  nextParcelaNumero = 1,
  parcelaTotal = 1,
  onSubmit,
}) {
  const [form, setForm] = useState({
    valor: '',
    dataVencimento: getTodayISO(),
    observacao: '',
  });
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(parcela);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      parcela
        ? {
            valor: String(parcela.valor ?? ''),
            dataVencimento: parcela.dataVencimento || getTodayISO(),
            observacao: parcela.observacao || '',
          }
        : {
            valor: '',
            dataVencimento: getTodayISO(),
            observacao: '',
          }
    );
    setErrors({});
  }, [isOpen, parcela]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      valor: validateNumber(form.valor, 'Valor', 0.01),
      dataVencimento: validateRequired(form.dataVencimento, 'Data de vencimento'),
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSubmit({
      ...form,
      valor: parseFloat(form.valor),
      descricao: parcela?.descricao || `Parcela ${nextParcelaNumero}/${parcelaTotal} — ${obra.nome}`,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Editar parcela ${parcela.parcelaNumero}/${parcela.parcelaTotal}` : 'Adicionar parcela'}
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEdit ? 'Guardar' : 'Adicionar'}</Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormRow>
          <FormGroup label="Valor (€)" required error={errors.valor}>
            <Input name="valor" type="number" step="0.01" value={form.valor} onChange={handleChange} error={errors.valor} />
          </FormGroup>
          <FormGroup label="Vencimento" required error={errors.dataVencimento}>
            <Input name="dataVencimento" type="date" value={form.dataVencimento} onChange={handleChange} error={errors.dataVencimento} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
