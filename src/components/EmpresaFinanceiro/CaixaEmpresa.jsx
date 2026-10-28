import Badge from '../Badge/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import styles from '../../pages/GastosEmpresa/GastosEmpresa.module.css';

export default function CaixaEmpresa({ caixa, periodLabel, onAbrirGasto, onAbrirProgramada }) {
  return (
    <div>
      <section className={styles.caixaResumo} aria-label="Caixa do período">
        <div className={styles.resumoCard}>
          <span>Saiu neste período</span>
          <strong className={styles.pago}>{formatCurrency(caixa.totalPago)}</strong>
        </div>
        <div className={styles.resumoCard}>
          <span>Ainda a sair</span>
          <strong className={styles.pendente}>{formatCurrency(caixa.totalASair)}</strong>
        </div>
        <div className={styles.resumoCard}>
          <span>{periodLabel || 'Total de caixa'}</span>
          <strong>{formatCurrency(caixa.totalCaixa)}</strong>
        </div>
      </section>
      <p className={styles.nota}>
        Aqui conta o dinheiro que realmente saiu ou ainda precisa sair. Um seguro anual pago numa
        só vez aparece só no mês do pagamento.
      </p>

      {caixa.grupos.length === 0 ? (
        <p className={styles.nota}>Não há movimentos de caixa neste período.</p>
      ) : (
        caixa.grupos.map((grupo) => (
          <section key={grupo.id} className={styles.fixoGrupo}>
            <h2 className={styles.grupoTitulo} style={{ marginTop: 0 }}>
              {grupo.label}
            </h2>
            <ul className={styles.fixoLista}>
              {grupo.linhas.map((linha) => (
                <li key={linha.id}>
                  <button
                    type="button"
                    className={styles.fixoLinha}
                    onClick={() => {
                      if (linha.programada && onAbrirProgramada) onAbrirProgramada(linha.programada);
                      else if (onAbrirGasto) onAbrirGasto(linha.gasto);
                    }}
                  >
                    <div className={styles.fixoLinhaTexto}>
                      <div className={styles.fixoLinhaTopo}>
                        <p className={styles.fixoLinhaTitulo}>{linha.titulo}</p>
                        <Badge variant={linha.estado === 'pago' ? 'success' : 'warning'}>
                          {linha.estado === 'pago' ? 'Pago' : linha.estado === 'previsto' ? 'Previsto' : 'Pendente'}
                        </Badge>
                      </div>
                      <span className={styles.fixoLinhaMeta}>
                        {linha.data ? formatDate(linha.data) : 'Data não informada'}
                        {linha.veiculo ? ` · ${linha.veiculo}` : ''}
                      </span>
                    </div>
                    <span className={styles.fixoLinhaValor}>{formatCurrency(linha.valor)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
