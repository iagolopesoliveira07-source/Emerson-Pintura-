import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import Table from '../Table/Table';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import EmprestimoFormModal from './EmprestimoFormModal';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calcEmprestimoRestante, deriveEmprestimoEstado } from '../../utils/calculations';
import shared from '../../pages/shared.module.css';

function formatEstado(estado) {
  if (estado === 'Pago') return 'Quitado';
  return estado;
}

export default function FuncionarioEmprestimosSection({ funcionario, onSuccess }) {
  const { emprestimos, addEmprestimo, updateEmprestimo, deleteEmprestimo } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const items = emprestimos
    .filter((e) => e.funcionarioId === funcionario.id)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  const totalEmAberto = items.reduce((sum, e) => sum + calcEmprestimoRestante(e), 0);

  const handleCreate = (form) => {
    const estado = deriveEmprestimoEstado({
      valor: form.valor,
      valorPago: form.valorPago || 0,
      estado: form.estado,
    });

    addEmprestimo({
      ...form,
      funcionarioId: funcionario.id,
      estado,
      valorPago: estado === 'Pago' ? form.valor : form.valorPago || 0,
    });
    setCreateOpen(false);
    onSuccess?.('Empréstimo registado com sucesso.');
  };

  const handleEdit = (form) => {
    const estado = deriveEmprestimoEstado({
      valor: form.valor,
      valorPago: form.valorPago || 0,
      estado: form.estado,
    });

    updateEmprestimo({
      ...selected,
      ...form,
      funcionarioId: funcionario.id,
      estado,
      valorPago: estado === 'Pago' ? form.valor : form.valorPago || 0,
      updatedAt: new Date().toISOString(),
    });
    setEditOpen(false);
    setSelected(null);
    onSuccess?.('Empréstimo atualizado com sucesso.');
  };

  const handleDelete = () => {
    deleteEmprestimo(selected.id);
    setDeleteOpen(false);
    setSelected(null);
    onSuccess?.('Empréstimo excluído com sucesso.');
  };

  const columns = [
    { key: 'data', label: 'Data', render: (r) => formatDate(r.data) },
    { key: 'motivo', label: 'Descrição' },
    {
      key: 'parcelas',
      label: 'Parcelas',
      render: (r) =>
        r.numeroParcelas
          ? `${r.numeroParcelas}x ${formatCurrency(r.valorParcela || r.valor / r.numeroParcelas)}`
          : '—',
    },
    { key: 'valor', label: 'Valor', align: 'right', render: (r) => formatCurrency(r.valor) },
    {
      key: 'estado',
      label: 'Estado',
      render: (r) => <Badge>{formatEstado(r.estado)}</Badge>,
    },
    {
      key: 'restante',
      label: 'Saldo restante',
      align: 'right',
      render: (r) => formatCurrency(calcEmprestimoRestante(r)),
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (r) => (
        <div className={shared.tableActions}>
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            title="Editar empréstimo"
            aria-label="Editar empréstimo"
            onClick={() => {
              setSelected(r);
              setEditOpen(true);
            }}
          />
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            title="Excluir empréstimo"
            aria-label="Excluir empréstimo"
            onClick={() => {
              setSelected(r);
              setDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>Empréstimos</h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Adicionar empréstimo
        </Button>
      </div>

      <div className={shared.tableScroll}>
        <Table columns={columns} data={items} emptyMessage="Sem empréstimos." />
      </div>

      {items.length > 0 && (
        <div className={shared.sectionTotal}>
          <span>Total em aberto</span>
          <span className={shared.sectionTotalValue}>{formatCurrency(totalEmAberto)}</span>
        </div>
      )}

      <EmprestimoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <EmprestimoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        emprestimo={selected}
        onSubmit={handleEdit}
      />

      {selected && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title="Excluir empréstimo?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este empréstimo?</p>
          <div className={confirmStyles.details}>
            {[
              ['Data', formatDate(selected.data)],
              ['Descrição', selected.motivo],
              ['Valor', formatCurrency(selected.valor)],
            ].map(([label, value]) => (
              <div key={label} className={confirmStyles.detailRow}>
                <span className={confirmStyles.detailLabel}>{label}:</span>
                <span className={confirmStyles.detailValue}>{value}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
