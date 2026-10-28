import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormActions, FormGroup, Input } from '../Form/Form';
import { useApp } from '../../context/AppContext';
import {
  applyViaVerdeDistribuicao,
  getViaVerdeDistribuicao,
  summarizeViaVerde,
  VIA_VERDE_STATUS,
  VIA_VERDE_STATUS_LABELS,
} from '../../utils/empresaFinanceiroCalculations';
import { formatCurrency } from '../../utils/formatters';
import { roundMoney } from '../../utils/ivaCalculations';

export default function ViaVerdeDistribuicaoModal({ isOpen, onClose, gasto = null, onSubmit }) {
  const { empresaVeiculos = [] } = useApp();
  const veiculos = empresaVeiculos.filter((item) => item.ativo !== false);
  const [valores, setValores] = useState({});

  useEffect(() => {
    if (!isOpen || !gasto) return;
    const next = {};
    veiculos.forEach((veiculo) => {
      next[veiculo.id] = '';
    });
    getViaVerdeDistribuicao(gasto).forEach((linha) => {
      if (linha.veiculoId) next[linha.veiculoId] = String(linha.valor ?? '');
    });
    setValores(next);
  }, [isOpen, gasto, veiculos.map((item) => item.id).join('|')]);

  const linhas = useMemo(
    () =>
      veiculos.map((veiculo) => ({
        veiculoId: veiculo.id,
        valor: parseFloat(String(valores[veiculo.id] || '').replace(',', '.')) || 0,
      })),
    [veiculos, valores]
  );

  const preview = useMemo(() => {
    if (!gasto) return { debito: 0, distribuido: 0, diferenca: 0, status: VIA_VERDE_STATUS.POR_CONFERIR };
    return summarizeViaVerde(applyViaVerdeDistribuicao(gasto, linhas));
  }, [gasto, linhas]);

  if (!gasto) return null;

  const handleChange = (veiculoId, value) => {
    setValores((prev) => ({ ...prev, [veiculoId]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(applyViaVerdeDistribuicao(gasto, linhas));
  };

  const handleGeral = () => {
    onSubmit(applyViaVerdeDistribuicao(gasto, [], { marcarGeral: true }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Distribuir Via Verde"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" type="button" onClick={handleGeral}>
            Via Verde — Geral
          </Button>
          <Button type="submit" form="via-verde-distribuicao-form">
            Guardar distribuição
          </Button>
        </FormActions>
      }
    >
      <form id="via-verde-distribuicao-form" onSubmit={handleSubmit}>
        <p style={{ marginTop: 0 }}>
          Débito bancário de {formatCurrency(preview.debito)} em {gasto.data || '—'}. A distribuição não cria um
          novo gasto: o total continua a ser o valor que saiu da conta.
        </p>
        <div style={{ display: 'grid', gap: '0.65rem', marginBottom: '1rem' }}>
          {veiculos.map((veiculo) => (
            <FormGroup key={veiculo.id} label={veiculo.nome}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={valores[veiculo.id] ?? ''}
                onChange={(e) => handleChange(veiculo.id, e.target.value)}
                placeholder="0,00"
              />
            </FormGroup>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          Débito: <strong>{formatCurrency(preview.debito)}</strong>
          {' · '}
          Distribuído: <strong>{formatCurrency(preview.distribuido)}</strong>
          {' · '}
          Diferença: <strong>{formatCurrency(roundMoney(preview.diferenca))}</strong>
          {' · '}
          Status: {VIA_VERDE_STATUS_LABELS[preview.status] || preview.status}
        </p>
      </form>
    </Modal>
  );
}
