import {
  calcDiasTrabalhadosObra,
  calcDiasPorFuncionarioObra,
  calcTotalDiarias,
} from '../../utils/diariaCalculations';
import { formatDiariaQuantidade, filterDiariasDaObra } from '../../utils/diariaObraAlocacao';
import { formatCurrency } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';
import styles from './ObraDiasTrabalhadosSection.module.css';

export default function ObraDiasTrabalhadosSection({ obra, diarias, funcionarios }) {
  const obraDiarias = filterDiariasDaObra(diarias, obra.id);
  const totalDias = calcDiasTrabalhadosObra(obra.id, diarias);
  const porFuncionario = calcDiasPorFuncionarioObra(obra.id, diarias, funcionarios);
  const totalValor = calcTotalDiarias(obraDiarias, { obraId: obra.id });

  if (obraDiarias.length === 0) {
    return (
      <div className={shared.detailCard}>
        <h3 className={shared.detailCardTitle}>Dias trabalhados</h3>
        <p className={styles.emptyMessage}>
          Nenhuma diária registada nesta obra. Os dias trabalhados são calculados apenas a partir
          das diárias cadastradas.
        </p>
      </div>
    );
  }

  return (
    <div className={shared.detailCard}>
      <h3 className={shared.detailCardTitle}>Dias trabalhados</h3>

      <div className={styles.summaryRow}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Dias trabalhados registados</span>
          <span className={styles.summaryValue}>{formatDiariaQuantidade(totalDias)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total de diárias</span>
          <span className={styles.summaryValueHighlight}>{formatCurrency(totalValor)}</span>
        </div>
      </div>

      {porFuncionario.length > 0 && (
        <div className={styles.funcionariosBlock}>
          <h4 className={styles.funcionariosTitle}>Funcionários</h4>
          <ul className={styles.funcionariosList}>
            {porFuncionario.map((entry) => (
              <li key={entry.funcionarioId} className={styles.funcionarioRow}>
                <span className={styles.funcionarioNome}>{entry.nome}</span>
                <span className={styles.funcionarioDias}>
                  {formatDiariaQuantidade(entry.dias)} {entry.dias === 1 ? 'dia' : 'dias'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={styles.nota}>
        Baseado somente nas diárias registadas no sistema. Não inclui dias anteriores ao controlo
        detalhado que não foram cadastrados.
      </p>
    </div>
  );
}
