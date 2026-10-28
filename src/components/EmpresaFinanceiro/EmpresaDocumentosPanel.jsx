import { DOCUMENTO_STATUS, DOCUMENTO_STATUS_LABELS } from '../../constants/empresaIva';
import { filterGastosDocumentos, getDocumentoStatus, summarizeDocumentos } from '../../utils/empresaDocumentos';
import { getGastoEmpresaValor } from '../../utils/gastoEmpresaCalculations';
import { isNotaCredito, getDocumentoNumero } from '../../utils/gastoDocumentoTipo';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { formatYearMonth, getYearMonth } from '../../utils/empresaFinanceiroCalculations';
import { GASTOS_EMPRESA_PERIOD_PRESETS, getPeriodRange } from '../../utils/periodFilter';
import { monthToDateRange } from '../../utils/ivaCalculations';
import Button from '../Button/Button';
import styles from '../../pages/GastosEmpresa/GastosEmpresa.module.css';

export default function EmpresaDocumentosPanel({
  gastos = [],
  yearMonth,
  onYearMonthChange,
  periodPreset,
  onPeriodPresetChange,
  filtroStatus,
  onFiltroStatusChange,
  onAbrir,
  onMarcarStatus,
}) {
  const mes = yearMonth || getYearMonth();
  const range =
    periodPreset === 'este_mes'
      ? monthToDateRange(mes)
      : getPeriodRange(periodPreset);
  const resumo = summarizeDocumentos(gastos, { range });
  const lista = filterGastosDocumentos(gastos, { status: filtroStatus, range }).sort((a, b) =>
    String(b.data || '').localeCompare(String(a.data || ''))
  );

  const stats = [
    ['total', 'Total de gastos', resumo.total, ''],
    ['fatura_anexada', 'Com fatura', resumo.faturaAnexada, DOCUMENTO_STATUS.FATURA_ANEXADA],
    ['sem_documento', 'Documentos em falta', resumo.semDocumento, DOCUMENTO_STATUS.SEM_DOCUMENTO],
    ['prontos', 'Prontos', resumo.prontos, DOCUMENTO_STATUS.PRONTA_CONTABILIDADE],
    ['enviados', 'Enviados', resumo.enviados, DOCUMENTO_STATUS.ENVIADA_CONTABILIDADE],
  ];

  const tituloMes = periodPreset === 'este_mes' ? formatYearMonth(mes) : '';

  return (
    <section>
      <h2 className={styles.sectionTitle}>
        Documentos para organizar{tituloMes ? ` — ${tituloMes}` : ''}
      </h2>
      <div className={styles.docFilters}>
        {GASTOS_EMPRESA_PERIOD_PRESETS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={periodPreset === item.id ? 'primary' : 'secondary'}
            onClick={() => onPeriodPresetChange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className={styles.resumoGrid}>
        {periodPreset === 'este_mes' ? (
          <label className={styles.resumoCard}>
            <span>Mês</span>
            <input
              type="month"
              value={mes}
              onChange={(e) => onYearMonthChange(e.target.value)}
              aria-label="Mês da contabilidade"
            />
            <small>{formatYearMonth(mes)}</small>
          </label>
        ) : null}
        {stats.map(([id, label, value, status]) => (
          <button
            key={id}
            type="button"
            className={`${styles.resumoCard} ${styles.docStat} ${filtroStatus === status ? styles.docStatActive : ''}`}
            onClick={() => onFiltroStatusChange(status)}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
      <p className={styles.nota}>
        Total do período: {formatCurrency(resumo.totalValor)}. O estado financeiro do gasto não muda aqui.
      </p>

      <div className={styles.docFilters}>
        {[['','Todos'], ...Object.entries(DOCUMENTO_STATUS_LABELS)].map(([id, label]) => (
          <Button
            key={id || 'todos'}
            size="sm"
            variant={filtroStatus === id ? 'primary' : 'secondary'}
            onClick={() => onFiltroStatusChange(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <ul className={styles.compromissoList}>
        {lista.length === 0 ? (
          <li className={styles.nota}>Nenhum gasto neste filtro.</li>
        ) : (
          lista.map((gasto) => {
            const status = getDocumentoStatus(gasto);
            return (
              <li key={gasto.id} className={styles.compromissoItem}>
                <div>
                  <strong>{gasto.descricao || gasto.categoria}</strong>
                  <span>
                    {gasto.data ? formatDate(gasto.data) : ''}
                    {gasto.fornecedorNome ? ` · ${gasto.fornecedorNome}` : ''}
                    {getDocumentoNumero(gasto)
                      ? ` · ${isNotaCredito(gasto) ? 'NC' : 'Fat.'} ${getDocumentoNumero(gasto)}`
                      : ''}
                  </span>
                </div>
                <div className={styles.compromissoValor}>
                  <span>{DOCUMENTO_STATUS_LABELS[status]}</span>
                  <strong>{formatCurrency(getGastoEmpresaValor(gasto))}</strong>
                  <Button size="sm" variant="secondary" onClick={() => onAbrir(gasto)}>
                    Abrir
                  </Button>
                  {status === DOCUMENTO_STATUS.FATURA_ANEXADA ? (
                    <Button size="sm" onClick={() => onMarcarStatus(gasto, DOCUMENTO_STATUS.PRONTA_CONTABILIDADE)}>
                      Pronta
                    </Button>
                  ) : null}
                  {status === DOCUMENTO_STATUS.PRONTA_CONTABILIDADE ? (
                    <Button size="sm" onClick={() => onMarcarStatus(gasto, DOCUMENTO_STATUS.ENVIADA_CONTABILIDADE)}>
                      Enviada
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
