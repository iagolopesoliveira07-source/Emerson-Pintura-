import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import {
  DESPESA_PERIODICIDADE,
  formatPeriodicidadeVisivel,
  formatProgramadaEstado,
  formatProximaOcorrencia,
  formatYearMonth,
} from '../../utils/empresaFinanceiroCalculations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import styles from '../../pages/GastosEmpresa/GastosEmpresa.module.css';

function Field({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className={styles.fieldRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function DespesaProgramadaCard({
  despesa,
  veiculoNome = '',
  historicoAberto = false,
  onToggleHistorico,
  onRegistar,
  onEditar,
}) {
  const info = despesa.info || {};
  const estado = formatProgramadaEstado(despesa, info);
  const proxima = info.proxima;
  const proximaTexto = proxima?.semData
    ? 'Data não definida'
    : proxima?.data
      ? formatDate(proxima.data)
      : proxima?.previsaoMes
        ? formatYearMonth(proxima.previsaoMes)
        : formatProximaOcorrencia(proxima);

  return (
    <article className={styles.infoCard}>
      <div className={styles.infoCardHeader}>
        <h3>{despesa.titulo}</h3>
        <Badge variant={estado === 'Pendente' || estado === 'Por pagar' ? 'warning' : estado.includes('Pago') || estado === 'Concluída' ? 'success' : 'default'}>
          {estado}
        </Badge>
      </div>
      <p className={styles.infoValor}>{formatCurrency(despesa.valor)}</p>
      <Field label="Periodicidade" value={formatPeriodicidadeVisivel(despesa)} />
      {despesa.diaVencimento ? <Field label="Pagamento" value={`Dia ${despesa.diaVencimento}`} /> : null}
      {despesa.funcionarioNome ? <Field label="Associado a" value={despesa.funcionarioNome} /> : null}
      {veiculoNome ? <Field label="Veículo" value={veiculoNome} /> : null}
      {despesa.periodicidade === DESPESA_PERIODICIDADE.PARCELAS ? (
        <>
          <Field label="Parcelas restantes" value={String(despesa.parcelasRestantes ?? 0)} />
          <Field label="Já registadas" value={String(info.pagasRegistadas || 0)} />
          {info.totalRestante != null ? (
            <Field label="Valor restante" value={formatCurrency(info.totalRestante)} />
          ) : null}
        </>
      ) : null}
      {despesa.ivaDeduzido === false && despesa.periodicidade === DESPESA_PERIODICIDADE.PARCELAS ? (
        <Field label="IVA" value="Não deduzido" />
      ) : null}
      {despesa.dataInicio ? <Field label="Início" value={formatDate(despesa.dataInicio)} /> : null}
      {despesa.duracaoMeses ? <Field label="Validade" value={`${despesa.duracaoMeses} meses`} /> : null}
      {despesa.ultimaOcorrenciaMes ? (
        <Field label="Último desconto" value={formatYearMonth(despesa.ultimaOcorrenciaMes)} />
      ) : null}
      <Field label="Próxima" value={proximaTexto} />
      {despesa.observacao ? <p className={styles.cardNota}>{despesa.observacao}</p> : null}
      <div className={styles.veiculoActions}>
        <Button size="sm" onClick={onRegistar}>
          Registar pagamento
        </Button>
        <Button variant="secondary" size="sm" onClick={onToggleHistorico}>
          {historicoAberto ? 'Fechar histórico' : 'Histórico'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onEditar}>
          Editar
        </Button>
      </div>
      {historicoAberto ? (
        <ul className={styles.historicoList}>
          {(info.historico || []).length === 0 ? (
            <li className={styles.meta}>Ainda não há pagamentos registados.</li>
          ) : (
            (info.historico || []).map((item) => (
              <li key={item.id}>
                <span>
                  {item.dataPagamento || item.data ? formatDate(item.dataPagamento || item.data) : '—'}
                  {item.estado === 'pago' ? ' · Pago' : ` · ${item.estado}`}
                </span>
                <strong>{formatCurrency(item.valor)}</strong>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </article>
  );
}
