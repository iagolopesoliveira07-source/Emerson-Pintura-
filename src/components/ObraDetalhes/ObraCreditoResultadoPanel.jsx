import { formatCurrency, formatPercent } from '../../utils/formatters';
import styles from './ObraCredito.module.css';

export default function ObraCreditoResultadoPanel({ summary }) {
  if (!summary) return null;

  const base = summary.baseEstimativa || {};
  const temConfirmado = (summary.servicosControlados || []).length > 0;
  const temCustosNovos = summary.custosNovosRegistados > 0;
  const temMargem = temConfirmado && summary.margemMediaPonderada != null;
  const podeEstimar = Boolean(base.representativa && summary.margemMediaPonderada != null);

  return (
    <section className={styles.sheetBlock} aria-labelledby="resultado-financeiro-title">
      <h3 id="resultado-financeiro-title" className={styles.sheetTitle}>
        Resultado financeiro
      </h3>

      {temCustosNovos ? (
        <div className={styles.custoLinha}>
          <span>Custos detalhados registrados daqui para frente</span>
          <strong>{formatCurrency(summary.custosNovosRegistados)}</strong>
        </div>
      ) : null}

      {temConfirmado ? (
        <div className={styles.custoLinha}>
          <span>Resultado confirmado</span>
          <strong>{formatCurrency(summary.lucroConfirmado)}</strong>
        </div>
      ) : null}

      {temMargem ? (
        <div className={styles.custoLinha}>
          <span>Margem média</span>
          <strong>{formatPercent(summary.margemMediaPonderada)}</strong>
        </div>
      ) : null}

      {podeEstimar && summary.lucroEstimadoRestante != null ? (
        <div className={styles.custoLinha}>
          <span>Lucro estimado no restante</span>
          <strong>≈ {formatCurrency(summary.lucroEstimadoRestante)}</strong>
        </div>
      ) : null}

      {!temConfirmado && !temCustosNovos ? (
        <p className={styles.hint}>
          As estimativas estarão disponíveis após o início do controle detalhado dos novos
          serviços.
        </p>
      ) : !podeEstimar ? (
        <p className={styles.hint}>
          As estimativas estarão disponíveis após o início do controle detalhado dos novos
          serviços.
        </p>
      ) : null}
    </section>
  );
}
