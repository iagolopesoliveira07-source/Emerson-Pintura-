import { formatCurrency, formatDate } from '../../utils/formatters';
import { getHistoricoDirecao, calcResumoFinanceiroObra } from '../../utils/calculations';
import { HELP } from '../../utils/helpTexts';
import { HelpLabel } from '../HelpTip/HelpTip';
import styles from './ObraHistoricoSection.module.css';

function formatHistoricoLabel(item) {
  if (item.tipo === 'Recebimento de cliente') {
    const desc = item.descricao || '';
    if (desc.toLowerCase().startsWith('extra')) return desc;
    return desc.toLowerCase().startsWith('pagamento') ? desc : `Pagamento — ${desc}`;
  }
  return item.descricao;
}

function formatHistoricoValor(item, direcao) {
  const valor = item.valor || 0;
  if (direcao === 'info') {
    if (item.tipo === 'Obra' && valor > 0) {
      return formatCurrency(valor);
    }
    return null;
  }
  if (direcao === 'entrada') {
    return `+ ${formatCurrency(valor)}`;
  }
  return `− ${formatCurrency(valor)}`;
}

export default function ObraHistoricoSection({
  obra,
  historico,
  totalRecebido,
  totalGasto,
}) {
  const resumo = calcResumoFinanceiroObra(obra, totalRecebido, totalGasto);

  return (
    <div className={styles.section}>
      <h3 className={styles.title}>Histórico</h3>

      <div className={styles.legend} aria-label="Legenda do histórico">
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotEntrada}`} aria-hidden="true" />
          Recebido
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotSaida}`} aria-hidden="true" />
          Gasto
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotInfo}`} aria-hidden="true" />
          Informação
        </span>
      </div>

      <div className={styles.resumo}>
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.valorOriginal}>
            Valor original
          </HelpLabel>
          <span className={styles.resumoValue}>{formatCurrency(resumo.valorContratado)}</span>
        </div>
        {resumo.totalExtras > 0.004 ? (
          <div className={styles.resumoItem}>
            <HelpLabel className={styles.resumoLabel} text={HELP.obra.extras}>
              Extras/serviços
            </HelpLabel>
            <span className={styles.resumoValue}>{formatCurrency(resumo.totalExtras)}</span>
          </div>
        ) : null}
        {resumo.valorAtualizado > (resumo.valorContratado || 0) + 0.004 ? (
          <div className={styles.resumoItem}>
            <HelpLabel className={styles.resumoLabel} text={HELP.obra.valorAtualizado}>
              Valor total atualizado
            </HelpLabel>
            <span className={styles.resumoValue}>{formatCurrency(resumo.valorAtualizado)}</span>
          </div>
        ) : null}
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.recebido}>
            Total recebido
          </HelpLabel>
          <span className={`${styles.resumoValue} ${styles.resumoEntrada}`}>
            {formatCurrency(resumo.totalRecebido)}
          </span>
        </div>
        <div className={styles.resumoItem}>
          <span className={styles.resumoLabel}>Total gasto</span>
          <span className={`${styles.resumoValue} ${styles.resumoSaida}`}>
            {formatCurrency(resumo.totalGasto)}
          </span>
        </div>
        <div className={styles.resumoItem}>
          <span className={styles.resumoLabel}>Saldo financeiro</span>
          <span className={`${styles.resumoValue} ${styles.resumoSaldo}`}>
            {formatCurrency(resumo.saldoFinanceiro)}
          </span>
        </div>
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.aReceber}>
            Ainda a receber
          </HelpLabel>
          <span className={styles.resumoValue}>{formatCurrency(resumo.aindaAReceber)}</span>
        </div>
      </div>

      {historico.length === 0 ? (
        <p className={styles.empty}>Sem movimentos registados.</p>
      ) : (
        <div className={styles.list}>
          {historico.map((item) => {
            const direcao = getHistoricoDirecao(item.tipo);
            const valorFormatado = formatHistoricoValor(item, direcao);
            const itemClass =
              direcao === 'entrada'
                ? styles.itemEntrada
                : direcao === 'saida'
                  ? styles.itemSaida
                  : styles.itemInfo;
            const valorClass =
              direcao === 'entrada'
                ? styles.itemValorEntrada
                : direcao === 'saida'
                  ? styles.itemValorSaida
                  : styles.itemValorInfo;

            return (
              <div key={item.id} className={`${styles.item} ${itemClass}`}>
                <div className={styles.itemMain}>
                  <span
                    className={`${styles.dot} ${
                      direcao === 'entrada'
                        ? styles.dotEntrada
                        : direcao === 'saida'
                          ? styles.dotSaida
                          : styles.dotInfo
                    }`}
                    aria-hidden="true"
                  />
                  <span className={styles.itemDesc}>{formatHistoricoLabel(item)}</span>
                </div>
                <div className={styles.itemMeta}>
                  {valorFormatado && (
                    <span className={`${styles.itemValor} ${valorClass}`}>{valorFormatado}</span>
                  )}
                  <span className={styles.itemData}>{formatDate(item.data)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
