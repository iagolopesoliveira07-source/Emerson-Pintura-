import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import ParceiroReembolsoModal from './ParceiroReembolsoModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { asRecordList } from '../../utils/safeCollections';
import {
  calcPartnershipSummary,
  addRepasseParceria,
  buildRepasseParceria,
  materializeRepassesParceria,
  removeRepasseParceria,
} from '../../utils/obraSpecial';
import styles from './ObraTipo.module.css';

export default function ObraParceriaSection({ obra, onSuccess }) {
  const {
    gastos,
    gastosEmpresa = [],
    diarias,
    pagamentos,
    funcionarios,
    fechamentosPagamento = [],
    addPagamento,
    deletePagamento,
    updateObra,
  } = useApp();
  const [repasseOpen, setRepasseOpen] = useState(false);
  const [repasseParaExcluir, setRepasseParaExcluir] = useState(null);

  const summary = useMemo(
    () =>
      calcPartnershipSummary(obra, {
        gastos,
        diarias,
        pagamentos,
        gastosEmpresa,
        funcionarios,
        fechamentosPagamento,
      }),
    [obra, gastos, diarias, pagamentos, gastosEmpresa, funcionarios, fechamentosPagamento]
  );

  if (!summary) return null;

  const presencaParceiros = Array.isArray(summary.presencaParceiros) ? summary.presencaParceiros : [];
  const historicoRepasses = (Array.isArray(summary.repasses) ? summary.repasses : asRecordList(summary.repasses)).map(
    (item) => ({
      id: item.id || `${item.data}-${item.valor}`,
      data: item.data,
      descricao: item.observacao || item.descricao || 'Repasse de lucro',
      valor: item.valor,
      pagamentoId: item.pagamentoId || (item.tipo === 'Repasse de parceria' ? item.id : null),
      origem: item,
    })
  );

  const handleRepasse = (payload) => {
    const pagamento = addPagamento({
      tipo: 'Repasse de parceria',
      descricao: `Repasse de lucro — ${summary.parceiroNome}`,
      valor: payload.valor,
      data: payload.data,
      obraId: obra.id,
      pessoaRelacionada: summary.parceiroNome,
      observacao: payload.observacao || '',
      metodoPagamento: 'Transferência',
    });
    const repasse = buildRepasseParceria({
      valor: payload.valor,
      data: payload.data,
      observacao: payload.observacao,
      pagamentoId: pagamento?.id || null,
    });
    if (!repasse) return;
    updateObra(addRepasseParceria(obra, repasse));
    setRepasseOpen(false);
    onSuccess?.('Repasse de lucro registado.');
  };

  const excluirRepasseManual = () => {
    const item = repasseParaExcluir;
    if (!item?.id) {
      setRepasseParaExcluir(null);
      return;
    }
    const base = Array.isArray(obra.repassesParceria) ? obra : materializeRepassesParceria(obra, pagamentos);
    updateObra(removeRepasseParceria(base, item.id));
    const pagamento = pagamentos.find((row) => row.id === item.pagamentoId);
    if (pagamento?.tipo === 'Repasse de parceria') deletePagamento(pagamento.id);
    setRepasseParaExcluir(null);
    onSuccess?.('Repasse excluído.');
  };

  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>Resumo da parceria</h3>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>Valor total da obra</span>
          <strong>{formatCurrency(summary.receitaContratada)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Total recebido</span>
          <strong>{formatCurrency(summary.receitaRecebida)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Materiais / outros gastos</span>
          <strong>{formatCurrency(summary.gastosMateriaisOutros)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Mão de obra total</span>
          <strong>{formatCurrency(summary.maoDeObraTotal)}</strong>
        </div>
        <div className={styles.stat}>
          <span>N.º de diárias de presença</span>
          <strong>{summary.diariasParceiroQuantidade || 0}</strong>
        </div>
      </div>

      {presencaParceiros.length > 0 ? (
        <>
          <h3 className={styles.panelTitle}>Controlo de presença dos parceiros</h3>
          <p className={styles.hint}>
            Controlo de presença. Não gera pagamento automático.
          </p>
          {presencaParceiros.map((parceiro) => (
            <div key={parceiro.funcionarioId || parceiro.nome}>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span>Parceiro</span>
                  <strong>{parceiro.nome}</strong>
                </div>
                <div className={styles.stat}>
                  <span>N.º total de diárias</span>
                  <strong>{parceiro.quantidade}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Dias registados</span>
                  <strong>{parceiro.registos}</strong>
                </div>
              </div>
              {(parceiro.dias || []).length > 0 ? (
                <ul className={styles.repassesList}>
                  {(parceiro.dias || []).map((dia) => (
                    <li key={dia.id || `${dia.data}-${dia.quantidade}`}>
                      <span>{dia.data ? formatDate(dia.data) : 'Sem data'}</span>
                      <span>{dia.observacao || '—'}</span>
                      <strong>{dia.quantidade} {dia.quantidade === 1 ? 'diária' : 'diárias'}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.hint}>Ainda não há diárias de presença registadas.</p>
              )}
            </div>
          ))}
        </>
      ) : (
        <>
          <h3 className={styles.panelTitle}>Controlo de presença dos parceiros</h3>
          <p className={styles.hint}>
            Lance diárias de {summary.parceiroNome} para saber em que dias trabalhou nesta obra. Não
            geram pagamento.
          </p>
        </>
      )}

      <h3 className={styles.panelTitle}>Histórico de repasses</h3>
      <p className={styles.hint}>
        Só repasses registados à parte. O que ficou num Acerto concluído já está pago e não volta a aparecer aqui.
      </p>
      {historicoRepasses.length > 0 ? (
        <ul className={styles.repassesList}>
          {historicoRepasses.map((item) => (
            <li key={item.id || `${item.data}-${item.valor}`} className={styles.repasseLinha}>
              <span>{item.data ? formatDate(item.data) : '—'}</span>
              <span>{item.descricao || 'Repasse'}</span>
              <strong>{formatCurrency(item.valor)}</strong>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Excluir repasse"
                onClick={() => setRepasseParaExcluir(item)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>Ainda não há repasses manuais no histórico.</p>
      )}
      <div className={styles.actions}>
        <Button size="sm" type="button" onClick={() => setRepasseOpen(true)}>
          Registrar repasse de lucro
        </Button>
      </div>

      <ParceiroReembolsoModal
        isOpen={repasseOpen}
        onClose={() => setRepasseOpen(false)}
        partnerName={summary.parceiroNome}
        title={`Repasse de lucro a ${summary.parceiroNome}`}
        hint="Este valor é só a participação no lucro da obra. As diárias de parceiro são controlo de presença e não geram pagamento."
        submitLabel="Guardar repasse de lucro"
        onSubmit={handleRepasse}
      />
      <ConfirmDialog
        isOpen={Boolean(repasseParaExcluir)}
        onClose={() => setRepasseParaExcluir(null)}
        onConfirm={excluirRepasseManual}
        title="Excluir este repasse?"
        message="Excluir este repasse?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </section>
  );
}
