import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import Table from '../Table/Table';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import ObraPagamentoFormModal from './ObraPagamentoFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calcObraRecebimentoResumo, RECEBIMENTO_STATUS } from '../../utils/debtCalculations';
import { applyObraExtrasToResumo } from '../../utils/obraExtras';
import { HELP } from '../../utils/helpTexts';
import { HelpLabel } from '../HelpTip/HelpTip';
import {
  buildObraPaymentRecord,
  enrichObraPagamentosForDisplay,
} from '../../utils/obraPagamentoCalculations';
import shared from '../../pages/shared.module.css';
import styles from './ObraPagamentosSection.module.css';

export default function ObraPagamentosSection({ obra, onSuccess }) {
  const { pagamentos, addPagamento, updatePagamento, deletePagamento } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const resumo = useMemo(
    () => applyObraExtrasToResumo(obra, calcObraRecebimentoResumo(obra, pagamentos)),
    [obra, pagamentos]
  );

  const pagamentosDisplay = useMemo(
    () => enrichObraPagamentosForDisplay(obra, pagamentos),
    [obra, pagamentos]
  );

  const handleCreate = (details) => {
    addPagamento(buildObraPaymentRecord(obra, details.valor, details, pagamentos));
    setCreateOpen(false);
    onSuccess?.('Pagamento registado com sucesso.');
  };

  const handleEdit = (details) => {
    if (!selected) return;

    updatePagamento({
      ...selected,
      valor: details.valor,
      valorRecebido: details.valor,
      data: details.data,
      metodoPagamento: details.metodoPagamento,
      observacao: details.observacao,
      status: RECEBIMENTO_STATUS.PAGO,
      updatedAt: new Date().toISOString(),
    });

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
    {
      key: 'parcela',
      label: 'Parcela',
      render: (row) => <span className={styles.parcelaLabel}>{row.parcelaLabel}</span>,
    },
    {
      key: 'valor',
      label: 'Valor',
      align: 'right',
      render: (row) => formatCurrency(row.valor),
    },
    {
      key: 'data',
      label: 'Data',
      render: (row) => (row.pagamento.data ? formatDate(row.pagamento.data) : '—'),
    },
    {
      key: 'metodo',
      label: 'Método',
      render: (row) => row.pagamento.metodoPagamento || '—',
    },
    {
      key: 'observacao',
      label: 'Observação',
      render: (row) => row.pagamento.observacao || '—',
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (row) => (
        <div className={shared.tableActions}>
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            title="Editar pagamento"
            aria-label="Editar pagamento"
            onClick={() => {
              setSelected(row.pagamento);
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
              setSelected(row.pagamento);
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
        <h3 className={shared.sectionHeaderTitle}>Pagamentos da obra</h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Registrar pagamento
        </Button>
      </div>

      <div className={styles.resumoBar}>
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.valorOriginal}>
            Valor original
          </HelpLabel>
          <span className={styles.resumoValue}>{formatCurrency(resumo.valorOriginal ?? resumo.valorContratado)}</span>
        </div>
        {resumo.extras?.total > 0.004 ? (
          <div className={styles.resumoItem}>
            <HelpLabel className={styles.resumoLabel} text={HELP.obra.extras}>
              Extras/serviços
            </HelpLabel>
            <span className={styles.resumoValue}>{formatCurrency(resumo.extras.total)}</span>
          </div>
        ) : null}
        {resumo.extras?.total > 0.004 ? (
          <div className={styles.resumoItem}>
            <HelpLabel className={styles.resumoLabel} text={HELP.obra.valorAtualizado}>
              Valor atualizado
            </HelpLabel>
            <span className={styles.resumoValue}>{formatCurrency(resumo.valorAtualizado)}</span>
          </div>
        ) : null}
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.recebido}>
            Total recebido
          </HelpLabel>
          <span className={styles.resumoValue}>{formatCurrency(resumo.valorRecebido)}</span>
        </div>
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.aReceber}>
            Falta receber
          </HelpLabel>
          <span className={`${styles.resumoValue} ${styles.saldoDestaque}`}>
            {formatCurrency(resumo.valorRestante)}
          </span>
        </div>
        <div className={styles.resumoItem}>
          <span className={styles.resumoLabel}>Status</span>
          {resumo.isPago ? (
            <Badge variant="success">Pago</Badge>
          ) : (
            <Badge variant="warning">A receber</Badge>
          )}
        </div>
      </div>

      <div className={styles.desktopTable}>
        <div className={shared.tableScroll}>
          <Table
            columns={columns}
            data={pagamentosDisplay}
            emptyMessage="Nenhum pagamento registado. Clique em «Registrar pagamento» para adicionar."
          />
        </div>
      </div>

      <div className={styles.mobileCards}>
        {pagamentosDisplay.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Nenhum pagamento registado.
          </p>
        ) : (
          pagamentosDisplay.map((row) => (
            <article key={row.pagamento.id} className={styles.paymentCard}>
              <div className={styles.parcelaLabel}>{row.parcelaLabel}</div>
              <div className={styles.paymentCardGrid}>
                <div>
                  <span>Valor</span>
                  <strong>{formatCurrency(row.valor)}</strong>
                </div>
                <div>
                  <span>Data</span>
                  <strong>{row.pagamento.data ? formatDate(row.pagamento.data) : '—'}</strong>
                </div>
                <div>
                  <span>Método</span>
                  <strong>{row.pagamento.metodoPagamento || '—'}</strong>
                </div>
                <div>
                  <span>Observação</span>
                  <strong>{row.pagamento.observacao || '—'}</strong>
                </div>
              </div>
              <div className={shared.tableActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Pencil}
                  onClick={() => {
                    setSelected(row.pagamento);
                    setEditOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    setSelected(row.pagamento);
                    setDeleteOpen(true);
                  }}
                >
                  Excluir
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <ObraPagamentoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        obra={obra}
        pagamentos={pagamentos}
        onSubmit={handleCreate}
      />

      <ObraPagamentoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        obra={obra}
        pagamentos={pagamentos}
        pagamento={selected}
        mode="edit"
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
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este pagamento?</p>
          <div className={confirmStyles.details}>
            {[
              ['Data', selected.data ? formatDate(selected.data) : '—'],
              ['Método', selected.metodoPagamento || '—'],
              ['Valor', formatCurrency(selected.valorRecebido ?? selected.valor)],
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
