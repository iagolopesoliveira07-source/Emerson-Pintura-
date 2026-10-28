import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../Form/Form';
import { METODOS_PAGAMENTO } from '../../data/mockData';
import { formatCurrency } from '../../utils/formatters';
import { getTodayISO } from '../../utils/formatters';
import { validateNumber, validateRequired, validateForm } from '../../utils/validators';

export default function InstallmentPaymentModal({ isOpen, onClose, parcela, onSubmit, title = 'Registrar pagamento' }) {
  const [form, setForm] = useState({
    valor: '',
    data: getTodayISO(),
    metodoPagamento: 'Transferência',
    observacao: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen || !parcela) return;
    const restante = Math.max(0, (parcela.valor || 0) - (parcela.valorRecebido || 0));
    setForm({
      valor: String(restante),
      data: getTodayISO(),
      metodoPagamento: parcela.metodoPagamento || 'Transferência',
      observacao: '',
    });
    setErrors({});
  }, [isOpen, parcela]);

  if (!parcela) return null;

  const restante = Math.max(0, (parcela.valor || 0) - (parcela.valorRecebido || 0));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      valor: validateNumber(form.valor, 'Valor pago', 0.01),
      data: validateRequired(form.data, 'Data'),
    });

    if (parseFloat(form.valor) - restante > 0.001) {
      validation.errors.valor = `O valor máximo é ${formatCurrency(restante)}`;
      validation.isValid = false;
    }

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSubmit({
      valor: parseFloat(form.valor),
      data: form.data,
      metodoPagamento: form.metodoPagamento,
      observacao: form.observacao,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>Confirmar pagamento</Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Parcela {parcela.parcelaNumero}/{parcela.parcelaTotal} · Valor: {formatCurrency(parcela.valor)} · Restante: {formatCurrency(restante)}
        </p>
        <FormRow>
          <FormGroup label="Valor pago (€)" required error={errors.valor}>
            <Input name="valor" type="number" step="0.01" min="0.01" max={restante} value={form.valor} onChange={handleChange} error={errors.valor} />
          </FormGroup>
          <FormGroup label="Data" required error={errors.data}>
            <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Forma de pagamento">
          <Select name="metodoPagamento" value={form.metodoPagamento} onChange={handleChange}>
            {METODOS_PAGAMENTO.map((metodo) => (
              <option key={metodo} value={metodo}>{metodo}</option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
