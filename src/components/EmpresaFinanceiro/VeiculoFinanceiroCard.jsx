import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import {
  formatPeriodicidadeVisivel,
  getSeguroFim,
  getTotalRestanteParcelas,
  VALOR_RECUPERAR_STATUS,
  formatYearMonth,
} from '../../utils/empresaFinanceiroCalculations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import { HelpLabel } from '../HelpTip/HelpTip';
import { getVeiculoCombustivelLabel } from '../../utils/empresaIvaRules';
import styles from '../../pages/GastosEmpresa/GastosEmpresa.module.css';

function Field({ label, value, emphasize = false }) {
  if (value == null || value === '') return null;
  return (
    <div className={`${styles.fieldRow} ${emphasize ? styles.fieldEmphasize : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function VeiculoFinanceiroCard({
  veiculo,
  custos,
  valoresRecuperar = [],
  onCombustivel,
  onManutencao,
  onOutro,
  onHistorico,
  onEditar,
  onMarcarRecuperado,
}) {
  const prestacao = custos.prestacaoProgramada;
  const seguro = custos.seguroProgramado;
  const compraAPronto = /pronto/i.test(veiculo.notas || '');
  const pendentes = valoresRecuperar.filter((item) => item.status !== VALOR_RECUPERAR_STATUS.RECEBIDO);

  return (
    <article className={styles.infoCard}>
      <div className={styles.infoCardHeader}>
        <h3>{veiculo.nome}</h3>
        {veiculo.propriedadeEmpresa === false ? (
          <Badge variant="warning">Uso da empresa</Badge>
        ) : (
          <Badge variant="default">Da empresa</Badge>
        )}
      </div>
      {veiculo.modelo ? <Field label="Modelo" value={veiculo.modelo} /> : null}
      {getVeiculoCombustivelLabel(veiculo.combustivel) ? (
        <Field label="Combustível" value={getVeiculoCombustivelLabel(veiculo.combustivel)} />
      ) : null}
      {veiculo.regraFiscal === 'nao_recuperavel' ? (
        <Field label="IVA" value="Não recuperado pela empresa" />
      ) : null}
      {veiculo.observacaoFiscal ? <p className={styles.cardNota}>{veiculo.observacaoFiscal}</p> : null}
      {veiculo.propriedadeEmpresa === false ? (
        <p className={styles.cardNota}>
          Veículo não está em nome da empresa. É utilizado pela empresa, que paga combustível, manutenção e Via Verde.
        </p>
      ) : null}
      {compraAPronto ? <Field label="Compra" value="Paga a pronto" /> : null}
      {!prestacao && veiculo.propriedadeEmpresa !== false && !compraAPronto ? (
        <Field label="Prestação" value="Não tem" />
      ) : null}

      {prestacao ? (
        <>
          <Field label="Prestação mensal" value={formatCurrency(prestacao.valor)} emphasize />
          <Field label="Parcelas restantes" value={String(prestacao.parcelasRestantes ?? 0)} emphasize />
          {prestacao.ivaDeduzido === false ? <Field label="IVA" value="Não deduzido" /> : null}
          <Field label="Valor restante das parcelas" value={formatCurrency(getTotalRestanteParcelas(prestacao))} />
        </>
      ) : null}

      {seguro ? (
        <>
          <Field label="Seguro" value={formatCurrency(seguro.valor)} emphasize />
          <Field label="Tipo" value={formatPeriodicidadeVisivel(seguro)} />
          {seguro.dataInicio ? <Field label="Pagamento" value={formatDate(seguro.dataInicio)} /> : null}
          {seguro.duracaoMeses ? (
            <Field
              label="Cobertura informada"
              value={`${seguro.duracaoMeses} ${seguro.duracaoMeses === 1 ? 'mês' : 'meses'}`}
            />
          ) : null}
          {getSeguroFim(seguro) ? (
            <Field label="Fim da cobertura informada" value={formatDate(getSeguroFim(seguro))} />
          ) : null}
          {seguro.observacao ? <p className={styles.cardNota}>{seguro.observacao}</p> : null}
        </>
      ) : null}

      {pendentes.map((item) => (
        <div key={item.id} className={styles.recuperarBox}>
          <Field label="IVA a recuperar" value={formatCurrency(item.valor)} emphasize />
          <Field label="Previsão" value={formatYearMonth(item.previsaoMes)} />
          <Field label="Estado" value="Pendente — ainda não foi recebido" />
          {item.observacao ? <p className={styles.cardNota}>{item.observacao}</p> : null}
          {onMarcarRecuperado ? (
            <Button size="sm" onClick={() => onMarcarRecuperado(item)}>
              Marcar recebido
            </Button>
          ) : null}
        </div>
      ))}

      {veiculo.notas && !compraAPronto ? <p className={styles.cardNota}>{veiculo.notas}</p> : null}

      <ul className={styles.veiculoCustos}>
        <li>
          <HelpLabel text={HELP.gasto.combustivel}>Combustível este mês</HelpLabel>
          <strong>{formatCurrency(custos.combustivelMes || 0)}</strong>
        </li>
        <li>
          <HelpLabel text={HELP.gasto.combustivel}>Combustível (total)</HelpLabel>
          <strong>{formatCurrency(custos.combustivel)}</strong>
        </li>
        <li><span>Manutenção</span><strong>{formatCurrency(custos.manutencao)}</strong></li>
        <li>
          <HelpLabel text={HELP.viatura.viaVerde}>Via Verde</HelpLabel>
          <strong>{formatCurrency(custos.viaVerde)}</strong>
        </li>
        <li><span>Outros</span><strong>{formatCurrency(custos.outros)}</strong></li>
        <li className={styles.veiculoTotal}><span>Total lançado</span><strong>{formatCurrency(custos.total)}</strong></li>
      </ul>

      <div className={styles.veiculoActions}>
        <Button size="sm" onClick={onCombustivel}>Combustível</Button>
        <Button variant="secondary" size="sm" onClick={onManutencao}>Manutenção</Button>
        <Button variant="secondary" size="sm" onClick={onOutro}>Outro gasto</Button>
        <Button variant="secondary" size="sm" onClick={onHistorico}>Histórico</Button>
        <Button variant="secondary" size="sm" onClick={onEditar}>Editar</Button>
      </div>
    </article>
  );
}
