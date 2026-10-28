import { FormGroup, Input, Select } from '../Form/Form';
import {
  TIPO_DOCUMENTO,
  TIPO_DOCUMENTO_LABELS,
  labelFaturaRelacionada,
} from '../../utils/gastoDocumentoTipo';
import { formatCurrency, formatDate } from '../../utils/formatters';
import styles from './GastoForm.module.css';
import HelpTip from '../HelpTip/HelpTip';
import { HELP } from '../../utils/helpTexts';

export default function GastoTipoDocumentoFields({
  form,
  onChange,
  faturasRelacionaveis = [],
  mostrarTipo = true,
  mostrarDetalhesNc = true,
}) {
  const isNc = form.tipoDocumento === TIPO_DOCUMENTO.NOTA_CREDITO;

  return (
    <>
      {mostrarTipo ? (
        <FormGroup label="Tipo de documento" help={HELP.gasto.tipoDocumento}>
          <div className={styles.radioGroup} role="radiogroup" aria-label="Tipo de documento">
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="tipoDocumento"
                value={TIPO_DOCUMENTO.FATURA}
                checked={!isNc}
                onChange={onChange}
              />
              {TIPO_DOCUMENTO_LABELS[TIPO_DOCUMENTO.FATURA]}
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="tipoDocumento"
                value={TIPO_DOCUMENTO.NOTA_CREDITO}
                checked={isNc}
                onChange={onChange}
              />
              {TIPO_DOCUMENTO_LABELS[TIPO_DOCUMENTO.NOTA_CREDITO]}
              <HelpTip text={HELP.gasto.notaCredito} />
            </label>
          </div>
        </FormGroup>
      ) : null}

      {mostrarTipo && isNc ? (
        <p className={styles.ncHint}>
          Introduza os valores em positivo. A nota de crédito é descontada automaticamente nos
          gastos, no IVA e nos totais.
        </p>
      ) : null}

      {isNc && mostrarDetalhesNc ? (
        <>
          <FormGroup label="Nº da Nota de Crédito">
            <Input
              name="numeroFatura"
              value={form.numeroFatura}
              onChange={onChange}
              placeholder="Ex.: NC 123"
            />
          </FormGroup>
          <FormGroup label="Fatura original" hint="Opcional, se conhecida">
            <Select name="faturaOriginalId" value={form.faturaOriginalId || ''} onChange={onChange}>
              <option value="">Não relacionar</option>
              {faturasRelacionaveis.map((fatura) => (
                <option key={fatura.id} value={fatura.id}>
                  {labelFaturaRelacionada(fatura, formatCurrency, formatDate)}
                  {fatura.descricao || fatura.categoria ? ` · ${fatura.descricao || fatura.categoria}` : ''}
                </option>
              ))}
            </Select>
          </FormGroup>
        </>
      ) : null}
    </>
  );
}

