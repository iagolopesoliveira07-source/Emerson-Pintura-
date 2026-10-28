import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Button from '../Button/Button';
import Modal from '../Modal/Modal';
import { FormGroup, Input, Select, FormRow, FormActions } from '../Form/Form';
import { formatCurrency } from '../../utils/formatters';
import { validateRequired, validateNumber, validateForm } from '../../utils/validators';
import {
  ALUGUEL_ESTADOS,
  EMPRESTIMO_FORM_ESTADOS,
  createEmptyAluguel,
  createEmptyDescontoMensal,
  createEmptyEmprestimoFormItem,
  calcEmprestimoFormRestante,
} from '../../utils/funcionarioForm';
import styles from './EmployeeFinancialCommitments.module.css';

const COMMITMENT_LABELS = {
  emprestimo: 'Empréstimo',
  aluguel: 'Aluguel',
  desconto_mensal: 'Desconto mensal',
};

function CommitmentEditorModal({ isOpen, onClose, type, item, onSave }) {
  const [form, setForm] = useState(item);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...item,
        valorMensal: item.valorMensal != null ? String(item.valorMensal) : '',
        valor: item.valor != null ? String(item.valor) : '',
        numeroParcelas: item.numeroParcelas != null ? String(item.numeroParcelas) : '',
        valorParcela: item.valorParcela != null ? String(item.valorParcela) : '',
        valorPago: item.valorPago != null ? String(item.valorPago) : '0',
        dataInicio: item.dataInicio || '',
      });
      setErrors({});
    }
  }, [isOpen, item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (type === 'emprestimo' && (name === 'valor' || name === 'numeroParcelas')) {
        const valor = parseFloat(name === 'valor' ? value : prev.valor);
        const parcelas = parseInt(name === 'numeroParcelas' ? value : prev.numeroParcelas, 10);
        if (valor > 0 && parcelas > 0) {
          next.valorParcela = String(Math.round((valor / parcelas) * 100) / 100);
        }
      }

      if (type === 'emprestimo' && name === 'valorPago') {
        const valor = parseFloat(prev.valor) || 0;
        const valorPago = parseFloat(value) || 0;
        if (valor > 0 && valorPago >= valor) {
          next.estado = 'Quitado';
        } else if (next.estado === 'Quitado' && valorPago < valor) {
          next.estado = 'Em aberto';
        }
      }

      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let validation;
    if (type === 'emprestimo') {
      validation = validateForm({
        descricao: validateRequired(form.descricao, 'Descrição'),
        valor: validateNumber(form.valor, 'Valor total', 0.01),
        dataInicio: validateRequired(form.dataInicio, 'Data de início'),
        numeroParcelas: form.numeroParcelas
          ? validateNumber(form.numeroParcelas, 'Número de parcelas', 1)
          : null,
        valorParcela: form.valorParcela
          ? validateNumber(form.valorParcela, 'Valor da parcela', 0.01)
          : null,
      });
    } else {
      validation = validateForm({
        descricao: validateRequired(form.descricao, 'Descrição'),
        valorMensal: validateNumber(form.valorMensal, 'Valor mensal', 0.01),
        dataInicio: validateRequired(form.dataInicio, 'Data de início'),
      });
    }

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSave(form);
    onClose();
  };

  const restante =
    type === 'emprestimo' ? calcEmprestimoFormRestante(form) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${item?.id && !String(item.id).startsWith('temp-') ? 'Editar' : 'Adicionar'} ${COMMITMENT_LABELS[type].toLowerCase()}`}
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="commitment-form">
            Guardar
          </Button>
        </FormActions>
      }
    >
      <form id="commitment-form" onSubmit={handleSubmit}>
        <FormGroup label="Descrição" required error={errors.descricao}>
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            error={errors.descricao}
            placeholder={
              type === 'emprestimo'
                ? 'Ex: Empréstimo para carro'
                : type === 'aluguel'
                  ? 'Ex: Quarto'
                  : 'Ex: Alimentação'
            }
          />
        </FormGroup>

        {type === 'emprestimo' ? (
          <>
            <FormRow>
              <FormGroup label="Valor total (€)" required error={errors.valor}>
                <Input
                  name="valor"
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={handleChange}
                  error={errors.valor}
                />
              </FormGroup>
              <FormGroup label="Data de início" required error={errors.dataInicio}>
                <Input
                  name="dataInicio"
                  type="date"
                  value={form.dataInicio}
                  onChange={handleChange}
                  error={errors.dataInicio}
                />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Número de parcelas" error={errors.numeroParcelas}>
                <Input
                  name="numeroParcelas"
                  type="number"
                  min="1"
                  step="1"
                  value={form.numeroParcelas}
                  onChange={handleChange}
                  error={errors.numeroParcelas}
                />
              </FormGroup>
              <FormGroup label="Valor da parcela (€)" error={errors.valorParcela}>
                <Input
                  name="valorParcela"
                  type="number"
                  step="0.01"
                  value={form.valorParcela}
                  onChange={handleChange}
                  error={errors.valorParcela}
                />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Valor já pago (€)">
                <Input
                  name="valorPago"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorPago}
                  onChange={handleChange}
                />
              </FormGroup>
              <FormGroup label="Estado">
                <Select name="estado" value={form.estado} onChange={handleChange}>
                  {EMPRESTIMO_FORM_ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </Select>
              </FormGroup>
            </FormRow>
            {restante != null && (
              <p className={styles.itemMeta}>
                Valor restante: <strong>{formatCurrency(restante)}</strong>
              </p>
            )}
          </>
        ) : (
          <>
            <FormRow>
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
              <FormGroup label="Data de início" required error={errors.dataInicio}>
                <Input
                  name="dataInicio"
                  type="date"
                  value={form.dataInicio}
                  onChange={handleChange}
                  error={errors.dataInicio}
                />
              </FormGroup>
            </FormRow>
            <FormGroup label="Estado">
              <Select name="estado" value={form.estado} onChange={handleChange}>
                {ALUGUEL_ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </Select>
            </FormGroup>
          </>
        )}
      </form>
    </Modal>
  );
}

function CommitmentItem({ type, item, onEdit, onDelete }) {
  const isEmprestimo = type === 'emprestimo';

  return (
    <div className={styles.item}>
      <div className={styles.itemHeader}>
        <div>
          <div className={styles.itemType}>{COMMITMENT_LABELS[type]}</div>
          <div className={styles.itemTitle}>{item.descricao || '—'}</div>
        </div>
      </div>

      <div className={styles.itemMeta}>
        {isEmprestimo ? (
          <>
            {formatCurrency(parseFloat(item.valor) || 0)}
            {item.numeroParcelas ? (
              <>
                {' '}
                · {item.numeroParcelas} parcelas
                {item.valorParcela ? ` · ${formatCurrency(parseFloat(item.valorParcela))}/parcela` : ''}
              </>
            ) : null}
            <br />
            Pago: {formatCurrency(parseFloat(item.valorPago) || 0)} · Restante:{' '}
            {formatCurrency(calcEmprestimoFormRestante(item))} · {item.estado}
          </>
        ) : (
          <>
            {formatCurrency(parseFloat(item.valorMensal) || 0)}/mês · {item.estado}
          </>
        )}
      </div>

      <div className={styles.itemActions}>
        <Button variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>
          Editar
        </Button>
        <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
          Excluir
        </Button>
      </div>
    </div>
  );
}

export default function EmployeeFinancialCommitments({ form, setForm }) {
  const [editor, setEditor] = useState({ open: false, type: null, item: null, index: null });

  const allItems = [
    ...form.emprestimos.map((item, index) => ({ type: 'emprestimo', item, index })),
    ...form.alugueis.map((item, index) => ({ type: 'aluguel', item, index })),
    ...form.descontosMensais.map((item, index) => ({ type: 'desconto_mensal', item, index })),
  ];

  const openCreate = (type) => {
    const item =
      type === 'emprestimo'
        ? createEmptyEmprestimoFormItem()
        : type === 'aluguel'
          ? createEmptyAluguel()
          : createEmptyDescontoMensal();

    setEditor({ open: true, type, item, index: null });
  };

  const openEdit = (type, item, index) => {
    setEditor({ open: true, type, item: { ...item }, index });
  };

  const closeEditor = () => {
    setEditor({ open: false, type: null, item: null, index: null });
  };

  const getFormKey = (type) => {
    if (type === 'emprestimo') return 'emprestimos';
    if (type === 'aluguel') return 'alugueis';
    return 'descontosMensais';
  };

  const handleSave = (savedItem) => {
    const key = getFormKey(editor.type);

    setForm((prev) => {
      const list = [...prev[key]];
      const normalizedItem =
        editor.type === 'emprestimo'
          ? savedItem
          : {
              ...savedItem,
              valorMensal:
                savedItem.valorMensal !== '' ? parseFloat(savedItem.valorMensal) : savedItem.valorMensal,
            };

      if (editor.index == null) {
        list.push(normalizedItem);
      } else {
        list[editor.index] = normalizedItem;
      }

      return { ...prev, [key]: list };
    });
  };

  const handleDelete = (type, index) => {
    const key = getFormKey(type);
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <div className={styles.commitments}>
      <h3 className={styles.sectionTitle}>Descontos e compromissos</h3>
      <p className={styles.sectionDescription}>
        Empréstimos são integrados com a aba Empréstimos. Aluguéis e descontos mensais representam
        valores recorrentes por mês.
      </p>

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => openCreate('emprestimo')}>
          Adicionar empréstimo
        </Button>
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => openCreate('aluguel')}>
          Adicionar aluguel
        </Button>
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => openCreate('desconto_mensal')}>
          Adicionar desconto mensal
        </Button>
      </div>

      {allItems.length === 0 ? (
        <div className={styles.empty}>Nenhum desconto ou compromisso cadastrado.</div>
      ) : (
        <div className={styles.list}>
          {allItems.map(({ type, item, index }) => (
            <CommitmentItem
              key={`${type}-${item.id}`}
              type={type}
              item={item}
              onEdit={() => openEdit(type, item, index)}
              onDelete={() => handleDelete(type, index)}
            />
          ))}
        </div>
      )}

      {editor.open && (
        <CommitmentEditorModal
          isOpen={editor.open}
          onClose={closeEditor}
          type={editor.type}
          item={editor.item}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
