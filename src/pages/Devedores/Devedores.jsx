import { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { useApp } from '../../context/AppContext';

import PageHeader from '../../components/PageHeader/PageHeader';

import DebtorSummary from '../../components/Devedores/DebtorSummary';

import DebtorFilters from '../../components/Devedores/DebtorFilters';

import DebtorTable from '../../components/Devedores/DebtorTable';

import DebtPaymentFormModal from '../../components/Devedores/DebtPaymentFormModal';

import {

  buildLegacyPaymentRecord,

  filterDebts,

  getDebtSummary,

  getOpenDebts,

  sortDebts,

  validateDebtPayment,

} from '../../utils/debtCalculations';

import { normalizeObraStatus } from '../../utils/obraStatus';

import { HELP } from '../../utils/helpTexts';

import shared from '../shared.module.css';



const EMPTY_FILTERS = {
  status: 'todos',
  cliente: '',
  obraId: '',
  search: '',
};



export default function Devedores() {

  const navigate = useNavigate();

  const { obras, pagamentos, addPagamento } = useApp();

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [selectedDebt, setSelectedDebt] = useState(null);

  const [paymentOpen, setPaymentOpen] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');



  const obrasFiltraveis = useMemo(

    () => obras.filter((obra) => normalizeObraStatus(obra.estado) !== 'Cancelada'),

    [obras]

  );



  const allDebts = useMemo(

    () => sortDebts(getOpenDebts(obras, pagamentos)),

    [obras, pagamentos]

  );



  const filteredDebts = useMemo(

    () => filterDebts(allDebts, filters),

    [allDebts, filters]

  );



  const summary = useMemo(() => getDebtSummary(allDebts), [allDebts]);



  const clientes = useMemo(

    () => [...new Set(allDebts.map((debt) => debt.cliente))].sort((a, b) => a.localeCompare(b, 'pt-PT')),

    [allDebts]

  );



  const showSuccess = (message) => {

    setSuccessMessage(message);

    setTimeout(() => setSuccessMessage(''), 4000);

  };



  const handlePay = (debt) => {

    setSelectedDebt(debt);

    setPaymentOpen(true);

  };



  const handleConfirmPayment = (details) => {

    const validation = validateDebtPayment(selectedDebt, details.valor);

    if (!validation.isValid) {

      window.alert(validation.message);

      return;

    }



    const obra = obras.find((item) => item.id === selectedDebt.obraId);

    if (!obra) return;



    addPagamento(buildLegacyPaymentRecord(obra, details.valor, details, pagamentos));



    setPaymentOpen(false);

    setSelectedDebt(null);

    showSuccess('Pagamento registado com sucesso.');

  };



  return (

    <div className={shared.page}>

      <PageHeader

        title="Devedores"

        subtitle="Obras com valores ainda por receber — calculado automaticamente"

        help={HELP.recebimento.aReceber}

      />



      {successMessage && (

        <div className={shared.successBanner} role="status">

          {successMessage}

        </div>

      )}



      <DebtorSummary summary={summary} />



      <DebtorFilters

        filters={filters}

        onChange={setFilters}

        clientes={clientes}

        obras={obrasFiltraveis}

      />



      <DebtorTable

        debts={filteredDebts}

        onPay={handlePay}

        onViewObra={(obraId) => navigate(`/obras/${obraId}`)}

      />



      <DebtPaymentFormModal

        isOpen={paymentOpen}

        onClose={() => {

          setPaymentOpen(false);

          setSelectedDebt(null);

        }}

        debt={selectedDebt}

        onSubmit={handleConfirmPayment}

        title="Registrar pagamento"

      />

    </div>

  );

}

