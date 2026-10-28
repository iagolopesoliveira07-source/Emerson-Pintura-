import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../Form/Form';
import {
  HOTEL_DOMME_STATUS,
  HOTEL_DOMME_TIPOS,
  validateHotelDommeMovimentoForm,
} from '../../utils/hotelDommeCalculations';

const emptyForm = {
  data: new Date().toISOString().slice(0, 10),
  tipo: HOTEL_DOMME_TIPOS.EMERGENCIA,
  descricao: '',
  valor: '',
  funcionariosEnvolvidos: '',
  observacoes: '',
  status: HOTEL_DOMME_STATUS.REALIZADO,
};

export default function HotelDommeTrabalhoFormModal({
  isOpen,
  onClose,
  onSubmit,
  movimento = null,
}) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(movimento);

  useEffect(() => {
    if (!isOpen) return;
    if (movimento) {
      setForm({
        data: movimento.data || new Date().toISOString().slice(0, 10),
        tipo: movimento.tipo || HOTEL_DOMME_TIPOS.EMERGENCIA,
        descricao: movimento.descricao || '',
        valor: String(Math.abs(movimento.valor || 0)),
        funcionariosEnvolvidos: (movimento.funcionariosEnvolvidos || []).join(', '),
        observacoes: movimento.observacoes || '',
        status: movimento.status || HOTEL_DOMME_STATUS.REALIZADO,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [isOpen, movimento]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateHotelDommeMovimentoForm(form, movimento);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSubmit(validation.payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar trabalho/emergência' : 'Registrar trabalho/emergência'}
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEdit ? 'Guardar' : 'Registrar'}</Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormRow>
          <FormGroup label="Data" required error={errors.data}>
            <Input
              name="data"
              type="date"
              value={form.data}
              onChange={handleChange}
              error={errors.data}
            />
          </FormGroup>
          <FormGroup label="Tipo" required error={errors.tipo}>
            <Select name="tipo" value={form.tipo} onChange={handleChange}>
              <option value={HOTEL_DOMME_TIPOS.TRABALHO}>Trabalho</option>
              <option value={HOTEL_DOMME_TIPOS.EMERGENCIA}>Emergência</option>
              <option value={HOTEL_DOMME_TIPOS.AJUSTE}>Ajuste manual</option>
            </Select>
          </FormGroup>
        </FormRow>

        <FormGroup label="Descrição do serviço" required error={errors.descricao}>
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            placeholder="Ex: Emergência — quarto 302"
            error={errors.descricao}
          />
        </FormGroup>

        <FormRow>
          <FormGroup
            label={form.tipo === HOTEL_DOMME_TIPOS.AJUSTE ? 'Valor do ajuste (€)' : 'Valor (€)'}
            required
            error={errors.valor}
          >
            <Input
              name="valor"
              type="number"
              min={form.tipo === HOTEL_DOMME_TIPOS.AJUSTE ? undefined : '0.01'}
              step="0.01"
              value={form.valor}
              onChange={handleChange}
              error={errors.valor}
            />
          </FormGroup>
          <FormGroup label="Status">
            <Select name="status" value={form.status} onChange={handleChange}>
              <option value={HOTEL_DOMME_STATUS.REALIZADO}>Realizado</option>
              <option value={HOTEL_DOMME_STATUS.PENDENTE}>Pendente</option>
            </Select>
          </FormGroup>
        </FormRow>

        <FormGroup label="Funcionários envolvidos (opcional)">
          <Input
            name="funcionariosEnvolvidos"
            value={form.funcionariosEnvolvidos}
            onChange={handleChange}
            placeholder="Ex: Rosselito, Lucas"
          />
        </FormGroup>

        <FormGroup label="Observações">
          <Textarea
            name="observacoes"
            value={form.observacoes}
            onChange={handleChange}
            rows={3}
          />
        </FormGroup>

        {form.status === HOTEL_DOMME_STATUS.PENDENTE && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Trabalhos pendentes não consomem crédito até serem marcados como realizados.
          </p>
        )}
      </form>
    </Modal>
  );
}
