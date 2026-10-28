import { useState } from 'react';
import { Plus, Pencil, Trash2, Receipt, CheckCircle, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import ValoresAcertoFormModal from './ValoresAcertoFormModal';
import ValoresAcertoGastoModal from './ValoresAcertoGastoModal';
import ValoresAcertoConfirmModal from './ValoresAcertoConfirmModal';
import ValoresAcertoDetailModal from './ValoresAcertoDetailModal';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  getValorEntregue,
  getValorUtilizado,
  getValorRestante,
  getValorADevolver,
  getValorAdicionalAPagar,
  getAcertoDisplayEstado,
  acertoEstadoVariant,
  canRegisterGasto,
  canConfirmAcerto,
  isAcertoAcertado,
  getFuncionarioAcertoSummary,
  buildAcertoRecord,
  updateAcertoRecord,
  getAcertoData,
} from '../../utils/acertoCalculations';
import styles from './ValoresAcerto.module.css';
import shared from '../../pages/shared.module.css';

export default function ValoresAcertoSection({
  funcionario = null,
  onSuccess,
  showSummary = true,
}) {
  const {
    valoresAcerto,
    funcionarios,
    obras,
    getObraById,
    getFuncionarioById,
    addValorAcerto,
    updateValorAcerto,
    deleteValorAcerto,
    registerGastoValorAcerto,
    confirmValorAcerto,
  } = useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [gastoOpen, setGastoOpen] = useState(false);
  const [acertoOpen, setAcertoOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const items = valoresAcerto
    .filter((v) => !funcionario || v.funcionarioId === funcionario.id)
    .sort((a, b) => {
      const da = getAcertoData(a) || a.createdAt || '';
      const db = getAcertoData(b) || b.createdAt || '';
      return String(db).localeCompare(String(da));
    });

  const summary = funcionario
    ? getFuncionarioAcertoSummary(funcionario.id, valoresAcerto)
    : null;

  const handleCreate = (form) => {
    const record = buildAcertoRecord(form.funcionarioId, form);
    addValorAcerto(record);
    setCreateOpen(false);
    onSuccess?.('Valor para acerto registado com sucesso.');
  };

  const handleEdit = (form) => {
    const result = updateAcertoRecord(selected, form);
    if (result.error) {
      onSuccess?.(result.error);
      return;
    }
    updateValorAcerto(result.item);
    setEditOpen(false);
    setSelected(null);
    onSuccess?.('Valor atualizado com sucesso.');
  };

  const handleDelete = () => {
    deleteValorAcerto(selected.id);
    setDeleteOpen(false);
    setSelected(null);
    onSuccess?.('Valor excluído com sucesso.');
  };

  const handleGasto = (gastoForm) => {
    registerGastoValorAcerto(selected.id, gastoForm);
    setGastoOpen(false);
    setSelected(null);
    onSuccess?.('Gasto registado com sucesso.');
  };

  const handleAcertar = () => {
    const result = confirmValorAcerto(selected.id);
    if (result?.error) {
      onSuccess?.(result.error);
      return;
    }
    setAcertoOpen(false);
    setSelected(null);
    onSuccess?.('Acerto confirmado com sucesso.');
  };

  const renderCard = (item) => {
    const entregue = getValorEntregue(item);
    const utilizado = getValorUtilizado(item);
    const restante = getValorRestante(item);
    const aDevolver = getValorADevolver(item);
    const adicional = getValorAdicionalAPagar(item);
    const estado = getAcertoDisplayEstado(item);
    const acertado = isAcertoAcertado(item);
    const func = getFuncionarioById(item.funcionarioId);
    const obra = item.obraId ? getObraById(item.obraId) : null;

    return (
      <div key={item.id} className={styles.acertoCard}>
        <div className={styles.cardHeader}>
          <div>
            {!funcionario && func && <div className={styles.cardTitle}>{func.nome}</div>}
            <div className={styles.cardTitle}>{item.motivo}</div>
            {getAcertoData(item) ? (
              <div className={styles.cardSub}>Data: {formatDate(getAcertoData(item))}</div>
            ) : null}
            {obra && <div className={styles.cardSub}>Obra: {obra.nome}</div>}
          </div>
          <Badge variant={acertoEstadoVariant(estado)}>
            {acertado ? '✓ Acertado' : estado}
          </Badge>
        </div>

        <div className={styles.cardGrid}>
          <div>
            <span>Valor entregue</span>
            <strong>{formatCurrency(entregue)}</strong>
          </div>
          <div>
            <span>Valor utilizado</span>
            <strong>{formatCurrency(utilizado)}</strong>
          </div>
          <div>
            <span>Valor restante</span>
            <strong>{formatCurrency(restante)}</strong>
          </div>
          <div>
            <span>{adicional > 0 ? 'Empresa deve pagar' : 'A devolver'}</span>
            <strong className={adicional > 0 ? styles.highlightAdicional : styles.highlightDevolver}>
              {adicional > 0 ? formatCurrency(adicional) : aDevolver > 0 ? `${formatCurrency(aDevolver)} a devolver` : '—'}
            </strong>
          </div>
        </div>

        <div className={styles.cardActions}>
          {canRegisterGasto(item) && (
            <Button
              variant="secondary"
              size="sm"
              icon={Receipt}
              onClick={() => {
                setSelected(item);
                setGastoOpen(true);
              }}
            >
              Registrar gasto
            </Button>
          )}
          {canConfirmAcerto(item) && (
            <Button
              size="sm"
              icon={CheckCircle}
              onClick={() => {
                setSelected(item);
                setAcertoOpen(true);
              }}
            >
              Acertar
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            onClick={() => {
              setSelected(item);
              setDetailOpen(true);
            }}
          >
            Histórico
          </Button>
          {!acertado && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={Pencil}
                onClick={() => {
                  setSelected(item);
                  setEditOpen(true);
                }}
              />
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  setSelected(item);
                  setDeleteOpen(true);
                }}
              />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>Valores para acerto</h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Novo valor para acerto
        </Button>
      </div>

      {showSummary && summary && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span>Em aberto</span>
            <strong>{summary.emAberto}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Total entregue</span>
            <strong>{formatCurrency(summary.totalEntregue)}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Total utilizado</span>
            <strong>{formatCurrency(summary.totalUtilizado)}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Total a devolver</span>
            <strong>{formatCurrency(summary.totalADevolver)}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Total já acertado</span>
            <strong>{formatCurrency(summary.totalJaAcertado)}</strong>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className={styles.emptyMessage}>Sem valores para acerto.</p>
      ) : (
        <div className={styles.cardList}>{items.map(renderCard)}</div>
      )}

      <ValoresAcertoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        funcionarios={funcionarios}
        obras={obras}
        fixedFuncionarioId={funcionario?.id}
      />

      <ValoresAcertoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        valorAcerto={selected}
        onSubmit={handleEdit}
        funcionarios={funcionarios}
        obras={obras}
        fixedFuncionarioId={funcionario?.id}
      />

      <ValoresAcertoGastoModal
        isOpen={gastoOpen}
        onClose={() => {
          setGastoOpen(false);
          setSelected(null);
        }}
        onSubmit={handleGasto}
      />

      <ValoresAcertoConfirmModal
        isOpen={acertoOpen}
        onClose={() => {
          setAcertoOpen(false);
          setSelected(null);
        }}
        onConfirm={handleAcertar}
        item={selected}
      />

      <ValoresAcertoDetailModal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelected(null);
        }}
        item={selected}
        obraNome={selected?.obraId ? getObraById(selected.obraId)?.nome : null}
      />

      {selected && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title="Excluir valor para acerto?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este registo?</p>
          <div className={confirmStyles.details}>
            {[
              ['Motivo', selected.motivo],
              ['Valor entregue', formatCurrency(getValorEntregue(selected))],
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
