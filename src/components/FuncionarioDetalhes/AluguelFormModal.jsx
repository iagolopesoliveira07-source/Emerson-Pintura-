import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, FormRow, FormActions } from '../Form/Form';
import { ALUGUEL_ESTADOS } from '../../utils/funcionarioForm';
import {
  TIPO_COBRANCA,
  getParcelasDescontadas,
  getParcelasRestantesLabelFromValues,
} from '../../utils/commitmentCalculations';
import { validateRequired, validateNumber, validateForm } from '../../utils/validators';
import styles from './Commitments.module.css';

const emptyForm = (defaultTipo = TIPO_COBRANCA.RECORRENTE) => ({
  tipoCobranca: defaultTipo,
  descricao: '',
  valorMensal: '',
  totalParcelas: '4',
  parcelaAtual: '0',
  estado: 'Ativo',
});

export default function AluguelFormModal({
  isOpen,
  onClose,
  onSubmit,
  aluguel = null,
  defaultTipoCobranca = TIPO_COBRANCA.RECORRENTE,
}) {
  const [form, setForm] = useState(emptyForm(defaultTipoCobranca));
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(aluguel);
  const isParcelado = form.tipoCobranca === TIPO_COBRANCA.PARCELADO;

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      aluguel
        ? {
            tipoCobranca: aluguel.tipoCobranca || TIPO_COBRANCA.RECORRENTE,
            descricao: aluguel.descricao || '',
            valorMensal: String(aluguel.valorMensal ?? ''),
            totalParcelas: String(aluguel.totalParcelas ?? '4'),
            parcelaAtual: String(getParcelasDescontadas(aluguel)),
            estado: aluguel.estado || 'Ativo',
          }
        : emptyForm(defaultTipoCobranca)
    );
    setErrors({});
  }, [isOpen, aluguel, defaultTipoCobranca]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleTipoChange = (tipoCobranca) => {
    if (isEdit) return;
    setForm((prev) => ({ ...prev, tipoCobranca }));
    setErrors({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      descricao: validateRequired(form.descricao, 'Descrição'),
      valorMensal: validateNumber(
        form.valorMensal,
        isParcelado ? 'Valor da parcela' : 'Valor mensal',
        0.01
      ),
    });

    if (isParcelado) {
      const totalParcelas = parseInt(form.totalParcelas, 10);
      const parcelasDescontadas = parseInt(form.parcelaAtual, 10);
      if (!totalParcelas || totalParcelas < 1) {
        validation.errors.totalParcelas = 'Informe o total de parcelas';
        validation.isValid = false;
      }
      if (
        Number.isNaN(parcelasDescontadas) ||
        parcelasDescontadas < 0 ||
        parcelasDescontadas > totalParcelas
      ) {
        validation.errors.parcelaAtual = `Parcelas descontadas deve estar entre 0 e ${totalParcelas || '?'}`;
        validation.isValid = false;
      }
    }

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSubmit(form);
  };

  const previewLabel = isParcelado
    ? getParcelasRestantesLabelFromValues(form.parcelaAtual, form.totalParcelas)
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar aluguel' : 'Adicionar aluguel'}
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEdit ? 'Guardar' : 'Adicionar'}</Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormGroup label="Tipo de cobrança">
          <div className={styles.tipoSelector}>
            {[TIPO_COBRANCA.RECORRENTE, TIPO_COBRANCA.PARCELADO].map((tipo) => (
              <label key={tipo} className={styles.tipoOption}>
                <input
                  type="radio"
                  name="tipoCobranca"
                  checked={form.tipoCobranca === tipo}
                  onChange={() => handleTipoChange(tipo)}
                  disabled={isEdit}
                />
                {tipo === TIPO_COBRANCA.RECORRENTE ? 'Recorrente' : 'Parcelado'}
              </label>
            ))}
          </div>
        </FormGroup>

        <FormGroup label="Descrição" required error={errors.descricao}>
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            error={errors.descricao}
            placeholder={isParcelado ? 'Ex: Equipamento' : 'Ex: Aluguel Casa'}
          />
        </FormGroup>

        {isParcelado ? (
          <>
            <FormGroup label="Valor da parcela (€)" required error={errors.valorMensal}>
              <Input
                name="valorMensal"
                type="number"
                step="0.01"
                value={form.valorMensal}
                onChange={handleChange}
                error={errors.valorMensal}
              />
            </FormGroup>

            <FormRow>
              <FormGroup label="Parcelas descontadas" required error={errors.parcelaAtual}>
                <Input
                  name="parcelaAtual"
                  type="number"
                  min="0"
                  step="1"
                  value={form.parcelaAtual}
                  onChange={handleChange}
                  error={errors.parcelaAtual}
                />
              </FormGroup>
              <FormGroup label="Total de parcelas" required error={errors.totalParcelas}>
                <Input
                  name="totalParcelas"
                  type="number"
                  min="1"
                  step="1"
                  value={form.totalParcelas}
                  onChange={handleChange}
                  error={errors.totalParcelas}
                />
              </FormGroup>
            </FormRow>

            {form.totalParcelas && form.parcelaAtual !== '' && (
              <div className={styles.parcelaPreview}>
                <span className={styles.parcelaPreviewTitle}>PARCELAS DESCONTADAS</span>
                <strong className={styles.parcelaPreviewValue}>
                  {form.parcelaAtual} / {form.totalParcelas}
                </strong>
                {previewLabel && (
                  <span className={styles.parcelaPreviewHint}>{previewLabel}</span>
                )}
              </div>
            )}

            <FormGroup label="Estado">
              <Select name="estado" value={form.estado} onChange={handleChange}>
                {ALUGUEL_ESTADOS.filter((estado) => estado !== 'Concluído' || isEdit).map((estado) => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </Select>
            </FormGroup>
          </>
        ) : (
          <>
            <FormGroup label="Valor mensal (€)" required error={errors.valorMensal}>
              <Input
                name="valorMensal"
                type="number"
                step="0.01"
                value={form.valorMensal}
                onChange={handleChange}
                error={errors.valorMensal}
              />
            </FormGroup>

            <FormGroup label="Estado">
              <Select name="estado" value={form.estado} onChange={handleChange}>
                {ALUGUEL_ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </Select>
            </FormGroup>
          </>
        )}
      </form>
    </Modal>
  );
}
