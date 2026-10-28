import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import Table from '../../components/Table/Table';
import PagamentoFormModal from '../../components/PagamentoForm/PagamentoFormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import confirmStyles from '../../components/ConfirmDialog/ConfirmDialog.module.css';
import { formToPagamentoPayload, buildPagamentoUpdate } from '../../utils/pagamentoForm';
import {
  getValorRecebidoPagamento,
  isPagamentoRecebidoVisivel,
  RECEBIMENTO_STATUS,
} from '../../utils/debtCalculations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import shared from '../shared.module.css';
import PeriodFilter from '../../components/PeriodFilter/PeriodFilter';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';
import { filterByPeriod } from '../../utils/periodFilter';

export default function Pagamentos() {
  const [searchParams] = useSearchParams();
  const { pagamentos, obras, addPagamento, updatePagamento, deletePagamento } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [pesquisa, setPesquisa] = useState('');
  const period = usePeriodFilter();

  useEffect(() => {
    if (searchParams.get('nova') === 'true') setCreateOpen(true);
  }, [searchParams]);

  const visiblePagamentos = useMemo(() => {
    const byPeriod = filterByPeriod(
      pagamentos.filter(isPagamentoRecebidoVisivel),
      period.range
    );

    const termo = pesquisa.trim().toLowerCase();
    const searched = termo
      ? byPeriod.filter((p) => {
          const pessoa = (p.pessoaRelacionada || '').toLowerCase();
          const descricao = (p.descricao || '').toLowerCase();
          const tipo = (p.tipo || '').toLowerCase();
          const valor = String(p.valor ?? '');
          return (
            pessoa.includes(termo) ||
            descricao.includes(termo) ||
            tipo.includes(termo) ||
            valor.includes(termo)
          );
        })
      : byPeriod;

    return [...searched].sort(
      (a, b) => new Date(b.data || b.dataVencimento || b.createdAt) - new Date(a.data || a.dataVencimento || a.createdAt)
    );
  }, [pagamentos, period.range, pesquisa]);

  const recebimentos = visiblePagamentos.filter((p) => p.tipo === 'Recebimento de cliente');
  const pagamentosSaida = visiblePagamentos.filter((p) => p.tipo !== 'Recebimento de cliente');
  const totalRecebido = recebimentos.reduce((sum, p) => sum + getValorRecebidoPagamento(p), 0);
  const totalPago = pagamentosSaida.reduce((sum, p) => sum + (p.valor || 0), 0);

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleCreate = (form) => {
    const payload = formToPagamentoPayload(form);
    addPagamento({
      ...payload,
      status:
        payload.tipo === 'Recebimento de cliente' ? RECEBIMENTO_STATUS.PAGO : undefined,
      valorRecebido:
        payload.tipo === 'Recebimento de cliente' ? payload.valor : undefined,
      historicoPagamentos: [],
    });
    setCreateOpen(false);
    showSuccess('Pagamento registado com sucesso.');
  };

  const handleEdit = (form) => {
    const payload = formToPagamentoPayload(form);
    updatePagamento(
      buildPagamentoUpdate(selected, {
        ...form,
        valor: payload.valor,
      })
    );
    setEditOpen(false);
    setSelected(null);
    showSuccess('Pagamento atualizado com sucesso.');
  };

  const handleDelete = () => {
    deletePagamento(selected.id);
    setDeleteOpen(false);
    setSelected(null);
    showSuccess('Pagamento excluído com sucesso.');
  };

  const columns = [
    {
      key: 'data',
      label: 'Data',
      render: (r) => (r.data ? formatDate(r.data) : '—'),
    },
    { key: 'tipo', label: 'Tipo' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'pessoa', label: 'Pessoa/Empresa', render: (r) => r.pessoaRelacionada || '—' },
    { key: 'metodo', label: 'Método', render: (r) => r.metodoPagamento || '—' },
    {
      key: 'valor',
      label: 'Valor',
      align: 'right',
      render: (r) =>
        formatCurrency(
          r.tipo === 'Recebimento de cliente' ? getValorRecebidoPagamento(r) : r.valor
        ),
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
            onClick={() => {
              setSelected(r);
              setEditOpen(true);
            }}
          />
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
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
    <div className={shared.page}>
      <PageHeader
        title="Pagamentos"
        subtitle="Registar recebimentos e pagamentos"
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Novo registo</Button>}
      />

      {successMessage && (
        <div className={shared.successBanner} role="status">
          {successMessage}
        </div>
      )}

      <div className={shared.statsRow}>
        <Card title="Total recebido" value={formatCurrency(totalRecebido)} iconColor="green" help={HELP.recebimento.recebido} />
        <Card title="Total pago" value={formatCurrency(totalPago)} iconColor="red" />
        <Card title="Saldo" value={formatCurrency(totalRecebido - totalPago)} iconColor="blue" />
      </div>

      <div className={shared.filters}>
        <input
          className={shared.filterInput}
          placeholder="Pesquisar funcionário, descrição ou valor..."
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
        />
      </div>

      <PeriodFilter
        preset={period.preset}
        onPresetChange={period.setPreset}
        customInicio={period.customInicio}
        customFim={period.customFim}
        onCustomInicioChange={period.setCustomInicio}
        onCustomFimChange={period.setCustomFim}
        label={period.label}
      />

      <div className={shared.tableScroll}>
        <Table
          columns={columns}
          data={visiblePagamentos}
          emptyMessage={
            period.preset === 'todos' && !pesquisa
              ? 'Nenhum pagamento registado.'
              : 'Nenhum pagamento neste período.'
          }
        />
      </div>

      <PagamentoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        obras={obras}
        onSubmit={handleCreate}
      />

      <PagamentoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        mode="edit"
        pagamento={selected}
        obras={obras}
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
          title="Excluir pagamento?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir pagamento"
        >
          <p className={confirmStyles.message}>
            Tem certeza que deseja excluir este pagamento? Os valores da obra e de Devedores serão recalculados.
          </p>
          <div className={confirmStyles.details}>
            {[
              ['Tipo', selected.tipo],
              ['Descrição', selected.descricao],
              [
                'Valor',
                formatCurrency(
                  selected.tipo === 'Recebimento de cliente'
                    ? getValorRecebidoPagamento(selected)
                    : selected.valor
                ),
              ],
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
