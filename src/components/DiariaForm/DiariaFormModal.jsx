import { useEffect, useId, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions, CalculatedValue } from '../Form/Form';
import { formatCurrency } from '../../utils/formatters';
import { isObraOperational } from '../../utils/obraStatus';
import ServicoAbatimentoSelect from '../ObraDetalhes/ServicoAbatimentoSelect';
import { HELP } from '../../utils/helpTexts';
import { isParceiroFuncionario } from '../../utils/funcionarioTipo';
import { DIARIA_FRACAO_OPTIONS } from '../../utils/diariaObraAlocacao';
import {
  EMPTY_DIARIA_FORM,
  diariaToForm,
  validateDiariaForm,
  isDiariaFormDirty,
  calcFormDiariaTotal,
  PARCEIRO_DIARIA_INICIAL,
} from '../../utils/diariaForm';
import ivaStyles from '../GastoForm/GastoForm.module.css';
import styles from './DiariaForm.module.css';

export default function DiariaFormModal({
  isOpen,
  onClose,
  mode = 'create',
  diaria = null,
  funcionarios = [],
  obras = [],
  fixedObraId = null,
  fixedIntervencaoId = null,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_DIARIA_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_DIARIA_FORM);
  const [errors, setErrors] = useState({});
  const formId = useId();

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Editar diária' : 'Registar diária';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Guardar';
  const multi = form.multiObra === 'sim';

  useEffect(() => {
    if (!isOpen) return;

    let initial = isEdit && diaria ? diariaToForm(diaria) : { ...EMPTY_DIARIA_FORM };
    if (fixedObraId && !isEdit) {
      initial = { ...initial, obraId: fixedObraId, obraId1: fixedObraId };
    }
    if (fixedIntervencaoId && !isEdit) {
      initial = { ...initial, intervencaoId: fixedIntervencaoId, intervencaoId1: fixedIntervencaoId };
    }

    setForm(initial);
    setInitialForm(initial);
    setErrors({});
  }, [isOpen, isEdit, diaria, fixedObraId, fixedIntervencaoId]);

  const totalCalculado = calcFormDiariaTotal(form);

  const funcionariosDisponiveis = (funcionarios || []).filter(
    (f) => f && (f.estado === 'Ativo' || f.id === form.funcionarioId)
  );

  const selectedIds = [form.obraId, form.obraId1, form.obraId2, fixedObraId].filter(Boolean);
  const obrasDisponiveis = (obras || []).filter(
    (o) => o && (isObraOperational(o.estado) || selectedIds.includes(o.id))
  );

  const selectedFuncionario = funcionarios.find((f) => f.id === form.funcionarioId) || null;
  const isParceiro = isParceiroFuncionario(selectedFuncionario);

  const handleFuncChange = (e) => {
    const funcId = e.target.value;
    const func = funcionarios.find((f) => f.id === funcId);
    const parceiro = isParceiroFuncionario(func);
    setForm((prev) => ({
      ...prev,
      funcionarioId: funcId,
      valorDiaria: !isEdit
        ? (parceiro ? String(PARCEIRO_DIARIA_INICIAL) : func ? String(func.valorDiaria) : prev.valorDiaria)
        : prev.valorDiaria,
    }));
    setErrors((prev) => ({ ...prev, funcionarioId: null }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'obraId' && value !== prev.obraId) next.intervencaoId = '';
      if (name === 'obraId1' && value !== prev.obraId1) next.intervencaoId1 = '';
      if (name === 'obraId2' && value !== prev.obraId2) next.intervencaoId2 = '';
      if (name === 'multiObra' && value === 'sim') {
        next.obraId1 = prev.obraId1 || prev.obraId || fixedObraId || '';
        next.quantidade = '1';
        if (!next.fracao1) next.fracao1 = '0.5';
        if (!next.fracao2) next.fracao2 = '0.5';
      }
      if (name === 'multiObra' && value === 'nao') {
        next.obraId = prev.obraId || prev.obraId1 || '';
        next.intervencaoId = prev.intervencaoId || prev.intervencaoId1 || '';
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleClose = () => {
    if (isDiariaFormDirty(form, initialForm)) {
      const confirmed = window.confirm('Tem certeza que deseja sair sem salvar as alterações?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateDiariaForm(form, { parceiro: isParceiro });
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
          <Button type="submit" form={formId}>
            {submitLabel}
          </Button>
        </FormActions>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <FormRow>
          <FormGroup label="Funcionário" required error={errors.funcionarioId}>
            <Select
              name="funcionarioId"
              value={form.funcionarioId}
              onChange={handleFuncChange}
              error={errors.funcionarioId}
            >
              <option value="">Seleccionar...</option>
              {funcionariosDisponiveis.map((f) => (
                <option key={f.id} value={f.id}>
                  {isParceiroFuncionario(f) ? `${f.nome} (Parceiro)` : f.nome}
                </option>
              ))}
            </Select>
          </FormGroup>
          {!multi ? (
            <FormGroup label="Obra (opcional)" error={errors.obraId}>
              <Select
                name="obraId"
                value={form.obraId}
                onChange={handleChange}
                error={errors.obraId}
                disabled={Boolean(fixedObraId)}
              >
                <option value="">Sem obra específica</option>
                {obrasDisponiveis.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </Select>
            </FormGroup>
          ) : (
            <FormGroup label="Data (opcional)" error={errors.data}>
              <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
            </FormGroup>
          )}
        </FormRow>

        <section className={ivaStyles.ivaSection} aria-labelledby="diaria-multi-title">
          <h3 id="diaria-multi-title" className={ivaStyles.ivaTitle}>
            Trabalhou em mais de uma obra neste dia?
          </h3>
          <div className={ivaStyles.radioGroup} role="radiogroup" aria-label="Trabalhou em mais de uma obra">
            <label className={ivaStyles.radioOption}>
              <input type="radio" name="multiObra" value="nao" checked={!multi} onChange={handleChange} />
              Não
            </label>
            <label className={ivaStyles.radioOption}>
              <input type="radio" name="multiObra" value="sim" checked={multi} onChange={handleChange} />
              Sim
            </label>
          </div>
        </section>

        {multi ? (
          <>
            <p className={styles.multiHint}>
              Continua a ser apenas 1 diária para pagamento. Nas obras aparece a parte correspondente
              (por exemplo ½ + ½), sem duplicar o valor.
            </p>
            <div className={styles.alocacaoBlock}>
              <p className={styles.alocacaoTitle}>1.ª obra</p>
              <FormGroup label="Obra" required error={errors.obraId1}>
                <Select
                  name="obraId1"
                  value={form.obraId1}
                  onChange={handleChange}
                  error={errors.obraId1}
                  disabled={Boolean(fixedObraId) && !isEdit}
                >
                  <option value="">Seleccionar...</option>
                  {obrasDisponiveis.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup label="Duração" required error={errors.fracao1}>
                <Select name="fracao1" value={form.fracao1} onChange={handleChange} error={errors.fracao1}>
                  {DIARIA_FRACAO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              {!fixedIntervencaoId ? (
                <ServicoAbatimentoSelect
                  obras={obrasDisponiveis}
                  obraId={form.obraId1}
                  name="intervencaoId1"
                  value={form.intervencaoId1}
                  onChange={handleChange}
                />
              ) : null}
            </div>
            <div className={styles.alocacaoBlock}>
              <p className={styles.alocacaoTitle}>2.ª obra</p>
              <FormGroup label="Obra" required error={errors.obraId2}>
                <Select name="obraId2" value={form.obraId2} onChange={handleChange} error={errors.obraId2}>
                  <option value="">Seleccionar...</option>
                  {obrasDisponiveis.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup label="Duração" required error={errors.fracao2}>
                <Select name="fracao2" value={form.fracao2} onChange={handleChange} error={errors.fracao2}>
                  {DIARIA_FRACAO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              <ServicoAbatimentoSelect
                obras={obrasDisponiveis}
                obraId={form.obraId2}
                name="intervencaoId2"
                value={form.intervencaoId2}
                onChange={handleChange}
              />
            </div>
          </>
        ) : (
          <>
            {!fixedIntervencaoId && (
              <ServicoAbatimentoSelect
                obras={obrasDisponiveis}
                obraId={form.obraId || fixedObraId}
                value={form.intervencaoId}
                onChange={handleChange}
              />
            )}
            <FormRow>
              <FormGroup label="Data (opcional)" error={errors.data}>
                <Input
                  name="data"
                  type="date"
                  value={form.data}
                  onChange={handleChange}
                  error={errors.data}
                />
              </FormGroup>
              <FormGroup label="Quantidade de diárias" required error={errors.quantidade}>
                <Input
                  name="quantidade"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={form.quantidade}
                  onChange={handleChange}
                  error={errors.quantidade}
                />
              </FormGroup>
            </FormRow>
          </>
        )}

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
        {isParceiro ? (
          <p className={styles.multiHint}>
            Controlo interno da obra para o Acerto. O valor fica só nesta diária.
          </p>
        ) : null}
        <CalculatedValue
          label={isParceiro ? 'Total desta diária' : multi ? 'Total a pagar (1 diária)' : 'Total calculado'}
          value={formatCurrency(totalCalculado)}
        />
        <FormGroup label="Observação" help={HELP.diaria.observacao}>
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
