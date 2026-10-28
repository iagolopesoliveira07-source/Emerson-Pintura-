import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import DescontoFormModal from './DescontoFormModal';
import CommitmentHistoryModal from './CommitmentHistoryModal';
import ValoresAcertoDetailModal from './ValoresAcertoDetailModal';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import {
  addAluguelToFuncionario,
  addDescontoToFuncionario,
  deleteAluguelFromFuncionario,
  deleteDescontoFromFuncionario,
  updateAluguelOnFuncionario,
  updateDescontoOnFuncionario,
} from '../../utils/funcionarioForm';
import {
  DESCONTO_MES_STATUS,
  QUANDO_DESCONTAR,
  TIPO_DESCONTO,
  getDescontoMesStatus,
  getParcelasDescontadas,
  getParcelasRestantesCount,
  getQuandoDescontar,
  getQuandoDescontarLabel,
  getSaldoRestanteEmprestimo,
  getTipoDesconto,
  getTipoDescontoLabel,
  getTotalParcelas,
  getValorADescontarEsteMes,
  getValorParcela,
  isCommitmentParcelado,
  isDescontoManual,
} from '../../utils/commitmentCalculations';
import { listDescontosAdiantamentos } from '../../utils/descontoAdiantamentoView';
import { formatCurrency } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';
import styles from './Commitments.module.css';

function MesStatus({ status, item }) {
  const quando = getQuandoDescontar(item);
  if (isDescontoManual(item)) {
    if (status === DESCONTO_MES_STATUS.CONCLUIDO) {
      return <span className={`${styles.mesStatus} ${styles.mesStatusDone}`}>Concluído</span>;
    }
    return <span className={`${styles.mesStatus} ${styles.mesStatusDone}`}>Aguardando decisão</span>;
  }
  if (status === DESCONTO_MES_STATUS.DESCONTADO) {
    if (quando === QUANDO_DESCONTAR.SEMANAL) {
      return <span className={`${styles.mesStatus} ${styles.mesStatusOk}`}>Descontado esta semana</span>;
    }
    return <span className={`${styles.mesStatus} ${styles.mesStatusOk}`}>Descontado este mês</span>;
  }
  if (status === DESCONTO_MES_STATUS.CONCLUIDO) {
    return <span className={`${styles.mesStatus} ${styles.mesStatusDone}`}>Concluído</span>;
  }
  if (quando === QUANDO_DESCONTAR.UNICO) {
    return <span className={`${styles.mesStatus} ${styles.mesStatusPending}`}>Pendente</span>;
  }
  if (quando === QUANDO_DESCONTAR.SEMANAL) {
    return <span className={`${styles.mesStatus} ${styles.mesStatusPending}`}>Pendente esta semana</span>;
  }
  return <span className={`${styles.mesStatus} ${styles.mesStatusPending}`}>Pendente este mês</span>;
}

function valorLinha(item, tipo, valor) {
  if (isCommitmentParcelado(item) || tipo === TIPO_DESCONTO.EMPRESTIMO) {
    return `${formatCurrency(valor)}/parcela`;
  }
  const quando = getQuandoDescontar(item);
  if (quando === QUANDO_DESCONTAR.SEMANAL) {
    return `${formatCurrency(valor)}/semana`;
  }
  if (quando === QUANDO_DESCONTAR.MENSAL) {
    return `${formatCurrency(valor)}/mês`;
  }
  return formatCurrency(valor);
}

function DescontoRow({ item, mesAno, onOpen }) {
  const tipo = getTipoDesconto(item);
  const status = getDescontoMesStatus(item, mesAno);
  const valor =
    status === DESCONTO_MES_STATUS.PENDENTE
      ? getValorADescontarEsteMes(item, mesAno)
      : getValorParcela(item);
  const pagas = getParcelasDescontadas(item);
  const total = getTotalParcelas(item);
  const restantes = getParcelasRestantesCount(item);
  const titulo = item.descricao || getTipoDescontoLabel(item);
  const parcelado = tipo === TIPO_DESCONTO.EMPRESTIMO || isCommitmentParcelado(item);

  return (
    <div className={styles.descontoRow}>
      <button type="button" className={styles.descontoRowMain} onClick={() => onOpen(item)}>
        <div className={styles.descontoCardTitle}>{titulo}</div>
        <div className={styles.descontoValor}>{valorLinha(item, tipo, valor)}</div>
        <div className={styles.descontoLoanLine}>
          Tipo: {getTipoDescontoLabel(item)} · Quando descontar: {getQuandoDescontarLabel(item)}
        </div>
        {parcelado && (
          <div className={styles.descontoLoanLine}>
            {pagas} de {total} parcelas descontadas · {restantes} restantes · Saldo{' '}
            {formatCurrency(getSaldoRestanteEmprestimo(item))}
          </div>
        )}
      </button>
      <div className={styles.descontoRowMeta}>
        <MesStatus status={status} item={item} />
      </div>
    </div>
  );
}

