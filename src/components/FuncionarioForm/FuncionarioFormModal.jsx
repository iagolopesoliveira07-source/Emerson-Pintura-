import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, FormRow, FormActions } from '../Form/Form';
import { FUNCIONARIO_ESTADOS } from '../../data/mockData';
import { FREQUENCIA_PAGAMENTO } from '../../utils/pagamentoPeriodCalculations';
import { TIPO_FUNCIONARIO, TIPO_FUNCIONARIO_OPTIONS } from '../../utils/funcionarioTipo';
import {
  EMPTY_FUNCIONARIO_FORM,
  funcionarioToForm,
  validateFuncionarioForm,
  isFuncionarioFormDirty,
} from '../../utils/funcionarioForm';

export default function FuncionarioFormModal({
  isOpen,
  onClose,
  mode = 'create',
  funcionario = null,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_FUNCIONARIO_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_FUNCIONARIO_FORM);
  const [errors, setErrors] = useState({});

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Editar funcionário' : 'Novo funcionário';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Guardar';

  useEffect(() => {
    if (!isOpen) return;

    const initial = isEdit && funcionario ? funcionarioToForm(funcionario) : EMPTY_FUNCIONARIO_FORM;

    setForm(initial);
    setInitialForm(initial);
    setErrors({});
  }, [isOpen, isEdit, funcionario]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'tipo' && value === TIPO_FUNCIONARIO.PARCEIRO) {
        next.valorDiaria = '0';
        next.frequenciaPagamento = '';
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleClose = () => {
    if (isFuncionarioFormDirty(form, initialForm)) {
      const confirmed = window.confirm('Tem certeza que deseja sair sem salvar as alterações?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateFuncionarioForm(form);
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
          <Button type="submit" form="funcionario-form">
            {submitLabel}
          </Button>
        </FormActions>
      }
    >
      <form id="funcionario-form" onSubmit={handleSubmit}>
        <FormGroup label="Nome" required error={errors.nome}>
          <Input name="nome" value={form.nome} onChange={handleChange} error={errors.nome} />
        </FormGroup>
        <FormGroup label="Tipo">
          <Select name="tipo" value={form.tipo} onChange={handleChange}>
            {TIPO_FUNCIONARIO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormGroup>
        {form.tipo === TIPO_FUNCIONARIO.PARCEIRO ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Parceiro de obras. As diárias servem só para saber onde e quando trabalhou. Não geram
            pagamento nem entram na folha dos funcionários.
          </p>
        ) : null}
        <FormRow>
          <FormGroup label="Telefone" error={errors.telefone}>
            <Input name="telefone" value={form.telefone} onChange={handleChange} error={errors.telefone} />
          </FormGroup>
          {form.tipo === TIPO_FUNCIONARIO.PARCEIRO ? null : (
          <FormGroup label="Valor da diária (€)" required error={errors.valorDiaria}>
            <Input
              name="valorDiaria"
              type="number"
              step="0.01"
              value={form.valorDiaria}
              onChange={handleChange}
              error={errors.valorDiaria}
            />
          </FormGroup>
          )}
        </FormRow>
        <FormGroup label="Estado">
          <Select name="estado" value={form.estado} onChange={handleChange}>
            {FUNCIONARIO_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </FormGroup>
        {form.tipo === TIPO_FUNCIONARIO.PARCEIRO ? null : (
        <FormGroup label="Frequência de pagamento">
          <Select name="frequenciaPagamento" value={form.frequenciaPagamento} onChange={handleChange}>
            {Object.values(FREQUENCIA_PAGAMENTO).map((freq) => (
              <option key={freq} value={freq}>
                {freq}
              </option>
            ))}
          </Select>
        </FormGroup>
        )}
      </form>
    </Modal>
  );
}
