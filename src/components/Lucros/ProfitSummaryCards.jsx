import Card from '../Card/Card';
import HelpTip from '../HelpTip/HelpTip';
import { formatCurrency } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import shared from '../../pages/shared.module.css';
import styles from './Lucros.module.css';

function formatPercent(value) {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export default function ProfitSummaryCards({ summary }) {
  const {
    lucroTotal,
    lucroRealizadoTotal,
    totalContratado,
    totalRecebido,
    totalCustos,
    margemMedia,
    partialMetrics = [],
  } = summary;

  return (
    <>
      {partialMetrics.length > 0 && (
        <p className={styles.summaryPartialNote} role="note">
          Totais abaixo consideram apenas obras com dados completos ({partialMetrics.length}{' '}
          {partialMetrics.length === 1 ? 'obra excluída' : 'obras excluídas'} por dados parciais).
          {' '}
          <HelpTip text={HELP.relatorio.dadosIncompletos} />
        </p>
      )}
      <div className={shared.statsRow}>
        <Card
          title="Posição sobre o contratado"
          value={formatCurrency(lucroTotal)}
          subtitle="Valor da obra menos custos. Não é dinheiro recebido."
          iconColor={lucroTotal >= 0 ? 'green' : 'red'}
          help={HELP.obra.lucroFinal}
        />
        <Card
          title="Recebido menos custos da obra"
          value={formatCurrency(lucroRealizadoTotal)}
          subtitle="Leitura de cada obra. Nas parcerias não substitui o Acerto."
          iconColor={lucroRealizadoTotal >= 0 ? 'green' : 'red'}
          help={HELP.relatorio.resultadoPeriodo}
        />
        <Card title="Total contratado" value={formatCurrency(totalContratado)} subtitle="Orçamento. Não é entrada do período." iconColor="blue" help={HELP.obra.valorOriginal} />
        <Card title="Total recebido" value={formatCurrency(totalRecebido)} iconColor="cyan" help={HELP.obra.recebido} />
        <Card title="Total de custos" value={formatCurrency(totalCustos)} iconColor="orange" />
        <Card title="Margem média" value={formatPercent(margemMedia)} iconColor="green" />
      </div>
    </>
  );
}
