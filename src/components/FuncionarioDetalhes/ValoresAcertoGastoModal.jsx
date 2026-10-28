import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, FormActions } from '../Form/Form';
import { validateRequired, validateNumber, validateForm } from '../../utils/validators';

const emptyForm = () => ({
  descricao: '',
  valor: '',
});

export default function ValoresAcertoGastoModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyForm());
    setErrors({});
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      descricao: validateRequired(form.descricao, 'Descrição do gasto'),
      valor: validateNumber(form.valor, 'Valor', 0.01),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit({
      descricao: form.descricao,
      valor: parseFloat(form.valor),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar gasto"
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Guardar</Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormGroup label="Descrição do gasto" required error={errors.descricao}>
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            error={errors.descricao}
          />
        </FormGroup>
        <FormGroup label="Valor (€)" required error={errors.valor}>
          <Input
            name="valor"
            type="number"
            step="0.01"
            value={form.valor}
            onChange={handleChange}
            error={errors.valor}
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