export default function FuncionarioDescontosAdiantamentosSection({ funcionario, onSuccess }) {
  const { updateFuncionario, valoresAcerto, getObraById, desfazerDescontoLancamento, fechamentosPagamento } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [undoLancamento, setUndoLancamento] = useState(null);

  const lista = useMemo(
    () => listDescontosAdiantamentos(funcionario, valoresAcerto),
    [funcionario, valoresAcerto]
  );

  const isAluguelItem = (item) => item?.source === 'aluguel' || getTipoDesconto(item) === TIPO_DESCONTO.ALUGUEL;

  const runUpdate = (mapper) => {
    try {
      updateFuncionario(mapper(funcionario));
      setError('');
      return true;
    } catch (err) {
      setError(err.message || 'Não foi possível actualizar o registo.');
      return false;
    }
  };

  const handleCreate = (form) => {
    const add = form.tipoDesconto === TIPO_DESCONTO.ALUGUEL ? addAluguelToFuncionario : addDescontoToFuncionario;
    if (runUpdate((current) => add(current, form))) {
      setCreateOpen(false);
      onSuccess?.('Desconto registado com sucesso.');
    }
  };

  const handleConfirmarDesfazer = () => {
    const entry = undoLancamento;
    if (!entry?.id || !funcionario?.id) return;
    const result = desfazerDescontoLancamento(funcionario.id, entry.id);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.item) setSelected(result.item);
    setUndoLancamento(null);
    onSuccess?.('Desconto desfeito. O valor voltou para o saldo.');
  };

  const handleEdit = (form) => {
    const update = isAluguelItem(selected) ? updateAluguelOnFuncionario : updateDescontoOnFuncionario;
    if (runUpdate((current) => update(current, selected.id, form))) {
      setEditOpen(false);
      setDetailOpen(false);
      setSelected(null);
      onSuccess?.('Desconto actualizado com sucesso.');
    }
  };

  const handleDelete = () => {
    const remove = isAluguelItem(selected) ? deleteAluguelFromFuncionario : deleteDescontoFromFuncionario;
    if (runUpdate((current) => remove(current, selected.id))) {
      setDeleteOpen(false);
      setDetailOpen(false);
      setSelected(null);
      onSuccess?.('Registo excluído com sucesso.');
    }
  };

  const isAcerto = selected?.source === 'acerto';

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>Descontos</h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Novo desconto
        </Button>
      </div>

      {error && <p className={styles.descontoError}>{error}</p>}

      <div className={styles.resumoGrid}>
        <div className={styles.resumoItem}>
          <span className={styles.resumoLabel}>Pendente este mês</span>
          <strong className={styles.resumoValue}>{formatCurrency(lista.resumo.pendenteValor)}</strong>
        </div>
        <div className={styles.resumoItem}>
          <span className={styles.resumoLabel}>Descontado este mês</span>
          <strong className={styles.resumoValue}>{formatCurrency(lista.resumo.descontadoValor)}</strong>
        </div>
        <div className={styles.resumoItem}>
          <span className={styles.resumoLabel}>Saldo de empréstimos</span>
          <strong className={styles.resumoValue}>{formatCurrency(lista.resumo.saldoEmprestimos)}</strong>
        </div>
      </div>

      {lista.items.length === 0 ? (
        <p className={styles.emptyHistory}>Ainda não há descontos neste funcionário.</p>
      ) : (
        <div className={styles.descontoList}>
          {lista.items.map((item) => (
            <DescontoRow
              key={`${item.source || 'desconto'}:${item.id}`}
              item={item}
              mesAno={new Date()}
              onOpen={(row) => {
                setSelected(row);
                setDetailOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <DescontoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <DescontoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        desconto={selected}
        onSubmit={handleEdit}
      />

      {isAcerto ? (
        <ValoresAcertoDetailModal
          isOpen={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setSelected(null);
          }}
          item={selected?.acertoOriginal}
          obraNome={
            selected?.acertoOriginal?.obraId
              ? getObraById(selected.acertoOriginal.obraId)?.nome
              : ''
          }
        />
      ) : (
        <CommitmentHistoryModal
          isOpen={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setSelected(null);
          }}
          item={selected}
          onEdit={() => {
            setDetailOpen(false);
            setEditOpen(true);
          }}
          onDelete={() => {
            setDetailOpen(false);
            setDeleteOpen(true);
          }}
          fechamentosPagamento={fechamentosPagamento}
          onDesfazer={(entry) => setUndoLancamento(entry)}
        />
      )}

      {undoLancamento ? (
        <ConfirmDialog
          isOpen
          onClose={() => setUndoLancamento(null)}
          onConfirm={handleConfirmarDesfazer}
          title={`Desfazer este desconto de ${formatCurrency(undoLancamento.valor)}?`}
          cancelLabel="Cancelar"
          confirmLabel="Desfazer desconto"
          confirmVariant="danger"
        >
          <p className={confirmStyles.message}>O valor voltará para o saldo do desconto.</p>
          {undoLancamento.fechamentoId ? (
            <p className={confirmStyles.message}>
              Isto altera o valor líquido daquele pagamento. O pagamento existente é corrigido, sem criar outro.
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}

      {selected && !isAcerto && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title="Excluir este desconto?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
        >
          <p className={confirmStyles.message}>
            O histórico deixa de aparecer nesta ficha. Pagamentos já fechados não são alterados.
          </p>
          <div className={confirmStyles.details}>
            {[
              ['Tipo', getTipoDescontoLabel(selected)],
              ['Descrição', selected.descricao],
              ['Valor', formatCurrency(getValorParcela(selected))],
            ].map(([label, value]) => (
              <div key={label} className={confirmStyles.detailRow}>
                <span className={confirmStyles.detailLabel}>{label}:</span>
                <span className={confirmStyles.detailValue}>{value}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
