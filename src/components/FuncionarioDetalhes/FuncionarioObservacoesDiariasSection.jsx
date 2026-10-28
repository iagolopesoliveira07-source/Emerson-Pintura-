import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import { calcDiariaTotal } from '../../utils/calculations';
import Button from '../Button/Button';
import { Pencil } from 'lucide-react';
import shared from '../../pages/shared.module.css';
import styles from './ObservacoesDiarias.module.css';

export default function FuncionarioObservacoesDiariasSection({
  resumo,
  modoParceiro = false,
  diarias = [],
  onEditarDiaria,
}) {
  if (!resumo) return null;

  const byId = new Map((diarias || []).map((d) => [String(d.id), d]));

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>Observações nas diárias</h3>
      </div>

      <p className={styles.countText}>
        Observações {modoParceiro ? 'registadas' : 'no período'}: <strong>{resumo.quantidade}</strong>
      </p>

      <div className={styles.list}>
        {resumo.observacoes.length === 0 ? (
          <p className={styles.emptyText}>
            {modoParceiro
              ? 'Nenhuma observação nas diárias de presença.'
              : 'Nenhuma observação nas diárias pendentes deste período.'}
          </p>
        ) : (
          resumo.observacoes.map((item) => {
            const diaria = byId.get(String(item.diariaId));
            return (
              <div key={item.diariaId} className={styles.item}>
                <span className={styles.date}>{formatDateOrNotInformed(item.data)}</span>
                <span className={styles.valor}>
                  {modoParceiro || !diaria ? '—' : formatCurrency(calcDiariaTotal(diaria))}
                </span>
                <span className={styles.text}>{item.observacao}</span>
                {onEditarDiaria && diaria ? (
                  <span className={styles.acoes}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      title="Editar diária"
                      aria-label="Editar diária"
                      onClick={() => onEditarDiaria(diaria)}
                    />
                  </span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
