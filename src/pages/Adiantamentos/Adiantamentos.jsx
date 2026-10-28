import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Card from '../../components/Card/Card';
import ValoresAcertoSection from '../../components/FuncionarioDetalhes/ValoresAcertoSection';
import { formatCurrency } from '../../utils/formatters';
import {
  getGlobalAcertoSummary,
  isAcertoAcertado,
  getValorEntregue,
} from '../../utils/acertoCalculations';
import shared from '../shared.module.css';

export default function Adiantamentos() {
  const [searchParams] = useSearchParams();
  const { valoresAcerto } = useApp();
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (searchParams.get('nova') === 'true') {
      // Section handles its own create button; user can click there
    }
  }, [searchParams]);

  const summary = getGlobalAcertoSummary(valoresAcerto);
  const abertos = valoresAcerto.filter((v) => !isAcertoAcertado(v));
  const totalEntregue = abertos.reduce((s, v) => s + getValorEntregue(v), 0);

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  return (
    <div className={shared.page}>
      <PageHeader
        title="Valores para acerto"
        subtitle="Dinheiro entregue a funcionários para despesas e compras"
      />

      {successMessage && (
        <div className={shared.successBanner} role="status">
          {successMessage}
        </div>
      )}

      <div className={shared.statsRow}>
        <Card title="A devolver" value={formatCurrency(summary.totalADevolver)} iconColor="orange" />
        <Card title="Acertos pendentes" value={summary.pendentes} iconColor="blue" />
        <Card title="Em aberto" value={abertos.length} iconColor="cyan" />
        <Card title="Total entregue" value={formatCurrency(totalEntregue)} iconColor="purple" />
      </div>

      <ValoresAcertoSection onSuccess={showSuccess} showSummary={false} />
    </div>
  );
}
