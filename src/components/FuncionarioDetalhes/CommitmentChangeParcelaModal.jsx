import { useEffect, useState } from 'react';

import Modal from '../Modal/Modal';

import Button from '../Button/Button';

import { FormGroup, Input, FormRow, FormActions } from '../Form/Form';

import {

  getParcelasDescontadas,

  getParcelasRestantesLabelFromValues,

  getTotalParcelas,

} from '../../utils/commitmentCalculations';



export default function CommitmentChangeParcelaModal({ isOpen, onClose, item, onSubmit }) {

  const [parcelaAtual, setParcelaAtual] = useState('0');

  const [totalParcelas, setTotalParcelas] = useState('12');

  const [error, setError] = useState(null);



  useEffect(() => {

    if (!isOpen || !item) return;

    setParcelaAtual(String(getParcelasDescontadas(item)));

    setTotalParcelas(String(getTotalParcelas(item) || 12));

    setError(null);

  }, [isOpen, item]);



  if (!item) return null;



  const previewLabel = getParcelasRestantesLabelFromValues(parcelaAtual, totalParcelas);



  const handleSubmit = (e) => {

    e.preventDefault();

    const descontadas = parseInt(parcelaAtual, 10);

    const total = parseInt(totalParcelas, 10);



    if (Number.isNaN(total) || total < 1) {

      setError('Informe um total de parcelas válido.');

      return;

    }



    if (Number.isNaN(descontadas) || descontadas < 0 || descontadas > total) {

      setError(`Parcelas descontadas deve estar entre 0 e ${total}.`);

      return;

    }



    onSubmit({ parcelaAtual: descontadas, totalParcelas: total });

  };



  return (

    <Modal

      isOpen={isOpen}

      onClose={onClose}

      title="Alterar parcela"

      footer={

        <FormActions>

          <Button variant="secondary" onClick={onClose}>Cancelar</Button>

          <Button onClick={handleSubmit}>Guardar</Button>

        </FormActions>

      }

    >

      <form onSubmit={handleSubmit}>

        <FormRow>

          <FormGroup label="Parcelas descontadas" required error={error}>

            <Input

              type="number"

              min="0"

              step="1"

              value={parcelaAtual}

              onChange={(e) => {

                setParcelaAtual(e.target.value);

                setError(null);

              }}

              error={error}

            />

          </FormGroup>

          <FormGroup label="Total de parcelas" required>

            <Input

              type="number"

              min="1"

              step="1"

              value={totalParcelas}

              onChange={(e) => {

                setTotalParcelas(e.target.value);

                setError(null);

              }}

            />

          </FormGroup>

        </FormRow>



        {totalParcelas && parcelaAtual !== '' && previewLabel && (

          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>

            <strong>{parcelaAtual}/{totalParcelas}</strong>

            {' · '}

            {previewLabel}

          </p>

        )}

      </form>

    </Modal>

  );

}

