import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../Form/Form';
import { METODOS_PAGAMENTO } from '../../data/mockData';
import { formatCurrency } from '../../utils/formatters';
import { getTodayISO } from '../../utils/formatters';
import { validateNumber, validateRequired, validateForm } from '../../utils/validators';
import { useEffect, useState } from 'react';
import styles from './Devedores.module.css';

export default function DebtPaymentFormModal({
  isOpen,
  onClose,
  debt,
  onSubmit,
  title = 'Registrar pagamento',
}) {
  const [form, setForm] = useState({
    valor: '',
    data: getTodayISO(),
    metodoPagamento: 'Transferência',
    observacao: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen || !debt) return;
    setForm({
      valor: String(debt.valorRestante),
      data: getTodayISO(),
      metodoPagamento: debt.metodoPagamento || 'Transferência',
      observacao: '',
    });
    setErrors({});
  }, [isOpen, debt]);

  if (!debt) return null;

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

    if (parseFloat(form.valor) - debt.valorRestante > 0.001) {
      validation.errors.valor = `O valor máximo é ${formatCurrency(debt.valorRestante)}`;
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
      descricao: `Recebimento — ${debt.obraNome}`,
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
        <div className={styles.paymentSummary}>
          <div><strong>{debt.obraNome}</strong></div>
          <div>Cliente: {debt.cliente}</div>
          <div className={styles.paymentSummaryGrid}>
            <div>
              <span>Valor da obra</span>
              <strong>{formatCurrency(debt.valorTotal)}</strong>
            </div>
            <div>
              <span>Já recebido</span>
              <strong>{formatCurrency(debt.valorPago)}</strong>
            </div>
            <div>
              <span>Ainda falta receber</span>
              <strong className={styles.restanteDestaque}>{formatCurrency(debt.valorRestante)}</strong>
            </div>
          </div>
        </div>
        <FormRow>
          <FormGroup label="Valor recebido (€)" required error={errors.valor}>
            <Input
              name="valor"
              type="number"
              step="0.01"
              min="0.01"
              max={debt.valorRestante}
              value={form.valor}
              onChange={handleChange}
              error={errors.valor}
            />
          </FormGroup>
          <FormGroup label="Data" required error={errors.data}>
            <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Método de pagamento">
          <Select name="metodoPagamento" value={form.metodoPagamento} onChange={handleChange}>
            {METODOS_PAGAMENTO.map((metodo) => (
              <option key={metodo} value={metodo}>{metodo}</option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Restante após este pagamento:{' '}
          <strong className={styles.restanteDestaque}>
            {formatCurrency(Math.max(0, debt.valorRestante - (parseFloat(form.valor) || 0)))}
          </strong>
        </p>
      </form>
    </Modal>
  );
}
