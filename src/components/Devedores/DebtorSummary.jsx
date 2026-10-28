import Card from '../Card/Card';
import { HelpLabel } from '../HelpTip/HelpTip';
import { formatCurrency } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import shared from '../../pages/shared.module.css';
import styles from './Devedores.module.css';

export default function DebtorSummary({ summary }) {
  return (
    <>
      <div className={styles.totalBanner} role="status">
        <HelpLabel className={styles.totalBannerLabel} text={HELP.recebimento.aReceber}>
          Total a receber
        </HelpLabel>
        <span className={styles.totalBannerValue}>{formatCurrency(summary.totalAReceber)}</span>
        <span className={styles.totalBannerHint}>
          Soma de todos os saldos pendentes das obras
        </span>
      </div>

      <div className={shared.statsRow}>
        <Card title="Obras pendentes" value={String(summary.obrasPendentes)} iconColor="orange" />
        <Card title="Clientes com saldo" value={String(summary.clientesDevedores)} iconColor="cyan" />
      </div>
    </>
  );
}
