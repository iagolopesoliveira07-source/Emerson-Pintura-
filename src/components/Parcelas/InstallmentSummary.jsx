import Card from '../Card/Card';
import { formatCurrency } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';

export default function InstallmentSummary({ summary }) {
  return (
    <div className={shared.statsRow}>
      <Card title="Total de parcelas" value={String(summary.totalParcelas)} iconColor="blue" />
      <Card title="Pagas" value={String(summary.pagas)} iconColor="green" />
      <Card title="Em aberto" value={String(summary.emAberto)} iconColor="orange" />
      <Card title="Em atraso" value={String(summary.emAtraso)} iconColor="red" />
      <Card title="Valor recebido" value={formatCurrency(summary.valorRecebido)} iconColor="cyan" />
      <Card title="Valor a receber" value={formatCurrency(summary.valorAReceber)} iconColor="blue" />
    </div>
  );
}
