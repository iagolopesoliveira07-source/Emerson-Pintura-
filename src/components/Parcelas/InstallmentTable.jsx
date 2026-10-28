import { Eye, Pencil, Trash2, Wallet } from 'lucide-react';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import Table from '../Table/Table';
import {
  computeParcelaStatus,
  getValorRecebidoPagamento,
  getValorRestantePagamento,
  parcelaStatusVariant,
} from '../../utils/debtCalculations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';
import styles from './Parcelas.module.css';

export default function InstallmentTable({
  parcelas,
  onView,
  onEdit,
  onDelete,
  onRegisterPayment,
}) {
  const columns = [
    { key: 'parcela', label: 'Parcela', render: (r) => `${r.parcelaNumero}/${r.parcelaTotal}` },
    {
      key: 'vencimento',
      label: 'Vencimento',
      render: (r) => (r.dataVencimento ? formatDate(r.dataVencimento) : '—'),
    },
    {
      key: 'valor',
      label: 'Valor',
      align: 'right',
      render: (r) => formatCurrency(r.valor),
    },
    {
      key: 'pago',
      label: 'Pago',
      align: 'right',
      render: (r) => formatCurrency(getValorRecebidoPagamento(r)),
    },
    {
      key: 'restante',
      label: 'Restante',
      align: 'right',
      render: (r) => formatCurrency(getValorRestantePagamento(r)),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const status = computeParcelaStatus(r);
        return <Badge variant={parcelaStatusVariant(status)}>{status}</Badge>;
      },
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (r) => (
        <div className={shared.tableActions}>
          <Button variant="secondary" size="sm" icon={Eye} onClick={() => onView(r)} title="Ver" />
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onEdit(r)} title="Editar" />
          {getValorRestantePagamento(r) > 0 && (
            <Button variant="primary" size="sm" icon={Wallet} onClick={() => onRegisterPayment(r)} title="Registrar pagamento" />
          )}
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => onDelete(r)} title="Excluir" />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={styles.desktopTable}>
        <div className={shared.tableScroll}>
          <Table columns={columns} data={parcelas} emptyMessage="Sem parcelas." />
        </div>
      </div>

      <div className={styles.mobileCards}>
        {parcelas.length === 0 ? (
          <p className={styles.emptyMessage}>Sem parcelas.</p>
        ) : (
          parcelas.map((parcela) => {
            const status = computeParcelaStatus(parcela);
            return (
              <article key={parcela.id} className={styles.parcelaCard}>
                <div className={styles.cardHeader}>
                  <strong>{parcela.parcelaNumero}/{parcela.parcelaTotal}</strong>
                  <Badge variant={parcelaStatusVariant(status)}>{status}</Badge>
                </div>
                <div className={styles.cardGrid}>
                  <div><span>Vencimento</span><strong>{parcela.dataVencimento ? formatDate(parcela.dataVencimento) : '—'}</strong></div>
                  <div><span>Valor</span><strong>{formatCurrency(parcela.valor)}</strong></div>
                  <div><span>Pago</span><strong>{formatCurrency(getValorRecebidoPagamento(parcela))}</strong></div>
                  <div><span>Restante</span><strong>{formatCurrency(getValorRestantePagamento(parcela))}</strong></div>
                </div>
                <div className={styles.cardActions}>
                  <Button variant="secondary" size="sm" icon={Eye} onClick={() => onView(parcela)}>Ver</Button>
                  <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onEdit(parcela)}>Editar</Button>
                  {getValorRestantePagamento(parcela) > 0 && (
                    <Button variant="primary" size="sm" icon={Wallet} onClick={() => onRegisterPayment(parcela)}>Pagar</Button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
