import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../Form/Form';
import { PAGAMENTO_TIPOS, METODOS_PAGAMENTO } from '../../data/mockData';
import {
  EMPTY_PAGAMENTO_FORM,
  pagamentoToForm,
  validatePagamentoForm,
  isPagamentoFormDirty,
  getEmptyPagamentoForm,
} from '../../utils/pagamentoForm';
import { HELP } from '../../utils/helpTexts';

export default function PagamentoFormModal({
  isOpen,
  onClose,
  mode = 'create',
  pagamento = null,
  obras = [],
  fixedObraId = null,
  defaultPessoaRelacionada = '',
  fixedTipo = null,
  lockRecebimento = false,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_PAGAMENTO_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_PAGAMENTO_FORM);
  const [errors, setErrors] = useState({});

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Editar pagamento' : 'Registar pagamento';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Guardar';

  useEffect(() => {
    if (!isOpen) return;

    let initial =
      isEdit && pagamento
        ? pagamentoToForm(pagamento)
        : getEmptyPagamentoForm({
            ...(fixedObraId ? { obraId: fixedObraId } : {}),
            ...(defaultPessoaRelacionada ? { pessoaRelacionada: defaultPessoaRelacionada } : {}),
            ...(fixedTipo ? { tipo: fixedTipo } : {}),
            ...(lockRecebimento ? { tipo: 'Recebimento de cliente' } : {}),
          });

    setForm(initial);
    setInitialForm(initial);
    setErrors({});
  }, [isOpen, isEdit, pagamento, fixedObraId, defaultPessoaRelacionada, fixedTipo, lockRecebimento]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleClose = () => {
    if (isPagamentoFormDirty(form, initialForm)) {
      const confirmed = window.confirm('Tem certeza que deseja sair sem salvar as alterações?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validatePagamentoForm(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form="pagamento-form">
            {submitLabel}
          </Button>
        </FormActions>
      }
    >
      <form id="pagamento-form" onSubmit={handleSubmit}>
        {!lockRecebimento && !fixedTipo && (
          <FormGroup label="Tipo" required error={errors.tipo}>
            <Select name="tipo" value={form.tipo} onChange={handleChange}>
              {PAGAMENTO_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormGroup>
        )}
        <FormGroup label="Descrição" required error={errors.descricao}>
          <Input name="descricao" value={form.descricao} onChange={handleChange} error={errors.descricao} />
        </FormGroup>
        <FormRow>
          <FormGroup
            label="Valor (€)"
            required
            error={errors.valor}
            help={form.tipo === 'Recebimento de cliente' ? HELP.recebimento.recebido : undefined}
          >
            <Input
              name="valor"
              type="number"
              step="0.01"
              value={form.valor}
              onChange={handleChange}
              error={errors.valor}
            />
          </FormGroup>
          <FormGroup label="Data" required error={errors.data}>
            <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
          </FormGroup>
        </FormRow>
        <FormRow>
          {!fixedObraId && (
            <FormGroup label="Obra relacionada">
              <Select name="obraId" value={form.obraId} onChange={handleChange}>
                <option value="">Nenhuma</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </Select>
            </FormGroup>
          )}
          <FormGroup label="Pessoa/Empresa">
            <Input
              name="pessoaRelacionada"
              value={form.pessoaRelacionada}
              onChange={handleChange}
              readOnly={Boolean(fixedTipo)}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Método de pagamento">
          <Select name="metodoPagamento" value={form.metodoPagamento} onChange={handleChange}>
            {METODOS_PAGAMENTO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
