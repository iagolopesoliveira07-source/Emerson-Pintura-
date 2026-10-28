import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormActions, FormRow } from '../Form/Form';
import { createFornecedor, findFornecedorByNome } from '../../utils/empresaFornecedores';
import { HELP } from '../../utils/helpTexts';

export default function FornecedoresModal({ isOpen, onClose, fornecedores = [], onSave }) {
  const [items, setItems] = useState(fornecedores);
  const [draft, setDraft] = useState({
    nome: '',
    nif: '',
    categoriaPadrao: '',
    taxaMaisComum: '',
    percentagemIvaRecuperavel: '',
    observacoes: '',
  });

  useEffect(() => {
    if (isOpen) setItems(fornecedores);
  }, [isOpen, fornecedores]);

  const handleField = (id, field, value) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleAdd = () => {
    if (!draft.nome.trim()) return;
    if (findFornecedorByNome(items, draft.nome)) {
      window.alert('Já existe um fornecedor com este nome.');
      return;
    }
    setItems((prev) => [
      ...prev,
      createFornecedor({
        ...draft,
        taxaMaisComum: draft.taxaMaisComum === '' ? null : Number(draft.taxaMaisComum),
        percentagemIvaRecuperavel:
          draft.percentagemIvaRecuperavel === '' ? null : Number(draft.percentagemIvaRecuperavel),
      }),
    ]);
    setDraft({
      nome: '',
      nif: '',
      categoriaPadrao: '',
      taxaMaisComum: '',
      percentagemIvaRecuperavel: '',
      observacoes: '',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fornecedores"
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
            Guardar
          </Button>
        </FormActions>
      }
    >
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
        Desativar um fornecedor não apaga o histórico dos gastos.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
        {(items || []).filter((item) => item && item.id).map((item) => (
          <div key={item.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.75rem' }}>
            <FormGroup label="Nome">
              <Input value={item.nome} onChange={(e) => handleField(item.id, 'nome', e.target.value)} />
            </FormGroup>
            <FormGroup label="NIF">
              <Input value={item.nif || ''} onChange={(e) => handleField(item.id, 'nif', e.target.value)} />
            </FormGroup>
            <FormRow>
              <FormGroup label="Categoria padrão" help={HELP.iva.regraFornecedor}>
                <Input
                  value={item.categoriaPadrao || ''}
                  onChange={(e) => handleField(item.id, 'categoriaPadrao', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="Taxa IVA (%)" help={HELP.iva.taxa}>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.taxaMaisComum ?? ''}
                  onChange={(e) =>
                    handleField(item.id, 'taxaMaisComum', e.target.value === '' ? null : Number(e.target.value))
                  }
                />
              </FormGroup>
              <FormGroup label="% IVA recuperável" help={HELP.iva.dedutivel}>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.percentagemIvaRecuperavel ?? ''}
                  onChange={(e) =>
                    handleField(
                      item.id,
                      'percentagemIvaRecuperavel',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                />
              </FormGroup>
            </FormRow>
            <FormGroup label="Ativo">
              <Select
                value={item.ativo === false ? 'nao' : 'sim'}
                onChange={(e) => handleField(item.id, 'ativo', e.target.value !== 'nao')}
              >
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </Select>
            </FormGroup>
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: '0.9375rem' }}>Novo fornecedor</h3>
      <FormGroup label="Nome">
        <Input value={draft.nome} onChange={(e) => setDraft((prev) => ({ ...prev, nome: e.target.value }))} />
      </FormGroup>
      <FormRow>
        <FormGroup label="NIF">
          <Input value={draft.nif} onChange={(e) => setDraft((prev) => ({ ...prev, nif: e.target.value }))} />
        </FormGroup>
        <FormGroup label="Categoria padrão" help={HELP.iva.regraFornecedor}>
          <Input
            value={draft.categoriaPadrao}
            onChange={(e) => setDraft((prev) => ({ ...prev, categoriaPadrao: e.target.value }))}
          />
        </FormGroup>
      </FormRow>
      <FormRow>
        <FormGroup label="Taxa IVA (%)" help={HELP.iva.taxa}>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={draft.taxaMaisComum}
            onChange={(e) => setDraft((prev) => ({ ...prev, taxaMaisComum: e.target.value }))}
          />
        </FormGroup>
        <FormGroup label="% IVA recuperável" help={HELP.iva.dedutivel}>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={draft.percentagemIvaRecuperavel}
            onChange={(e) => setDraft((prev) => ({ ...prev, percentagemIvaRecuperavel: e.target.value }))}
          />
        </FormGroup>
      </FormRow>
      <FormGroup label="Observações">
        <Textarea
          value={draft.observacoes}
          onChange={(e) => setDraft((prev) => ({ ...prev, observacoes: e.target.value }))}
        />
      </FormGroup>
      <Button type="button" variant="secondary" onClick={handleAdd}>
        Adicionar fornecedor
      </Button>
    </Modal>
  );
}
