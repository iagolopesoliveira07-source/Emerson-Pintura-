import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import ObraStatusBadge from '../ObraStatusBadge/ObraStatusBadge';
import WorkProfitChart from './WorkProfitChart';
import CostBreakdownChart from './CostBreakdownChart';
import { formatCurrency } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';
import styles from './Lucros.module.css';

function formatPercent(value) {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export default function WorkProfitCard({ metrics }) {
  const isPrejuizo = metrics.lucroContratual < 0;
  const insufficientData = !metrics.eligibleForProfitChart;
  const dadosParciais = metrics.dadosParciais;

  return (
    <article className={styles.workCard}>
      <div className={styles.workCardHeader}>
        <div className={styles.workCardTitleGroup}>
          <h3 className={styles.workCardTitle}>{metrics.obraNome}</h3>
          <ObraStatusBadge status={metrics.obraEstado} />
          {dadosParciais && (
            <span className={styles.partialBadge}>Dados parciais</span>
          )}
        </div>
        <Link to={`/obras/${metrics.obraId}`} className={styles.viewBtn}>
          <ExternalLink size={16} />
          Ver obra
        </Link>
      </div>

      {insufficientData ? (
        <p className={styles.insufficientData}>Sem dados financeiros suficientes.</p>
      ) : dadosParciais ? (
        <p className={styles.partialDataNote}>Resultado com dados registados.</p>
      ) : null}

      <div className={styles.workMetrics}>
        <div className={shared.detailRow}>
          <span className={shared.detailLabel}>
            {metrics.isPartnership ? 'Valor total da obra' : 'Valor contratado'}
          </span>
          <span className={shared.detailValue}>{formatCurrency(metrics.valorContratado)}</span>
        </div>
        {metrics.extrasTotal > 0.004 ? (
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Inclui extras/serviços</span>
            <span className={shared.detailValue}>{formatCurrency(metrics.extrasTotal)}</span>
          </div>
        ) : null}
        {metrics.isPartnership && metrics.percentagemEmpresa != null ? (
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Participação Emerson</span>
            <span className={shared.detailValue}>{`${metrics.percentagemEmpresa}%`}</span>
          </div>
        ) : null}
        {metrics.isPartnership && metrics.lucroReal != null ? (
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Lucro real (antes da divisão)</span>
            <span className={shared.detailValue}>{formatCurrency(metrics.lucroReal)}</span>
          </div>
        ) : null}
        <div className={shared.detailRow}>
          <span className={shared.detailLabel}>Total recebido</span>
          <span className={shared.detailValue}>{formatCurrency(metrics.totalRecebido)}</span>
        </div>
        <div className={shared.detailRow}>
          <span className={shared.detailLabel}>Total de custos</span>
          <span className={shared.detailValue}>{formatCurrency(metrics.totalCusto)}</span>
        </div>
        <div className={shared.detailRow}>
          <span className={shared.detailLabel}>Diárias</span>
          <span className={shared.detailValue}>{formatCurrency(metrics.totalDiarias)}</span>
        </div>
        <div className={shared.detailRow}>
          <span className={shared.detailLabel}>Gastos</span>
          <span className={shared.detailValue}>{formatCurrency(metrics.totalGastos)}</span>
        </div>
        {!insufficientData && (
          <>
            <div className={`${shared.detailRow} ${styles.highlightRow}`}>
              <span className={shared.detailLabel}>
                {dadosParciais
                  ? 'Saldo com dados registados'
                  : isPrejuizo
                    ? metrics.isPartnership
                      ? 'Prejuízo Emerson'
                      : 'Prejuízo estimado'
                    : metrics.isPartnership
                      ? 'Lucro Emerson'
                      : 'Lucro estimado'}
              </span>
              <span
                className={`${shared.detailValue} ${isPrejuizo ? styles.negative : styles.positive}`}
              >
                {formatCurrency(metrics.lucroContratual)}
              </span>
            </div>
            <div className={shared.detailRow}>
              <span className={shared.detailLabel}>
                {dadosParciais ? 'Resultado realizado (registado)' : 'Resultado realizado'}
              </span>
              <span
                className={`${shared.detailValue} ${
                  metrics.lucroRealizado < 0 ? styles.negative : styles.positive
                }`}
              >
                {formatCurrency(metrics.lucroRealizado)}
              </span>
            </div>
            <div className={shared.detailRow}>
              <span className={shared.detailLabel}>Margem</span>
              <span className={shared.detailValue}>{formatPercent(metrics.margem)}</span>
            </div>
          </>
        )}
      </div>

      {!insufficientData && !dadosParciais && (
        <>
          <h4 className={styles.workChartTitle}>Receita × custos × lucro</h4>
          <WorkProfitChart metrics={metrics} />

          {metrics.custosBreakdown.length > 0 && (
            <>
              <h4 className={styles.workChartTitle}>Composição dos custos</h4>
              <CostBreakdownChart breakdown={metrics.custosBreakdown} />
            </>
          )}
        </>
      )}
    </article>
  );
}
