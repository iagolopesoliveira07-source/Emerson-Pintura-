import { formatCurrency } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';
import styles from './Lucros.module.css';

function RankingList({ title, items, variant }) {
  return (
    <div className={shared.detailCard}>
      <h3 className={shared.detailCardTitle}>{title}</h3>
      {items.length === 0 ? (
        <p className={shared.mutedCenter}>Sem obras para mostrar.</p>
      ) : (
        <ol className={styles.rankingList}>
          {items.map((item, index) => (
            <li key={item.obraId} className={styles.rankingItem}>
              <span className={styles.rankingPosition}>{index + 1}º</span>
              <span className={styles.rankingName}>{item.obraNome}</span>
              <span
                className={`${styles.rankingValue} ${
                  variant === 'worst' || item.lucroContratual < 0 ? styles.negative : styles.positive
                }`}
              >
                {formatCurrency(item.lucroContratual)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function ProfitRanking({ metrics }) {
  const withData = metrics.filter((m) => m.eligibleForProfitChart);
  const best = [...withData].sort((a, b) => b.lucroContratual - a.lucroContratual).slice(0, 5);
  const worst = [...withData].sort((a, b) => a.lucroContratual - b.lucroContratual).slice(0, 5);

  return (
    <div className={styles.rankingGrid}>
      <RankingList title="Obras mais lucrativas" items={best} variant="best" />
      <RankingList title="Obras com pior resultado" items={worst} variant="worst" />
    </div>
  );
}
