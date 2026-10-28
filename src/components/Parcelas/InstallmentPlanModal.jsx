import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../Form/Form';
import { formatCurrency } from '../../utils/formatters';
import { getTodayISO } from '../../utils/formatters';
import { validateNumber, validateRequired, validateForm } from '../../utils/validators';
import { splitInstallmentValues, addMonthsToDate, validateParcelasSum } from '../../utils/debtCalculations';

const INTERVALOS = [
  { value: 'mensal', label: 'Mensal', months: 1 },
  { value: 'bimestral', label: 'Bimestral', months: 2 },
  { value: 'trimestral', label: 'Trimestral', months: 3 },
];

export default function InstallmentPlanModal({ isOpen, onClose, obra, onSubmit }) {
  const [form, setForm] = useState({
    parcelas: '5',
    valorTotal: '',
    primeiraData: getTodayISO(),
    intervalo: 'mensal',
    observacao: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen || !obra) return;
    setForm({
      parcelas: '5',
      valorTotal: String(obra.valorContratado ?? ''),
      primeiraData: getTodayISO(),
      intervalo: 'mensal',
      observacao: '',
    });
    setErrors({});
  }, [isOpen, obra]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      parcelas: validateNumber(form.parcelas, 'Número de parcelas', 1),
      valorTotal: validateNumber(form.valorTotal, 'Valor total', 0.01),
      primeiraData: validateRequired(form.primeiraData, 'Data da primeira parcela'),
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const parcelas = parseInt(form.parcelas, 10);
    const interval = INTERVALOS.find((item) => item.value === form.intervalo)?.months || 1;
    const values = splitInstallmentValues(parseFloat(form.valorTotal), parcelas);
    const installments = values.map((valor, index) => ({
      valor,
      dataVencimento: addMonthsToDate(form.primeiraData, index * interval),
      observacao: form.observacao,
    }));

    const sumCheck = validateParcelasSum(obra, installments);
    if (!sumCheck.isValid) {
      const confirmed = window.confirm(
        `Os valores das parcelas totalizam ${formatCurrency(sumCheck.total)}, mas o valor contratado da obra é ${formatCurrency(sumCheck.contratado)}. Deseja continuar mesmo assim?`
      );
      if (!confirmed) return;
    }

    onSubmit(installments);
  };

  if (!obra) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurar parcelamento"
      size="lg"
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>Gerar parcelas</Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Valor contratado da obra: <strong>{formatCurrency(obra.valorContratado)}</strong>
        </p>
        <FormRow>
          <FormGroup label="Número de parcelas" required error={errors.parcelas}>
            <Input name="parcelas" type="number" min="1" step="1" value={form.parcelas} onChange={handleChange} error={errors.parcelas} />
          </FormGroup>
          <FormGroup label="Valor total (€)" required error={errors.valorTotal}>
            <Input name="valorTotal" type="number" step="0.01" value={form.valorTotal} onChange={handleChange} error={errors.valorTotal} />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Data da 1ª parcela" required error={errors.primeiraData}>
            <Input name="primeiraData" type="date" value={form.primeiraData} onChange={handleChange} error={errors.primeiraData} />
          </FormGroup>
          <FormGroup label="Intervalo">
            <Select name="intervalo" value={form.intervalo} onChange={handleChange}>
              {INTERVALOS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
