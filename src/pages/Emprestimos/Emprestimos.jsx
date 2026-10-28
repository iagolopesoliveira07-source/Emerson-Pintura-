import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import Badge from '../../components/Badge/Badge';
import Table from '../../components/Table/Table';
import Modal from '../../components/Modal/Modal';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../../components/Form/Form';
import { EMPRESTIMO_ESTADOS } from '../../data/mockData';
import { formatCurrency, formatDate, getTodayISO } from '../../utils/formatters';
import { validateRequired, validateNumber, validateForm } from '../../utils/validators';
import shared from '../shared.module.css';

export default function Emprestimos() {
  const [searchParams] = useSearchParams();
  const { emprestimos, funcionarios, addEmprestimo } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    funcionarioId: '', valor: '', data: getTodayISO(),
    motivo: '', formaPagamento: '', observacoes: '', estado: 'Em aberto',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (searchParams.get('nova') === 'true') setModalOpen(true);
  }, [searchParams]);

  const totalEmAberto = emprestimos.reduce((s, e) => s + (e.valor - (e.valorPago || 0)), 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      funcionarioId: validateRequired(form.funcionarioId, 'Funcionário'),
      valor: validateNumber(form.valor, 'Valor', 0.01),
      data: validateRequired(form.data, 'Data'),
      motivo: validateRequired(form.motivo, 'Motivo'),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    addEmprestimo({ ...form, valor: parseFloat(form.valor) });
    setForm({ funcionarioId: '', valor: '', data: getTodayISO(), motivo: '', formaPagamento: '', observacoes: '', estado: 'Em aberto' });
    setErrors({});
    setModalOpen(false);
  };

  const columns = [
    { key: 'data', label: 'Data', render: (r) => formatDate(r.data) },
    { key: 'funcionario', label: 'Funcionário', render: (r) => funcionarios.find((f) => f.id === r.funcionarioId)?.nome || '—' },
    { key: 'motivo', label: 'Motivo' },
    {
      key: 'parcelas',
      label: 'Parcelas',
      render: (r) =>
        r.numeroParcelas
          ? `${r.numeroParcelas}x ${formatCurrency(r.valorParcela || r.valor / r.numeroParcelas)}`
          : '—',
    },
    { key: 'valor', label: 'Valor', align: 'right', render: (r) => formatCurrency(r.valor) },
    { key: 'estado', label: 'Estado', render: (r) => <Badge>{r.estado}</Badge> },
    { key: 'restante', label: 'Saldo restante', align: 'right', render: (r) => formatCurrency(r.valor - (r.valorPago || 0)) },
  ];

  return (
    <div className={shared.page}>
      <PageHeader
        title="Empréstimos"
        subtitle="Gerir empréstimos a funcionários"
        actions={<Button icon={Plus} onClick={() => setModalOpen(true)}>Novo empréstimo</Button>}
      />

      <div className={shared.statsRow}>
        <Card title="Total em aberto" value={formatCurrency(totalEmAberto)} iconColor="red" />
        <Card title="Empréstimos activos" value={emprestimos.filter((e) => e.estado !== 'Pago').length} iconColor="orange" />
      </div>

      <Table columns={columns} data={[...emprestimos].sort((a, b) => new Date(b.data) - new Date(a.data))} emptyMessage="Nenhum empréstimo registado." />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo empréstimo"
        footer={
          <FormActions>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Guardar</Button>
          </FormActions>
        }
      >
        <form onSubmit={handleSubmit}>
          <FormGroup label="Funcionário" required error={errors.funcionarioId}>
            <Select name="funcionarioId" value={form.funcionarioId} onChange={handleChange} error={errors.funcionarioId}>
              <option value="">Seleccionar...</option>
              {funcionarios.filter((f) => f.estado === 'Ativo').map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </Select>
          </FormGroup>
          <FormRow>
            <FormGroup label="Valor (€)" required error={errors.valor}>
              <Input name="valor" type="number" step="0.01" value={form.valor} onChange={handleChange} error={errors.valor} />
            </FormGroup>
            <FormGroup label="Data" required error={errors.data}>
              <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
            </FormGroup>
          </FormRow>
          <FormGroup label="Motivo" required error={errors.motivo}>
            <Input name="motivo" value={form.motivo} onChange={handleChange} error={errors.motivo} />
          </FormGroup>
          <FormGroup label="Forma de pagamento/devolução">
            <Input name="formaPagamento" value={form.formaPagamento} onChange={handleChange} placeholder="Ex: Desconto em diárias" />
          </FormGroup>
          <FormGroup label="Observações">
            <Textarea name="observacoes" value={form.observacoes} onChange={handleChange} />
          </FormGroup>
        </form>
      </Modal>
    </div>
  );
}
