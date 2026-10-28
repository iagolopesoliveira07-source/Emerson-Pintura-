import Badge from '../Badge/Badge';
import { formatCurrency } from '../../utils/formatters';
import { getEstadoFixo, getEstadoFixoBadgeVariant } from '../../utils/empresaFinanceiroCalculations';
import styles from '../../pages/GastosEmpresa/GastosEmpresa.module.css';

function LinhaCusto({ linha, gastos, onAbrir }) {
  const estado = getEstadoFixo(linha.programada, { gastos });
  return (
    <li>
      <button type="button" className={styles.fixoLinha} onClick={() => onAbrir(linha.programada)}>
        <div className={styles.fixoLinhaTexto}>
          <div className={styles.fixoLinhaTopo}>
            <p className={styles.fixoLinhaTitulo}>{linha.titulo}</p>
            <Badge variant={getEstadoFixoBadgeVariant(estado)}>{estado.label}</Badge>
          </div>
          <span className={styles.fixoLinhaMeta}>{linha.origem}</span>
          {linha.referencia ? (
            <span className={styles.analiticoTag}>Referência analítica — não é despesa mensal</span>
          ) : linha.analitico ? (
            <span className={styles.fixoLinhaMeta}>Equivalente mensal (não cria pagamento)</span>
          ) : null}
        </div>
        <span className={styles.fixoLinhaValor}>{formatCurrency(linha.valorMensal)}/mês</span>
      </button>
    </li>
  );
}

export default function CustoMensalEmpresa({ custo, gastos = [], onAbrir }) {
  return (
    <div>
      <section className={styles.caixaResumo} aria-label="Custo mensal da empresa">
        <div className={styles.resumoCard}>
          <span>Custo fixo mensal direto</span>
          <strong>{formatCurrency(custo.custoFixoMensalDireto)}</strong>
        </div>
        <div className={styles.resumoCard}>
          <span>Custos periódicos diluídos</span>
          <strong>{formatCurrency(custo.custosPeriodicosDiluidos)}</strong>
        </div>
        <div className={`${styles.resumoCard} ${styles.resumoDestaque}`}>
          <span>Custo médio mensal estimado</span>
          <strong>{formatCurrency(custo.custoMedioMensalEstimado)}</strong>
        </div>
      </section>
      <p className={styles.nota}>
        Esta vista é analítica. Não cria pagamentos nem altera o caixa. Um seguro anual pago de uma
        vez aparece aqui como equivalente mensal, mas no caixa continua a sair só na data real.
      </p>

      {custo.grupos.map((grupo) => (
        <section key={grupo.id} className={styles.fixoGrupo}>
          <h2 className={styles.grupoTitulo} style={{ marginTop: 0 }}>
            {grupo.label}
          </h2>
          <ul className={styles.fixoLista}>
            {grupo.diretos.map((linha) => (
              <LinhaCusto key={linha.id} linha={linha} gastos={gastos} onAbrir={onAbrir} />
            ))}
            {grupo.diluidos.map((linha) => (
              <LinhaCusto key={linha.id} linha={linha} gastos={gastos} onAbrir={onAbrir} />
            ))}
          </ul>
        </section>
      ))}

      {custo.referencias.length > 0 ? (
        <section className={styles.fixoGrupo}>
          <h2 className={styles.grupoTitulo} style={{ marginTop: 0 }}>
            Referências analíticas
          </h2>
          <p className={styles.nota}>
            Períodos já pagos, sem cobrança seguinte confirmada. Não entram no custo médio mensal
            estimado.
          </p>
          <ul className={styles.fixoLista}>
            {custo.referencias.map((linha) => (
              <LinhaCusto key={linha.id} linha={linha} gastos={gastos} onAbrir={onAbrir} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.fixoGrupo}>
        <h2 className={styles.grupoTitulo} style={{ marginTop: 0 }}>
          Gastos variáveis
        </h2>
        <p className={styles.nota}>
          Combustível, Via Verde, materiais, estacionamento e manutenção eventual não entram no
          custo fixo.
        </p>
        {custo.mesesVariavel > 0 ? (
          <p className={styles.mediaVariavel}>
            Média mensal de gastos variáveis ({custo.mesesVariavel}{' '}
            {custo.mesesVariavel === 1 ? 'mês' : 'meses'} com registos):{' '}
            <strong>{formatCurrency(custo.mediaVariavel)}</strong>
          </p>
        ) : (
          <p className={styles.nota}>Ainda não há gastos variáveis suficientes para calcular uma média.</p>
        )}
      </section>
    </div>
  );
}
