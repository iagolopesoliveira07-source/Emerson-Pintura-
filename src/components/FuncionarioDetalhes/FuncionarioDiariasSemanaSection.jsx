import { useMemo } from 'react';
import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import DiariaObservacaoCell from './DiariaObservacaoCell';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calcDiariaTotal } from '../../utils/calculations';
import {
  getDiariaDataPagamento,
  isDiariaPendente,
} from '../../utils/fechamentoPagamentoCalculations';
import { groupDiariasBySemana, SEMANA_STATUS } from '../../utils/diariaSemanaCalculations';
import { CheckCircle, Pencil } from 'lucide-react';
import styles from './FuncionarioDiariasSemanaSection.module.css';

function getStatusBadgeVariant(status) {
  if (status === SEMANA_STATUS.PAGO) return 'success';
  if (status === SEMANA_STATUS.PARCIAL) return 'info';
  return 'warning';
}

export default function FuncionarioDiariasSemanaSection({
  diarias,
  fechamentosPagamento,
  onMarcarDiariaPaga,
  onEditarDiaria,
  modoParceiro = false,
}) {
  const semanas = useMemo(
    () => groupDiariasBySemana(diarias, fechamentosPagamento),
    [diarias, fechamentosPagamento]
  );

  if (!diarias.length) {
    return <p className={styles.emptyText}>Sem diárias registadas.</p>;
  }

  return (
    <div className={styles.wrapper}>
      {semanas.map((semana) => {
        const { resumo } = semana;
        return (
          <div key={semana.key} className={styles.semanaBlock}>
            <div className={styles.semanaHeadStatic}>
              <span className={styles.semanaTitle}>{semana.label}</span>
              {modoParceiro ? null : (
                <span className={styles.semanaStatus}>
                  <Badge variant={getStatusBadgeVariant(resumo.status)}>{resumo.status}</Badge>
                </span>
              )}
              <span className={styles.semanaMeta}>
                {resumo.quantidade} {resumo.quantidade === 1 ? 'diária' : 'diárias'}
                {modoParceiro
                  ? ''
                  : ` · ${formatCurrency(resumo.total)}`}
              </span>
            </div>

            <ul className={styles.diariaList}>
              {semana.diarias.map((diaria) => {
                const pendente = isDiariaPendente(diaria, fechamentosPagamento);
                const dataPagamento = getDiariaDataPagamento(diaria, fechamentosPagamento);
                return (
                  <li key={diaria.id} className={styles.diariaRow}>
                    <span className={styles.diariaDate}>
                      {diaria.data ? formatDate(diaria.data) : '—'}
                    </span>
                    <span className={styles.diariaValor}>
                      {modoParceiro ? '—' : formatCurrency(calcDiariaTotal(diaria))}
                    </span>
                    <span className={styles.diariaObs}>
                      <DiariaObservacaoCell diaria={diaria} />
                    </span>
                    {modoParceiro ? null : pendente ? (
                      <Badge variant="warning">Pendente</Badge>
                    ) : (
                      <Badge variant="success">
                        {dataPagamento ? `Pago` : 'Pago'}
                      </Badge>
                    )}
                    <span className={styles.diariaAcoes}>
                      {onEditarDiaria ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Pencil}
                          title="Editar diária"
                          aria-label="Editar diária"
                          onClick={() => onEditarDiaria(diaria)}
                        />
                      ) : null}
                      {!modoParceiro && pendente && onMarcarDiariaPaga ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={CheckCircle}
                          title="Marcar como pago"
                          aria-label="Marcar como pago"
                          onClick={() => onMarcarDiariaPaga(diaria)}
                        />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
