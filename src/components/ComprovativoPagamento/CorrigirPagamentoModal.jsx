import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormActions } from '../Form/Form';
import { formatCurrency } from '../../utils/formatters';
import { getComprovativoSecoes } from '../../utils/comprovativoPagamento';

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export default function CorrigirPagamentoModal({ isOpen, onClose, comprovativo, onConfirm }) {
  const [acrescimos, setAcrescimos] = useState([]);
  const [descontos, setDescontos] = useState([]);
  const [adiantamentos, setAdiantamentos] = useState([]);
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (!isOpen || !comprovativo) return;
    const secoes = getComprovativoSecoes(comprovativo);
    setAcrescimos(secoes.acrescimos.map((item) => ({ ...item })));
    setDescontos(secoes.descontos.map((item) => ({ ...item })));
    setAdiantamentos(secoes.adiantamentos.map((item) => ({ ...item })));
    setObservacao('');
  }, [isOpen, comprovativo]);

  const total = useMemo(() => {
    const plus = acrescimos.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
    const minus = descontos.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
    const ads = adiantamentos.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
    return roundMoney((comprovativo?.subtotalDiarias || 0) + plus - minus - ads);
  }, [acrescimos, descontos, adiantamentos, comprovativo]);

  if (!comprovativo) return null;

  const updateLine = (setter, index, field, value) => {
    setter((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { snapshotOriginal, fechamentoId, corrigidoEm, correcaoObservacao, reconstruido, ...rest } =
      comprovativo;
    onConfirm(
      {
        ...rest,
        versao: 2,
        acrescimos: acrescimos
          .map((item) => ({ ...item, valor: roundMoney(item.valor) }))
          .filter((item) => Number(item.valor) > 0),
        descontos: descontos
          .map((item) => ({ ...item, valor: roundMoney(item.valor) }))
          .filter((item) => Number(item.valor) > 0),
        adiantamentos: adiantamentos
          .map((item) => ({ ...item, valor: roundMoney(item.valor) }))
          .filter((item) => Number(item.valor) > 0),
        totalPago: total,
        geradoEm: new Date().toISOString(),
      },
      observacao
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Corrigir pagamento"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="corrigir-comprovativo">
            Guardar correcção
          </Button>
        </FormActions>
      }
    >
      <form id="corrigir-comprovativo" onSubmit={handleSubmit}>
        <p style={{ marginTop: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          As diárias deste pagamento ficam iguais. Só os ajustes e o total são alterados. O
          comprovativo original permanece guardado.
        </p>
        <p>
          Subtotal das diárias: <strong>{formatCurrency(comprovativo.subtotalDiarias)}</strong>
        </p>
        {acrescimos.map((item, index) => (
          <FormGroup key={`a-${index}`} label={`Acréscimo ${index + 1}`}>
            <Input
              value={item.descricao || ''}
              onChange={(e) => updateLine(setAcrescimos, index, 'descricao', e.target.value)}
              placeholder="Descrição"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.valor}
              onChange={(e) => updateLine(setAcrescimos, index, 'valor', e.target.value)}
              style={{ marginTop: '0.4rem' }}
            />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setAcrescimos((prev) => prev.filter((_, i) => i !== index))}
              style={{ marginTop: '0.4rem' }}
            >
              Remover
            </Button>
          </FormGroup>
        ))}
        {descontos.map((item, index) => (
          <FormGroup key={`d-${index}`} label={`Desconto ${index + 1}`}>
            <Input
              value={item.descricao || ''}
              onChange={(e) => updateLine(setDescontos, index, 'descricao', e.target.value)}
              placeholder="Descrição"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.valor}
              onChange={(e) => updateLine(setDescontos, index, 'valor', e.target.value)}
              style={{ marginTop: '0.4rem' }}
            />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setDescontos((prev) => prev.filter((_, i) => i !== index))}
              style={{ marginTop: '0.4rem' }}
            >
              Remover
            </Button>
          </FormGroup>
        ))}
        {adiantamentos.map((item, index) => (
          <FormGroup key={`ad-${index}`} label={`Adiantamento ${index + 1}`}>
            <Input
              type="date"
              value={item.data || ''}
              onChange={(e) => updateLine(setAdiantamentos, index, 'data', e.target.value)}
            />
            <Input
              value={item.descricao || ''}
              onChange={(e) => updateLine(setAdiantamentos, index, 'descricao', e.target.value)}
              placeholder="Descrição"
              style={{ marginTop: '0.4rem' }}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.valor}
              onChange={(e) => updateLine(setAdiantamentos, index, 'valor', e.target.value)}
              style={{ marginTop: '0.4rem' }}
            />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setAdiantamentos((prev) => prev.filter((_, i) => i !== index))}
              style={{ marginTop: '0.4rem' }}
            >
              Remover
            </Button>
          </FormGroup>
        ))}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() =>
              setAcrescimos((prev) => [...prev, { categoria: 'outro', descricao: '', valor: '' }])
            }
          >
            Adicionar acréscimo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() =>
              setDescontos((prev) => [...prev, { categoria: 'outro', descricao: '', valor: '' }])
            }
          >
            Adicionar desconto
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() =>
              setAdiantamentos((prev) => [
                ...prev,
                { categoria: 'adiantamento', descricao: 'Adiantamento', valor: '', data: '' },
              ])
            }
          >
            Adicionar adiantamento
          </Button>
        </div>
        <FormGroup label="Motivo da correcção">
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
        </FormGroup>
        <p>
          Novo total pago: <strong>{formatCurrency(total)}</strong>
        </p>
      </form>
    </Modal>
  );
}
