import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormActions, Select } from '../Form/Form';
import { validateRequired, validateNumber, validateForm } from '../../utils/validators';
import { getTodayISO } from '../../utils/formatters';
import { getAcertoData } from '../../utils/acertoCalculations';

const emptyForm = () => ({
  funcionarioId: '',
  obraId: '',
  motivo: '',
  valorEntregue: '',
  observacao: '',
  data: getTodayISO(),
});

export default function ValoresAcertoFormModal({
  isOpen,
  onClose,
  onSubmit,
  valorAcerto = null,
  funcionarios = [],
  obras = [],
  fixedFuncionarioId = null,
}) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(valorAcerto);
  const showFuncionario = !fixedFuncionarioId;

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      valorAcerto
        ? {
            funcionarioId: valorAcerto.funcionarioId || fixedFuncionarioId || '',
            obraId: valorAcerto.obraId || '',
            motivo: valorAcerto.motivo || '',
            valorEntregue: String(valorAcerto.valorEntregue ?? valorAcerto.valor ?? ''),
            observacao: valorAcerto.observacao || '',
            data: getAcertoData(valorAcerto),
          }
        : {
            ...emptyForm(),
            funcionarioId: fixedFuncionarioId || '',
          }
    );
    setErrors({});
  }, [isOpen, valorAcerto, fixedFuncionarioId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      ...(showFuncionario
        ? { funcionarioId: validateRequired(form.funcionarioId, 'Funcionário') }
        : {}),
      motivo: validateRequired(form.motivo, 'Motivo'),
      valorEntregue: validateNumber(form.valorEntregue, 'Valor entregue', 0.01),
      ...(!isEdit ? { data: validateRequired(form.data, 'Data do adiantamento') } : {}),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit({
      ...form,
      funcionarioId: fixedFuncionarioId || form.funcionarioId,
      obraId: form.obraId || null,
      valorEntregue: parseFloat(form.valorEntregue),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar valor para acerto' : 'Novo valor para acerto'}
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
        {showFuncionario && (
          <FormGroup label="Funcionário" required error={errors.funcionarioId}>
            <Select
              name="funcionarioId"
              value={form.funcionarioId}
              onChange={handleChange}
              error={errors.funcionarioId}
            >
              <option value="">Selecionar funcionário</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </FormGroup>
        )}

        <FormGroup label="Obra">
          <Select name="obraId" value={form.obraId} onChange={handleChange}>
            <option value="">Sem obra</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Data do adiantamento" required={!isEdit} error={errors.data}>
          <Input
            name="data"
            type="date"
            value={form.data}
            onChange={handleChange}
            error={errors.data}
          />
        </FormGroup>

        <FormGroup label="Motivo" required error={errors.motivo}>
          <Input name="motivo" value={form.motivo} onChange={handleChange} error={errors.motivo} />
        </FormGroup>

        <FormGroup label="Valor entregue (€)" required error={errors.valorEntregue}>
          <Input
            name="valorEntregue"
            type="number"
            step="0.01"
            value={form.valorEntregue}
            onChange={handleChange}
            error={errors.valorEntregue}
          />
        </FormGroup>

        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
