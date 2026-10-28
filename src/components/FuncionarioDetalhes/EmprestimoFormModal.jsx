import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../Form/Form';
import { EMPRESTIMO_ESTADOS } from '../../data/mockData';
import { getTodayISO } from '../../utils/formatters';
import { deriveEmprestimoEstado } from '../../utils/calculations';
import { formatCurrency } from '../../utils/formatters';

const ESTADO_LABELS = {
  'Em aberto': 'Em aberto',
  'Parcialmente pago': 'Parcialmente pago',
  Pago: 'Quitado',
  Quitado: 'Quitado',
};

const emptyForm = () => ({
  valor: '',
  data: getTodayISO(),
  motivo: '',
  formaPagamento: '',
  observacoes: '',
  estado: 'Em aberto',
  valorPago: '0',
});

export default function EmprestimoFormModal({
  isOpen,
  onClose,
  onSubmit,
  emprestimo = null,
}) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(emprestimo);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      emprestimo
        ? {
            valor: String(emprestimo.valor ?? ''),
            data: emprestimo.data || getTodayISO(),
            motivo: emprestimo.motivo || '',
            formaPagamento: emprestimo.formaPagamento || '',
            observacoes: emprestimo.observacoes || '',
            estado: emprestimo.estado === 'Pago' ? 'Pago' : emprestimo.estado || 'Em aberto',
            valorPago: String(emprestimo.valorPago ?? 0),
          }
        : emptyForm()
    );
    setErrors({});
  }, [isOpen, emprestimo]);

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
      motivo: validateRequired(form.motivo, 'Descrição'),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const valor = parseFloat(form.valor);
    const valorPago = parseFloat(form.valorPago) || 0;
    const estado = deriveEmprestimoEstado({
      valor,
      valorPago,
      estado: form.estado,
    });

    onSubmit({
      ...form,
      valor,
      valorPago: estado === 'Pago' ? valor : Math.min(valorPago, valor),
      estado,
    });
  };

  const saldoEmAberto = Math.max(
    0,
    (parseFloat(form.valor) || 0) - (parseFloat(form.valorPago) || 0)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar empréstimo' : 'Adicionar empréstimo'}
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
          <FormGroup label="Data" required error={errors.data}>
            <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Descrição" required error={errors.motivo}>
          <Input name="motivo" value={form.motivo} onChange={handleChange} error={errors.motivo} />
        </FormGroup>
        <FormRow>
          <FormGroup label="Estado">
            <Select name="estado" value={form.estado} onChange={handleChange}>
              {EMPRESTIMO_ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_LABELS[estado] || estado}
                </option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Valor pago (€)">
            <Input name="valorPago" type="number" step="0.01" min="0" value={form.valorPago} onChange={handleChange} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Forma de pagamento/devolução">
          <Input name="formaPagamento" value={form.formaPagamento} onChange={handleChange} placeholder="Ex: Desconto em diárias" />
        </FormGroup>
        <FormGroup label="Observações">
          <Textarea name="observacoes" value={form.observacoes} onChange={handleChange} />
        </FormGroup>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Saldo em aberto: <strong>{formatCurrency(saldoEmAberto)}</strong>
        </p>
      </form>
    </Modal>
  );
}
