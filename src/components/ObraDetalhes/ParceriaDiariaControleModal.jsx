import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormActions } from '../Form/Form';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import { validateNumber, validateForm } from '../../utils/validators';
import { PARCERIA_CUSTO_DIARIA_FUNCIONARIO } from '../../utils/obraPartnership';

export default function ParceriaDiariaControleModal({
  isOpen,
  onClose,
  diaria,
  funcionario,
  onSubmit,
}) {
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!isOpen || !diaria) return;
    const guardado = Number(diaria.valorControleParceria);
    const inicial = Number.isFinite(guardado) && guardado > 0.004
      ? guardado
      : PARCERIA_CUSTO_DIARIA_FUNCIONARIO;
    setValor(String(Math.round(inicial * 100) / 100));
    setObservacao(diaria.observacao || '');
    setErro('');
  }, [isOpen, diaria]);

  if (!diaria) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateForm({
      valor: validateNumber(valor, 'Valor da diária na parceria', 0.01),
    });
    if (!validation.isValid) {
      setErro(validation.errors.valor);
      return;
    }
    onSubmit({ valor, observacao });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Valor da diária para controlo da parceria"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="parceria-diaria-controle">Guardar nesta obra</Button>
        </FormActions>
      }
    >
      <form id="parceria-diaria-controle" onSubmit={handleSubmit}>
        <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {funcionario?.nome || 'Funcionário'} · {formatDateOrNotInformed(diaria.data)}. Este valor fica só no controlo desta obra de parceria. O fechamento do funcionário continua em {formatCurrency(diaria.valorDiaria)}.
        </p>
        <FormGroup label="Valor desta diária na parceria (€)" required error={erro}>
          <Input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            value={valor}
            onChange={(event) => {
              setValor(event.target.value);
              setErro('');
            }}
            error={erro}
          />
        </FormGroup>
        <FormGroup label="Observação" hint="Opcional. Por exemplo: hora extra.">
          <Textarea
            name="observacao"
            value={observacao}
            onChange={(event) => setObservacao(event.target.value)}
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
