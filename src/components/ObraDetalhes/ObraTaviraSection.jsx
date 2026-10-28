import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import ObraFinanceiroLedger from './ObraFinanceiroLedger';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calcObraCustosAcumulados, calcDiariasPorFuncionario, buildObraFinanceiroLedger } from '../../utils/obraCustos';
import { createAptoTaviraAcordo } from '../../utils/obraSpecial';
import styles from './ObraTipo.module.css';

function formatDiasEquipa(datas = []) {
  const unique = [...new Set((datas || []).filter(Boolean))].sort();
  if (unique.length === 0) return '';
  const meses = new Set(unique.map((item) => String(item).slice(0, 7)));
  if (meses.size === 1) {
    const dias = unique.map((item) => Number(String(item).slice(8, 10))).filter((n) => n > 0);
    if (dias.length === 1) return `dia ${dias[0]}`;
    if (dias.length === 2) return `dias ${dias[0]} e ${dias[1]}`;
    return `dias ${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]}`;
  }
  return unique.map((item) => formatDate(item)).join(', ');
}

export default function ObraTaviraSection({ obra }) {
  const { gastos, gastosEmpresa = [], diarias, pagamentos, funcionarios } = useApp();
  const acordo = createAptoTaviraAcordo(obra.acordoEspecial);
  const custos = useMemo(
    () => calcObraCustosAcumulados(obra.id, { gastos, diarias, gastosEmpresa, funcionarios }),
    [obra.id, gastos, diarias, gastosEmpresa, funcionarios]
  );
  const equipa = useMemo(
    () => calcDiariasPorFuncionario(obra.id, diarias, funcionarios),
    [obra.id, diarias, funcionarios]
  );
  const movimentos = useMemo(
    () =>
      buildObraFinanceiroLedger(obra, {
        gastos,
        diarias,
        gastosEmpresa,
        pagamentos,
        funcionarios,
      }),
    [obra, gastos, diarias, gastosEmpresa, pagamentos, funcionarios]
  );

  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>Tavira</h3>
      <div className={styles.acordo}>
        <div className={styles.acordoRow}>
          <span>Tipo</span>
          <strong>Especial / Tavira</strong>
        </div>
        <div className={styles.acordoRow}>
          <span>Projeto</span>
          <strong>{acordo.projeto}</strong>
        </div>
        <div className={styles.acordoRow}>
          <span>Acordo</span>
          <strong>{acordo.descricao}</strong>
        </div>
        <div className={styles.acordoRow}>
          <span>Forma de compensação</span>
          <strong>{acordo.formaCompensacao}</strong>
        </div>
      </div>

      <h3 className={styles.panelTitle}>Investimento até agora</h3>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>Materiais</span>
          <strong>{formatCurrency(custos.totalMateriais)}</strong>
        </div>
        {custos.totalHospedagem > 0 ? (
          <div className={styles.stat}>
            <span>Hospedagem</span>
            <strong>{formatCurrency(custos.totalHospedagem)}</strong>
          </div>
        ) : null}
        <div className={styles.stat}>
          <span>Diárias</span>
          <strong>{formatCurrency(custos.totalDiarias)}</strong>
        </div>
        {custos.totalOutros > 0 ? (
          <div className={styles.stat}>
            <span>Outros gastos</span>
            <strong>{formatCurrency(custos.totalOutros)}</strong>
          </div>
        ) : null}
        <div className={`${styles.stat} ${styles.statHighlight}`}>
          <span>Total investido</span>
          <strong>{formatCurrency(custos.totalInvestido)}</strong>
        </div>
      </div>
      <p className={styles.hint}>
        Esta remodelação não usa lucro tradicional (receita menos despesa), porque a compensação é
        um ano de aluguel.
      </p>

      <h3 className={styles.panelTitle}>Equipa</h3>
      {equipa.length === 0 ? (
        <p className={styles.hint}>Ainda não há diárias associadas a Tavira.</p>
      ) : (
        <div className={styles.equipaList}>
          {equipa.map((item) => (
            <div key={item.funcionarioId || item.nome} className={styles.equipaRow}>
              <span>
                {item.nome}
                {item.datas?.length
                  ? ` · ${formatDiasEquipa(item.datas)}`
                  : item.quantidade
                    ? ` · ${item.quantidade} diária${item.quantidade === 1 ? '' : 's'}`
                    : ''}
              </span>
              <strong>{formatCurrency(item.total)}</strong>
            </div>
          ))}
        </div>
      )}

      <h3 className={styles.panelTitle}>Andamento</h3>
      <div className={styles.acordo}>
        <div className={styles.acordoRow}>
          <span>Status da remodelação</span>
          <strong>{obra.estado || 'Em andamento'}</strong>
        </div>
        {obra.observacoes && obra.observacoes !== acordo.descricao ? (
          <div className={styles.acordoRow}>
            <span>Observações</span>
            <strong>{obra.observacoes}</strong>
          </div>
        ) : null}
      </div>

      <h3 className={styles.panelTitle} style={{ marginTop: '1.25rem' }}>
        Movimentos da remodelação
      </h3>
      <ObraFinanceiroLedger movimentos={movimentos} showEntradas={false} />
    </section>
  );
}
