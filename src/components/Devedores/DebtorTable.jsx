import { ExternalLink, Wallet } from 'lucide-react';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import Table from '../Table/Table';
import { formatCurrency } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import { devedorStatusVariant, DEVEDOR_STATUS } from '../../utils/debtCalculations';
import shared from '../../pages/shared.module.css';
import styles from './Devedores.module.css';

export default function DebtorTable({ debts, onPay, onViewObra }) {
  const columns = [
    {
      key: 'obra',
      label: 'Obra',
      render: (row) => (
        <button type="button" className={styles.linkButton} onClick={() => onViewObra(row.obraId)}>
          <strong>{row.obraNome}</strong>
        </button>
      ),
    },
    { key: 'cliente', label: 'Cliente' },
    {
      key: 'valorTotal',
      label: 'Valor da obra',
      help: HELP.obra.valorAtualizado,
      align: 'right',
      render: (row) => formatCurrency(row.valorTotal),
    },
    {
      key: 'pago',
      label: 'Já recebido',
      help: HELP.obra.recebido,
      align: 'right',
      render: (row) => formatCurrency(row.valorPago),
    },
    {
      key: 'restante',
      label: 'Saldo a receber',
      help: HELP.obra.aReceber,
      align: 'right',
      render: (row) => (
        <div className={styles.saldoCell}>
          <span className={styles.saldoLabel}>Ainda falta receber:</span>
          <span className={styles.restanteDestaque}>{formatCurrency(row.valorRestante)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <Badge variant={devedorStatusVariant()}>{DEVEDOR_STATUS.A_RECEBER}</Badge>
      ),
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
            icon={ExternalLink}
            onClick={() => onViewObra(row.obraId)}
          >
            Ver obra
          </Button>
          <Button variant="primary" size="sm" icon={Wallet} onClick={() => onPay(row)}>
            Registrar pagamento
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={styles.desktopTable}>
        <div className={shared.tableScroll}>
          <Table columns={columns} data={debts} emptyMessage="Nenhuma obra com saldo a receber." />
        </div>
      </div>

      <div className={styles.mobileCards}>
        {debts.length === 0 ? (
          <p className={styles.emptyMessage}>Nenhuma obra com saldo a receber.</p>
        ) : (
          debts.map((debt) => (
            <article key={debt.id} className={styles.debtCard}>
              <div className={styles.debtCardHeader}>
                <div>
                  <button type="button" className={styles.linkButton} onClick={() => onViewObra(debt.obraId)}>
                    <strong>{debt.obraNome}</strong>
                  </button>
                  <div className={styles.debtClient}>Cliente: {debt.cliente}</div>
                </div>
                <Badge variant={devedorStatusVariant()}>{DEVEDOR_STATUS.A_RECEBER}</Badge>
              </div>
              <div className={styles.debtCardGrid}>
                <div>
                  <span>Valor da obra</span>
                  <strong>{formatCurrency(debt.valorTotal)}</strong>
                </div>
                <div>
                  <span>Já recebido</span>
                  <strong>{formatCurrency(debt.valorPago)}</strong>
                </div>
                <div className={styles.debtCardHighlight}>
                  <span>Ainda falta receber</span>
                  <strong className={styles.restanteDestaque}>{formatCurrency(debt.valorRestante)}</strong>
                </div>
              </div>
              <div className={styles.debtCardActions}>
                <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => onViewObra(debt.obraId)}>
                  Ver obra
                </Button>
                <Button variant="primary" size="sm" icon={Wallet} onClick={() => onPay(debt)}>
                  Registrar pagamento
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
