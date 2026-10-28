import { getDiariaObservacaoText } from '../../utils/diariaObservacaoCalculations';
import styles from './DiariaObservacaoCell.module.css';

export default function DiariaObservacaoCell({ diaria, emptyLabel = '—' }) {
  const text = getDiariaObservacaoText(diaria);

  if (!text) {
    return <span className={styles.empty}>{emptyLabel}</span>;
  }

  return (
    <span className={styles.text} title={text}>
      {text}
    </span>
  );
}
