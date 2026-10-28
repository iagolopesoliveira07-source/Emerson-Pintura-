import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Table from '../Table/Table';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import PagamentoFormModal from '../PagamentoForm/PagamentoFormModal';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import { buildPagamentoUpdate, formToPagamentoPayload } from '../../utils/pagamentoForm';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { filterByPeriod } from '../../utils/periodFilter';
import shared from '../../pages/shared.module.css';

export default function FuncionarioPagamentosSection({ funcionario, onSuccess, periodRange }) {
  const { pagamentos, obras, addPagamento, updatePagamento, deletePagamento } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const items = filterByPeriod(
    pagamentos.filter(
      (p) => p.tipo === 'Pagamento a funcionário' && p.pessoaRelacionada === funcionario.nome
    ),
    periodRange
  ).sort((a, b) => new Date(b.data) - new Date(a.data));

  const total = items.reduce((sum, item) => sum + (item.valor || 0), 0);

  const handleCreate = (form) => {
    addPagamento({
      ...formToPagamentoPayload({
        ...form,
        tipo: 'Pagamento a funcionário',
        pessoaRelacionada: funcionario.nome,
      }),
    });
    setCreateOpen(false);
    onSuccess?.('Pagamento registado com sucesso.');
  };

  const handleEdit = (form) => {
    updatePagamento(
      buildPagamentoUpdate(selected, {
        ...form,
        tipo: 'Pagamento a funcionário',
        pessoaRelacionada: funcionario.nome,
      })
    );
    setEditOpen(false);
    setSelected(null);
    onSuccess?.('Pagamento atualizado com sucesso.');
  };

  const handleDelete = () => {
    deletePagamento(selected.id);
    setDeleteOpen(false);
    setSelected(null);
    onSuccess?.('Pagamento excluído com sucesso.');
  };

  const columns = [
    { key: 'data', label: 'Data', render: (r) => formatDate(r.data) },
    { key: 'descricao', label: 'Descrição' },
    { key: 'metodo', label: 'Método', render: (r) => r.metodoPagamento || '—' },
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
            title="Editar pagamento"
            aria-label="Editar pagamento"
            onClick={() => {
              setSelected(r);
              setEditOpen(true);
            }}
          />
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            title="Excluir pagamento"
            aria-label="Excluir pagamento"
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
        <h3 className={shared.sectionHeaderTitle}>Pagamentos</h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Adicionar pagamento
        </Button>
      </div>

      <div className={shared.tableScroll}>
        <Table
          columns={columns}
          data={items}
          emptyMessage="Sem pagamentos neste período."
        />
      </div>

      {items.length > 0 && (
        <div className={shared.sectionTotal}>
          <span>Total pago</span>
          <span className={shared.sectionTotalValue}>{formatCurrency(total)}</span>
        </div>
      )}

      <PagamentoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        obras={obras}
        defaultPessoaRelacionada={funcionario.nome}
        fixedTipo="Pagamento a funcionário"
      />

      <PagamentoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        mode="edit"
        pagamento={selected}
        onSubmit={handleEdit}
        obras={obras}
        defaultPessoaRelacionada={funcionario.nome}
        fixedTipo="Pagamento a funcionário"
      />

      {selected && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title="Excluir pagamento?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este pagamento?</p>
          <div className={confirmStyles.details}>
            {[
              ['Data', formatDate(selected.data)],
              ['Descrição', selected.descricao],
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
