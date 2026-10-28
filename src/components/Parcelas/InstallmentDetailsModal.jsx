import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import PaymentHistory from './PaymentHistory';
import InstallmentPaymentModal from './InstallmentPaymentModal';
import { FormGroup, Input, Select, FormActions } from '../Form/Form';
import { METODOS_PAGAMENTO } from '../../data/mockData';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import {
  computeParcelaStatus,
  getValorRecebidoPagamento,
  getValorRestantePagamento,
  parcelaStatusVariant,
  removeHistoricoPayment,
  updateHistoricoPayment,
  applyPaymentToInstallment,
} from '../../utils/debtCalculations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';

export default function InstallmentDetailsModal({
  isOpen,
  onClose,
  parcela,
  obra,
  onUpdateParcela,
  onViewObra,
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [deletePayment, setDeletePayment] = useState(null);
  const [editForm, setEditForm] = useState({ valor: '', data: '', metodoPagamento: 'Transferência', observacao: '' });

  if (!parcela || !obra) return null;

  const status = computeParcelaStatus(parcela);
  const recebido = getValorRecebidoPagamento(parcela);
  const restante = getValorRestantePagamento(parcela);

  const openEditPayment = (entry) => {
    setEditPayment(entry);
    setEditForm({
      valor: String(entry.valor ?? ''),
      data: entry.data || '',
      metodoPagamento: entry.metodoPagamento || 'Transferência',
      observacao: entry.observacao || '',
    });
  };

  const saveEditPayment = () => {
    onUpdateParcela(updateHistoricoPayment(parcela, editPayment.id, editForm));
    setEditPayment(null);
  };

  const confirmDeletePayment = () => {
    onUpdateParcela(removeHistoricoPayment(parcela, deletePayment.id));
    setDeletePayment(null);
  };

  const handleRegisterPayment = (details) => {
    onUpdateParcela(applyPaymentToInstallment(parcela, details.valor, details));
    setPaymentOpen(false);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Parcela ${parcela.parcelaNumero}/${parcela.parcelaTotal}`}
        size="lg"
        footer={
          <FormActions>
            <Button variant="secondary" onClick={() => onViewObra?.(obra.id)}>
              <ExternalLink size={16} /> Ver obra
            </Button>
            {restante > 0 && (
              <Button onClick={() => setPaymentOpen(true)}>Registrar pagamento</Button>
            )}
          </FormActions>
        }
      >
        <div className={shared.detailGrid} style={{ gridTemplateColumns: '1fr' }}>
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Cliente</span>
            <span className={shared.detailValue}>{obra.cliente}</span>
          </div>
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Obra</span>
            <span className={shared.detailValue}>{obra.nome}</span>
          </div>
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Valor</span>
            <span className={shared.detailValue}>{formatCurrency(parcela.valor)}</span>
          </div>
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Vencimento</span>
            <span className={shared.detailValue}>{parcela.dataVencimento ? formatDate(parcela.dataVencimento) : '—'}</span>
          </div>
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Status</span>
            <span className={shared.detailValue}><Badge variant={parcelaStatusVariant(status)}>{status}</Badge></span>
          </div>
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Total pago</span>
            <span className={shared.detailValue}>{formatCurrency(recebido)}</span>
          </div>
          <div className={shared.detailRow}>
            <span className={shared.detailLabel}>Restante</span>
            <span className={shared.detailValue}>{formatCurrency(restante)}</span>
          </div>
        </div>

        <h4 className={shared.detailCardTitle} style={{ marginTop: '1.25rem' }}>Histórico de pagamentos</h4>
        <PaymentHistory
          historico={parcela.historicoPagamentos || []}
          onEdit={openEditPayment}
          onDelete={setDeletePayment}
        />
      </Modal>

      <InstallmentPaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        parcela={parcela}
        onSubmit={handleRegisterPayment}
      />

      <Modal
        isOpen={Boolean(editPayment)}
        onClose={() => setEditPayment(null)}
        title="Editar pagamento"
        footer={
          <FormActions>
            <Button variant="secondary" onClick={() => setEditPayment(null)}>Cancelar</Button>
            <Button onClick={saveEditPayment}>Guardar</Button>
          </FormActions>
        }
      >
        <FormGroup label="Valor (€)">
          <Input value={editForm.valor} onChange={(e) => setEditForm((prev) => ({ ...prev, valor: e.target.value }))} type="number" step="0.01" />
        </FormGroup>
        <FormGroup label="Data">
          <Input value={editForm.data} onChange={(e) => setEditForm((prev) => ({ ...prev, data: e.target.value }))} type="date" />
        </FormGroup>
        <FormGroup label="Forma de pagamento">
          <Select value={editForm.metodoPagamento} onChange={(e) => setEditForm((prev) => ({ ...prev, metodoPagamento: e.target.value }))}>
            {METODOS_PAGAMENTO.map((metodo) => (
              <option key={metodo} value={metodo}>{metodo}</option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label="Observação">
          <Input value={editForm.observacao} onChange={(e) => setEditForm((prev) => ({ ...prev, observacao: e.target.value }))} />
        </FormGroup>
      </Modal>

      {deletePayment && (
        <ConfirmDialog
          isOpen={Boolean(deletePayment)}
          onClose={() => setDeletePayment(null)}
          onConfirm={confirmDeletePayment}
          title="Excluir pagamento?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este pagamento do histórico?</p>
        </ConfirmDialog>
      )}
    </>
  );
}
