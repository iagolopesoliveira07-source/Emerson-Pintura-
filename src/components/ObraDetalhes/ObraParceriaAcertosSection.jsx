import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  apagarAcertoParceria,
  excluirRascunhoAcertoParceria,
  getAcertosParceria,
  getRascunhoAcertoParceria,
  recebimentosEmFaltaSintra,
  registrarAcertosHistoricosSintra,
  resumoAcertoParaHistorico,
} from '../../utils/obraParceriaAcertos';
import tipoStyles from './ObraTipo.module.css';
import styles from './ObraParceriaAcertos.module.css';

export default function ObraParceriaAcertosSection({ obra, onSuccess }) {
  const navigate = useNavigate();
  const { updateObra, addPagamento, pagamentos } = useApp();
  const recebimentosGravados = useRef(new Set());
  const [acertoParaApagar, setAcertoParaApagar] = useState(null);

  useEffect(() => {
    const next = registrarAcertosHistoricosSintra(obra);
    if (next !== obra) updateObra(next);
    recebimentosEmFaltaSintra(obra, pagamentos).forEach((item) => {
      const chave = `${obra.id}:${item.valor}`;
      if (recebimentosGravados.current.has(chave)) return;
      recebimentosGravados.current.add(chave);
      addPagamento({
        tipo: 'Recebimento de cliente',
        descricao: item.descricao,
        valor: item.valor,
        valorRecebido: item.valor,
        status: 'pago',
        data: item.data,
        obraId: obra.id,
        pessoaRelacionada: obra.cliente || '',
        metodoPagamento: 'Transferência',
      });
    });
  }, [obra, pagamentos, updateObra, addPagamento]);

  const acertos = useMemo(() => {
    try {
      return getAcertosParceria(obra);
    } catch (error) {
      console.error(error);
      return [];
    }
  }, [obra]);

  const rascunho = getRascunhoAcertoParceria(obra);

  const confirmarApagar = () => {
    if (!acertoParaApagar?.id) return;
    const next = apagarAcertoParceria(obra, acertoParaApagar.id);
    updateObra(next);
    setAcertoParaApagar(null);
    onSuccess?.('Acerto apagado com sucesso.');
  };

  const excluirRascunho = () => {
    updateObra(excluirRascunhoAcertoParceria(obra));
    onSuccess?.('Rascunho excluído.');
  };

  return (
    <section className={`${tipoStyles.panel} ${styles.wrap}`}>
      <div className={styles.head}>
        <h3 className={styles.title}>Histórico de Acertos</h3>
        <Button type="button" onClick={() => navigate(`/obras/${obra.id}/acerto`)}>
          + Novo Acerto
        </Button>
      </div>
      <p className={styles.hint}>
        No Novo Acerto indicas o pagamento, decides se utilizas a reserva e marcas só os custos que queres descontar.
      </p>
      {rascunho ? (
        <article className={styles.card}>
          <h4 className={styles.cardTitle}>Acerto em rascunho</h4>
          <p>Pagamento digitado: {rascunho.pagamento ? formatCurrency(Number(rascunho.pagamento) || 0) : '—'}</p>
          <div className={styles.cardActions}>
            <Button type="button" size="sm" onClick={() => navigate(`/obras/${obra.id}/acerto`)}>
              Continuar
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={excluirRascunho}>
              Excluir rascunho
            </Button>
          </div>
        </article>
      ) : null}
      {acertos.length === 0 ? (
        <p className={styles.empty}>Nenhum Acerto realizado.</p>
      ) : (
        <div className={styles.list}>
          {acertos.map((item) => {
            const resumo = resumoAcertoParaHistorico(item, obra);
            const snap = item.snapshot || {};
            const pessoas = Array.isArray(snap.pessoas) ? snap.pessoas : [];
            const historico = item.tipoHistorico === 'divisao-direta' || item.tipoHistorico === 'reembolso-divisao';
            return (
              <article key={item.id} className={styles.card}>
                <h4 className={styles.cardTitle}>{item.titulo || `Acerto ${item.numero}`}</h4>
                {item.status === 'fechado' ? <p>Concluído</p> : null}
                {item.tipoLabel ? <p>{item.tipoLabel}</p> : null}
                {!historico && resumo.distribuirLucro === false ? (
                  <p>Acerto de custos — sem distribuição de lucro</p>
                ) : null}
                {!historico && resumo.distribuirLucro === true ? <p>Acerto com distribuição de lucro</p> : null}
                {item.data ? <p>Data: {formatDate(item.data)}</p> : null}
                <p>Recebido: {formatCurrency(resumo.recebido)}</p>
                {historico && item.tipoHistorico === 'reembolso-divisao' ? (
                  <p>Reembolso Emerson: {formatCurrency(snap.reembolsoConsolidadoEmerson || 0)}</p>
                ) : null}
                {historico && item.tipoHistorico === 'divisao-direta' ? <p>Custos descontados: {formatCurrency(0)}</p> : null}
                {historico ? (
                  <p>
                    {item.tipoHistorico === 'reembolso-divisao' ? 'Restante dividido' : 'Distribuído'}:{' '}
                    {formatCurrency(resumo.dividido)}
                  </p>
                ) : (
                  <>
                    <p>Reserva utilizada: {formatCurrency(resumo.reservaUtilizada)}</p>
                    <p>Custos acertados: {formatCurrency(resumo.custos)}</p>
                    <p>Reserva deixada: {formatCurrency(resumo.reservaDeixada)}</p>
                    {resumo.distribuirLucro === false ? (
                      <p>Distribuição de lucro: não realizada</p>
                    ) : (
                      <p>Dividido: {formatCurrency(resumo.dividido)}</p>
                    )}
                  </>
                )}
                {historico
                  ? pessoas.map((pessoa) => (
                      <p key={pessoa.key}>
                        {pessoa.nome}: {formatCurrency(pessoa.lucro || 0)}
                      </p>
                    ))
                  : null}
                <div className={styles.cardActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/obras/${obra.id}/acerto/${item.id}`)}
                  >
                    Ver detalhes
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setAcertoParaApagar(item)}
                  >
                    Apagar Acerto
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        isOpen={Boolean(acertoParaApagar)}
        onClose={() => setAcertoParaApagar(null)}
        onConfirm={confirmarApagar}
        title="Tem certeza que deseja apagar este Acerto?"
        confirmLabel="Apagar Acerto"
        cancelLabel="Cancelar"
      >
        <p className={styles.hint}>Os gastos, diárias e mão de obra originais não serão apagados.</p>
      </ConfirmDialog>
    </section>
  );
}
