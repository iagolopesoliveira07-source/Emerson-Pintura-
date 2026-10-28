import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormActions, FormRow } from '../Form/Form';
import { createIvaRegra } from '../../utils/empresaIvaRules';
import { HELP } from '../../utils/helpTexts';

export default function IvaRegrasModal({ isOpen, onClose, regras = [], onSave }) {
  const [items, setItems] = useState(regras);
  const [draft, setDraft] = useState({ categoria: '', percentagemDedutivel: '', observacao: '' });

  useEffect(() => {
    if (isOpen) setItems(regras);
  }, [isOpen, regras]);

  const handleToggle = (id) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ativo: !item.ativo } : item)));
  };

  const handlePercent = (id, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, percentagemDedutivel: value === '' ? null : Number(value) }
          : item
      )
    );
  };

  const handleAdd = () => {
    if (!draft.categoria.trim() || draft.percentagemDedutivel === '') return;
    setItems((prev) => [
      ...prev,
      createIvaRegra({
        categoria: draft.categoria.trim(),
        percentagemDedutivel: Number(draft.percentagemDedutivel),
        observacao: draft.observacao,
        prioridade: 40,
      }),
    ]);
    setDraft({ categoria: '', percentagemDedutivel: '', observacao: '' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuração de IVA"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(items);
              onClose();
            }}
          >
            Guardar regras
          </Button>
        </FormActions>
      }
    >
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
        Estas regras aplicam-se a gastos novos ou editados. Os gastos antigos não são recalculados.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
        {items.map((regra) => (
          <div key={regra.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.75rem' }}>
            <strong>{regra.categoria || 'Qualquer categoria'}</strong>
            {regra.veiculoSeedKeys?.length ? <div>Veículo específico</div> : null}
            <FormRow>
              <FormGroup label="Percentagem dedutível" help={HELP.iva.dedutivel}>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={regra.percentagemDedutivel ?? ''}
                  onChange={(e) => handlePercent(regra.id, e.target.value)}
                />
              </FormGroup>
              <FormGroup label="Ativa">
                <Select value={regra.ativo === false ? 'nao' : 'sim'} onChange={() => handleToggle(regra.id)}>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </Select>
              </FormGroup>
            </FormRow>
            {regra.observacao ? <p style={{ margin: 0, fontSize: '0.8125rem' }}>{regra.observacao}</p> : null}
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: '0.9375rem' }}>Nova regra</h3>
      <FormGroup label="Categoria">
        <Input
          value={draft.categoria}
          onChange={(e) => setDraft((prev) => ({ ...prev, categoria: e.target.value }))}
          placeholder="Ex.: Material"
        />
      </FormGroup>
      <FormGroup label="Percentagem dedutível" help={HELP.iva.dedutivel}>
        <Input
          type="number"
          min="0"
          max="100"
          value={draft.percentagemDedutivel}
          onChange={(e) => setDraft((prev) => ({ ...prev, percentagemDedutivel: e.target.value }))}
        />
      </FormGroup>
      <FormGroup label="Observação">
        <Textarea
          value={draft.observacao}
          onChange={(e) => setDraft((prev) => ({ ...prev, observacao: e.target.value }))}
        />
      </FormGroup>
      <Button type="button" variant="secondary" onClick={handleAdd}>
        Adicionar regra
      </Button>
    </Modal>
  );
}
