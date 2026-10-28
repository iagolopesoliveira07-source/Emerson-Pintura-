import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import Modal from '../Modal/Modal';
import {
  DESPESA_NATUREZA,
  DESPESA_PERIODICIDADE,
  buildHistoricoMesesProgramada,
  formatPeriodicidadeVisivel,
  formatProximaOcorrencia,
  formatYearMonth,
  getCoberturaMeses,
  getEquivalenteMensal,
  getEstadoFixo,
  getEstadoFixoBadgeVariant,
  getTotalRestanteParcelas,
  countPagamentosProgramada,
  ESTADO_FIXO,
  isRecorrenciaConfirmada,
  summarizeProgramada,
  summarizeVeiculoCustos,
  temPagamentoRegistadoNoPeriodo,
  VALOR_RECUPERAR_STATUS,
} from '../../utils/empresaFinanceiroCalculations';
import { formatCoberturaLabel } from '../../utils/empresaVisoesFinanceiro';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getGastoEmpresaValor } from '../../utils/gastoEmpresaCalculations';
import styles from '../../pages/GastosEmpresa/GastosEmpresa.module.css';

function Field({ label, value }) {
  if (value == null || value === '') {
    return (
      <div className={styles.fieldRow}>
        <span>{label}</span>
        <strong>Não informado</strong>
      </div>
    );
  }
  return (
    <div className={styles.fieldRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FieldKnown({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className={styles.fieldRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function dataUltimoPagamento(programada, gastos) {
  const ultimo = summarizeProgramada(programada, { gastos }).historico?.find((item) => item.estado === 'pago');
  return ultimo ? ultimo.dataPagamento || ultimo.data : '';
}

function HistoricoPagamentos({ programada, gastos = [] }) {
  const meses = buildHistoricoMesesProgramada(programada, { gastos });
  const pagas = meses.filter((item) => item.estado === 'Pago' && item.gasto);
  const totalPago = pagas.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);

  return (
    <>
      <h3 className={styles.grupoTitulo} style={{ marginTop: '0.75rem' }}>
        Histórico mensal
      </h3>
      {pagas.length ? (
        <FieldKnown label="Total já descontado" value={formatCurrency(totalPago)} />
      ) : null}
      {meses.length === 0 ? (
        <p className={styles.meta}>Ainda não há meses no histórico.</p>
      ) : (
        <ul className={styles.historicoList}>
          {meses.map((item) => (
            <li key={item.id}>
              <span>
                {item.label}
                {' — '}
                {item.statusLabel || item.estado}
                {item.periodoCoberto ? ` · Cobertura: ${item.periodoCoberto}` : ''}
              </span>
              <strong>{item.valor != null ? formatCurrency(item.valor) : ''}</strong>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ProgramadaDetalhe({ despesa, gastos, veiculoNome, mesOcorrencia = '' }) {
  const info = summarizeProgramada(despesa, { gastos });
  const estado =
    !mesOcorrencia || !isRecorrenciaConfirmada(despesa) || despesa.periodicidade === DESPESA_PERIODICIDADE.UNICA
      ? getEstadoFixo(despesa, { gastos })
      : countPagamentosProgramada(gastos, despesa.id, mesOcorrencia) > 0
        ? ESTADO_FIXO.PAGO
        : getEstadoFixo(despesa, { gastos, yearMonth: mesOcorrencia });
  const coberturaMeses = getCoberturaMeses(despesa);
  const equivalente = getEquivalenteMensal(
    despesa.valor,
    isRecorrenciaConfirmada(despesa) ? getPeriodicidadeOuCobertura(despesa) : coberturaMeses
  );
  const proxima = isRecorrenciaConfirmada(despesa) ? info.proxima : null;
  const proximaTexto = !proxima
    ? 'Sem próxima cobrança definida'
    : proxima.semData
      ? 'Sem próxima cobrança definida'
      : proxima.data
        ? formatDate(proxima.data)
        : proxima.previsaoMes
          ? formatYearMonth(proxima.previsaoMes)
          : formatProximaOcorrencia(proxima);
  const ultimoPago = (info.historico || []).find((item) => item.estado === 'pago');
  const pagoNoMes =
    mesOcorrencia
      ? countPagamentosProgramada(gastos, despesa.id, mesOcorrencia) > 0
      : estado.id === 'pago';
  const dataDescontoMes = pagoNoMes
    ? (info.historico || []).find((item) => {
        const mes =
          item.mesReferencia ||
          String(item.dataPagamento || item.data || '').slice(0, 7);
        return item.estado === 'pago' && (!mesOcorrencia || mes === mesOcorrencia);
      })
    : null;

  return (
    <>
      <div className={styles.infoCardHeader}>
        <h3>{despesa.titulo}</h3>
        <Badge variant={getEstadoFixoBadgeVariant(estado)}>{estado.label}</Badge>
      </div>
      <p className={styles.infoValor}>{formatCurrency(despesa.valor)}</p>
      <Field label="Periodicidade" value={formatPeriodicidadeVisivel(despesa)} />
      {despesa.diaVencimento ? (
        <div className={`${styles.fieldRow} ${styles.fieldEmphasize}`}>
          <span>Pagamento</span>
          <strong>Dia {despesa.diaVencimento}</strong>
        </div>
      ) : null}
      {despesa.funcionarioNome ? <FieldKnown label="Associado a" value={despesa.funcionarioNome} /> : null}
      {veiculoNome ? <FieldKnown label="Veículo" value={veiculoNome} /> : null}
      {despesa.periodicidade === DESPESA_PERIODICIDADE.PARCELAS ? (
        <>
          <Field label="Parcelas restantes" value={String(despesa.parcelasRestantes ?? 'Não informado')} />
          <FieldKnown label="Parcelas registadas" value={String(info.pagasRegistadas || 0)} />
          {info.totalRestante != null ? (
            <FieldKnown label="Total restante" value={formatCurrency(info.totalRestante)} />
          ) : null}
        </>
      ) : null}
      {despesa.ivaDeduzido === false && despesa.periodicidade === DESPESA_PERIODICIDADE.PARCELAS ? (
        <FieldKnown label="IVA" value="Não deduzido" />
      ) : null}
      {pagoNoMes && dataDescontoMes ? (
        <>
          <FieldKnown
            label="Descontado este mês em"
            value={formatDate(dataDescontoMes.dataPagamento || dataDescontoMes.data)}
          />
          <FieldKnown
            label="Valor descontado"
            value={formatCurrency(getGastoEmpresaValor(dataDescontoMes) || dataDescontoMes.valor)}
          />
        </>
      ) : ultimoPago ? (
        <>
          <FieldKnown
            label="Último desconto"
            value={formatDate(ultimoPago.dataPagamento || ultimoPago.data)}
          />
          <FieldKnown
            label="Valor descontado"
            value={formatCurrency(getGastoEmpresaValor(ultimoPago) || ultimoPago.valor)}
          />
        </>
      ) : null}
      {coberturaMeses ? (
        <FieldKnown
          label="Cobertura / validade"
          value={formatCoberturaLabel(despesa, { gastos }) || `${coberturaMeses} ${coberturaMeses === 1 ? 'mês' : 'meses'}`}
        />
      ) : null}
      {equivalente != null ? (
        <FieldKnown
          label={isRecorrenciaConfirmada(despesa) ? 'Equivalente mensal' : 'Equivalente do período'}
          value={`${formatCurrency(equivalente)}/mês`}
        />
      ) : null}
      {!isRecorrenciaConfirmada(despesa) && equivalente != null ? (
        <p className={styles.analiticoTag}>Referência analítica — não é uma despesa mensal nem a próxima cobrança.</p>
      ) : null}
      {despesa.ultimaOcorrenciaMes && !ultimoPago ? (
        <FieldKnown label="Último desconto" value={formatYearMonth(despesa.ultimaOcorrenciaMes)} />
      ) : null}
      <Field
        label="Próxima obrigação"
        value={proxima && proximaTexto !== 'Sem próxima cobrança definida' ? proximaTexto : 'Sem próxima cobrança definida'}
      />
      {despesa.observacao ? <p className={styles.cardNota}>{despesa.observacao}</p> : null}
      <HistoricoPagamentos programada={despesa} gastos={gastos} />
    </>
  );
}

function getPeriodicidadeOuCobertura(despesa) {
  if (despesa.periodicidade === DESPESA_PERIODICIDADE.ANUAL) return 12;
  if (despesa.periodicidade === DESPESA_PERIODICIDADE.SEMESTRAL) return 6;
  if (despesa.periodicidade === DESPESA_PERIODICIDADE.TRIMESTRAL) return 3;
  if (despesa.periodicidade === DESPESA_PERIODICIDADE.MENSAL || despesa.periodicidade === DESPESA_PERIODICIDADE.PARCELAS) {
    return 1;
  }
  return getCoberturaMeses(despesa);
}

export default function GastoFixoDetalheModal({
  isOpen,
  onClose,
  linha,
  gastos = [],
  programadas = [],
  valoresRecuperar = [],
  onRegistar,
  onEditar,
  onEditarVeiculo,
  onMarcarRecuperado,
}) {
  if (!isOpen || !linha) return null;

  const veiculo = linha.veiculo;
  const isVeiculo = linha.kind === 'veiculo' && veiculo;
  const custos = isVeiculo ? summarizeVeiculoCustos(veiculo, gastos, programadas) : null;
  const prestacao = custos?.prestacaoProgramada || null;
  const seguro = custos?.seguroProgramado;
  const recuperar = isVeiculo
    ? (valoresRecuperar || []).filter((item) => item.veiculoId === veiculo.id)
    : [];
  const programada = linha.programada;
  const title = isVeiculo ? veiculo.nome : programada?.titulo || linha.titulo;
  const seguroRelacionado =
    !isVeiculo && programada?.natureza === DESPESA_NATUREZA.PRESTACAO && programada.veiculoId
      ? (programadas || []).find(
          (item) =>
            item.veiculoId === programada.veiculoId &&
            item.natureza === DESPESA_NATUREZA.SEGURO &&
            item.ativo !== false
        )
      : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      {isVeiculo ? (
        <div className={styles.detalheBody}>
          {veiculo.propriedadeEmpresa === false ? (
            <p className={styles.nota}>
              Veículo não está em nome da empresa. A empresa paga combustível, manutenção e Via Verde.
            </p>
          ) : null}

          {prestacao ? (
            <>
              <h3 className={styles.grupoTitulo} style={{ marginTop: 0 }}>
                Prestação
              </h3>
              <Field label="Prestação mensal" value={formatCurrency(prestacao.valor)} />
              <Field label="Parcelas restantes" value={String(prestacao.parcelasRestantes ?? 'Não informado')} />
              <Field
                label="IVA"
                value={
                  prestacao.ivaDeduzido === false
                    ? 'Não deduzido'
                    : prestacao.ivaDeduzido === true
                      ? 'Deduzido'
                      : 'Não informado'
                }
              />
              {getTotalRestanteParcelas(prestacao) ? (
                <FieldKnown label="Total restante" value={formatCurrency(getTotalRestanteParcelas(prestacao))} />
              ) : null}
            </>
          ) : /pronto/i.test(veiculo.notas || '') ? (
            <FieldKnown label="Compra" value="Paga a pronto" />
          ) : veiculo.propriedadeEmpresa !== false ? (
            <FieldKnown label="Prestação" value="Não tem" />
          ) : null}

          {seguro ? (
            <>
              <h3 className={styles.grupoTitulo}>Seguro</h3>
              <Field label="Seguro" value={formatCurrency(seguro.valor)} />
              <Field label="Periodicidade" value={formatPeriodicidadeVisivel(seguro)} />
              {getCoberturaMeses(seguro) ? (
                <FieldKnown
                  label="Cobertura / validade"
                  value={formatCoberturaLabel(seguro, { gastos })}
                />
              ) : null}
              {dataUltimoPagamento(seguro, gastos) ? (
                <FieldKnown
                  label="Último pagamento"
                  value={formatDate(dataUltimoPagamento(seguro, gastos))}
                />
              ) : seguro.dataInicio ? (
                <FieldKnown label="Início do seguro" value={formatDate(seguro.dataInicio)} />
              ) : null}
            </>
          ) : null}

          {recuperar.map((item) => (
            <div key={item.id} className={styles.recuperarBox}>
              <FieldKnown label="IVA a recuperar" value={formatCurrency(item.valor)} />
              <FieldKnown label="Previsão" value={formatYearMonth(item.previsaoMes)} />
              <Field
                label="Estado"
                value={item.status === VALOR_RECUPERAR_STATUS.RECEBIDO ? 'Recebido' : 'Pendente'}
              />
              {item.status !== VALOR_RECUPERAR_STATUS.RECEBIDO && onMarcarRecuperado ? (
                <div className={styles.veiculoActions}>
                  <Button size="sm" onClick={() => onMarcarRecuperado(item)}>
                    Marcar recebido
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {prestacao ? (
            <HistoricoPagamentos programada={prestacao} gastos={gastos} />
          ) : null}
          {seguro ? (
            <>
              <h3 className={styles.grupoTitulo}>Histórico do seguro</h3>
              <HistoricoPagamentos programada={seguro} gastos={gastos} />
            </>
          ) : null}

          <div className={styles.veiculoActions}>
            {prestacao && onRegistar && !temPagamentoRegistadoNoPeriodo(prestacao, { gastos }) ? (
              <Button size="sm" onClick={() => onRegistar(prestacao)}>
                Marcar como descontado neste mês
              </Button>
            ) : null}
            {seguro && onRegistar && !temPagamentoRegistadoNoPeriodo(seguro, { gastos }) ? (
              <Button size="sm" onClick={() => onRegistar(seguro)}>
                Descontado neste mês (seguro)
              </Button>
            ) : null}
            {prestacao && onEditar ? (
              <Button variant="secondary" size="sm" onClick={() => onEditar(prestacao)}>
                Editar prestação
              </Button>
            ) : null}
            {onEditarVeiculo ? (
              <Button variant="secondary" size="sm" onClick={() => onEditarVeiculo(veiculo)}>
                Editar veículo
              </Button>
            ) : null}
          </div>
        </div>
      ) : programada ? (
        <div className={styles.detalheBody}>
          <ProgramadaDetalhe
            despesa={programada}
            gastos={gastos}
            veiculoNome={veiculo?.nome || ''}
            mesOcorrencia={linha.mesOcorrencia || ''}
          />
          {seguroRelacionado ? (
            <>
              <h3 className={styles.grupoTitulo}>Seguro</h3>
              <Field label="Seguro" value={formatCurrency(seguroRelacionado.valor)} />
              <Field
                label="Periodicidade"
                value={formatPeriodicidadeVisivel(seguroRelacionado)}
              />
              <Field
                label="Início do seguro"
                value={seguroRelacionado.dataInicio ? formatDate(seguroRelacionado.dataInicio) : 'Não informado'}
              />
            </>
          ) : null}
          <div className={styles.veiculoActions}>
            {onRegistar && !temPagamentoRegistadoNoPeriodo(programada, { gastos, yearMonth: linha.mesOcorrencia }) ? (
              <Button size="sm" onClick={() => onRegistar(programada)}>
                Descontado neste mês
              </Button>
            ) : null}
            {onEditar ? (
              <Button variant="secondary" size="sm" onClick={() => onEditar(programada)}>
                Editar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
