import Button from '../Button/Button';
import DiariaObservacaoCell from './DiariaObservacaoCell';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calcDiariaTotal } from '../../utils/calculations';
import { groupDiariasPendentesPorSemana } from '../../utils/fechamentoPagamentoCalculations';
import styles from './FechamentoPagamento.module.css';

function weekLabel(week) {
  if (!week.inicio || !week.fim) return 'Sem data';
  return `Semana ${formatDate(week.inicio)} — ${formatDate(week.fim)}`;
}

export default function DiariasPagamentoSelector({
  diarias = [],
  selectedIds = [],
  onChange,
}) {
  const weeks = groupDiariasPendentesPorSemana(diarias);
  const selected = new Set(selectedIds);

  const setSelected = (nextIds) => {
    onChange(nextIds);
  };

  const toggleDiaria = (id) => {
    if (selected.has(id)) {
      setSelected(selectedIds.filter((item) => item !== id));
      return;
    }
    setSelected([...selectedIds, id]);
  };

  const toggleWeek = (weekDiarias) => {
    const ids = weekDiarias.map((item) => item.id);
    const allSelected = ids.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(selectedIds.filter((id) => !ids.includes(id)));
      return;
    }
    const next = new Set(selectedIds);
    ids.forEach((id) => next.add(id));
    setSelected([...next]);
  };

  if (weeks.length === 0) {
    return <p className={styles.infoText}>Nenhuma diária pendente neste funcionário.</p>;
  }

  return (
    <div className={styles.weekList}>
      {weeks.map((week) => {
        const ids = week.diarias.map((item) => item.id);
        const selectedCount = ids.filter((id) => selected.has(id)).length;
        const weekTotal = week.diarias.reduce((sum, item) => sum + calcDiariaTotal(item), 0);
        const allSelected = selectedCount === ids.length && ids.length > 0;

        return (
          <section key={week.key} className={styles.weekGroup}>
            <div className={styles.weekHeader}>
              <div>
                <strong>{weekLabel(week)}</strong>
                <p className={styles.pendenteMeta}>
                  {week.diarias.length} {week.diarias.length === 1 ? 'diária' : 'diárias'} ·{' '}
                  {formatCurrency(weekTotal)}
                  {selectedCount > 0 ? ` · ${selectedCount} seleccionada(s)` : ''}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => toggleWeek(week.diarias)}>
                {allSelected ? 'Retirar semana inteira' : 'Selecionar semana inteira'}
              </Button>
            </div>
            <ul className={styles.weekDiarias}>
              {week.diarias.map((diaria) => (
                <li key={diaria.id} className={styles.weekDiariaItem}>
                  <label className={styles.weekDiariaLabel}>
                    <input
                      type="checkbox"
                      checked={selected.has(diaria.id)}
                      onChange={() => toggleDiaria(diaria.id)}
                    />
                    <span className={styles.weekDiariaMain}>
                      <span className={styles.weekDiariaDate}>
                        {diaria.data ? formatDate(diaria.data) : 'Sem data'}
                      </span>
                      <DiariaObservacaoCell diaria={diaria} emptyLabel="Sem observação" />
                    </span>
                    <strong>{formatCurrency(calcDiariaTotal(diaria))}</strong>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
