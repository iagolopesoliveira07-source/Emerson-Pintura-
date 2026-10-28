import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormActions } from '../Form/Form';
import {
  EMPTY_IVA_ENTREGAR_FORM,
  getEmptyIvaEntregarForm,
  ivaEntregarToForm,
  validateIvaEntregarForm,
  isIvaEntregarFormDirty,
} from '../../utils/ivaCalculations';

export default function IvaEntregarFormModal({
  isOpen,
  onClose,
  mode = 'create',
  record = null,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_IVA_ENTREGAR_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_IVA_ENTREGAR_FORM);
  const [errors, setErrors] = useState({});

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Editar IVA a entregar' : 'Registar IVA a entregar';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Guardar';

  useEffect(() => {
    if (!isOpen) return;
    const initial = isEdit && record ? ivaEntregarToForm(record) : getEmptyIvaEntregarForm();
    setForm(initial);
    setInitialForm(initial);
    setErrors({});
  }, [isOpen, isEdit, record]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleClose = () => {
    if (isIvaEntregarFormDirty(form, initialForm)) {
      const confirmed = window.confirm('Tem certeza que deseja sair sem salvar as alterações?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateIvaEntregarForm(form);
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
          <Button type="submit" form="iva-entregar-form">
            {submitLabel}
          </Button>
        </FormActions>
      }
    >
      <form id="iva-entregar-form" onSubmit={handleSubmit}>
        <FormGroup label="Data" required error={errors.data}>
          <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
        </FormGroup>

        <FormGroup
          label="Descrição / período"
          required
          error={errors.descricao}
          hint="Ex.: IVA 1.º trimestre 2026"
        >
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            error={errors.descricao}
            placeholder="Período ou descrição"
          />
        </FormGroup>

        <FormGroup label="Valor de IVA (€)" required error={errors.valor}>
          <Input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            value={form.valor}
            onChange={handleChange}
            error={errors.valor}
          />
        </FormGroup>

        <FormGroup label="Observação">
          <Textarea
            name="observacao"
            value={form.observacao}
            onChange={handleChange}
            placeholder="Opcional"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
