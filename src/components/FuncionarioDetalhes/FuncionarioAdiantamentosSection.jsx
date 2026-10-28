import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Table from '../Table/Table';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import AdiantamentoFormModal from './AdiantamentoFormModal';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import { formatCurrency, formatDate } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';

export default function FuncionarioAdiantamentosSection({ funcionario, onSuccess }) {
  const { adiantamentos, addAdiantamento, updateAdiantamento, deleteAdiantamento } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const items = adiantamentos
    .filter((a) => a.funcionarioId === funcionario.id)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  const total = items.reduce((sum, a) => sum + (a.valor || 0), 0);

  const handleCreate = (form) => {
    addAdiantamento({ ...form, funcionarioId: funcionario.id });
    setCreateOpen(false);
    onSuccess?.('Adiantamento registado com sucesso.');
  };

  const handleEdit = (form) => {
    updateAdiantamento({
      ...selected,
      ...form,
      funcionarioId: funcionario.id,
      updatedAt: new Date().toISOString(),
    });
    setEditOpen(false);
    setSelected(null);
    onSuccess?.('Adiantamento atualizado com sucesso.');
  };

  const handleDelete = () => {
    deleteAdiantamento(selected.id);
    setDeleteOpen(false);
    setSelected(null);
    onSuccess?.('Adiantamento excluído com sucesso.');
  };

  const columns = [
    { key: 'data', label: 'Data', render: (r) => formatDate(r.data) },
    { key: 'motivo', label: 'Descrição' },
    {
      key: 'valor',
      label: 'Valor',
      align: 'right',
      render: (r) => formatCurrency(r.valor),
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
            title="Editar adiantamento"
            aria-label="Editar adiantamento"
            onClick={() => {
              setSelected(r);
              setEditOpen(true);
            }}
          />
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            title="Excluir adiantamento"
            aria-label="Excluir adiantamento"
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
        <h3 className={shared.sectionHeaderTitle}>Adiantamentos</h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Adicionar adiantamento
        </Button>
      </div>

      <div className={shared.tableScroll}>
        <Table columns={columns} data={items} emptyMessage="Sem adiantamentos." />
      </div>

      {items.length > 0 && (
        <div className={shared.sectionTotal}>
          <span>Total de adiantamentos</span>
          <span className={shared.sectionTotalValue}>{formatCurrency(total)}</span>
        </div>
      )}

      <AdiantamentoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <AdiantamentoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        adiantamento={selected}
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
          title="Excluir adiantamento?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este adiantamento?</p>
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
