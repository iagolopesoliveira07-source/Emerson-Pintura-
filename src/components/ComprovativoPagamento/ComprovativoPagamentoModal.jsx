import { useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormActions } from '../Form/Form';
import ComprovativoPagamentoView from './ComprovativoPagamentoView';
import CorrigirPagamentoModal from './CorrigirPagamentoModal';
import {
  buildComprovativoPublicUrl,
  getComprovativoPagamento,
  partilharComprovativo,
  printComprovativoHtml,
} from '../../utils/comprovativoPagamento';
import styles from './ComprovativoPagamento.module.css';

export default function ComprovativoPagamentoModal({
  isOpen,
  onClose,
  fechamento,
  diarias = [],
  empresaNome = 'Emerson Pinturas',
  onCorrigir,
}) {
  const [feedback, setFeedback] = useState('');
  const [corrigirOpen, setCorrigirOpen] = useState(false);
  const [mostrarOriginal, setMostrarOriginal] = useState(false);

  if (!isOpen || !fechamento) return null;

  const comprovativo = getComprovativoPagamento(fechamento, { diarias, empresaNome });
  const temOriginal = Boolean(comprovativo.snapshotOriginal);
  const visivel =
    mostrarOriginal && temOriginal
      ? {
          ...comprovativo.snapshotOriginal,
          fechamentoId: comprovativo.fechamentoId,
          funcionarioNome: comprovativo.snapshotOriginal.funcionarioNome || comprovativo.funcionarioNome,
        }
      : comprovativo;

  const handlePartilhar = async () => {
    const result = await partilharComprovativo(visivel);
    if (result.aborted) return;
    if (result.ok && result.method === 'copy') setFeedback('Resumo copiado.');
    else if (result.ok) setFeedback('');
    else if (result.text) {
      window.prompt('Copie o resumo:', result.text);
    } else {
      setFeedback('Não foi possível partilhar. Tente gerar o PDF.');
    }
  };

  const handleLink = async () => {
    const url = buildComprovativoPublicUrl(visivel);
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Link de leitura copiado. Só mostra este comprovativo.');
    } catch {
      window.prompt('Copie o link do comprovativo:', url);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !corrigirOpen}
        onClose={onClose}
        title="Comprovativo de Pagamento"
        size="lg"
        footer={
          <FormActions>
            {onCorrigir && !mostrarOriginal ? (
              <Button variant="secondary" type="button" onClick={() => setCorrigirOpen(true)}>
                Corrigir pagamento
              </Button>
            ) : null}
            {temOriginal ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setMostrarOriginal((prev) => !prev);
                  setFeedback('');
                }}
              >
                {mostrarOriginal ? 'Ver comprovativo actual' : 'Ver original'}
              </Button>
            ) : null}
            <Button variant="secondary" type="button" onClick={handleLink}>
              Gerar link
            </Button>
            <Button variant="secondary" type="button" onClick={() => printComprovativoHtml(visivel)}>
              Gerar PDF
            </Button>
            <Button type="button" onClick={handlePartilhar}>
              Partilhar
            </Button>
          </FormActions>
        }
      >
        {mostrarOriginal ? (
          <p className={styles.correcao}>A mostrar o comprovativo original, antes da correcção.</p>
        ) : null}
        <ComprovativoPagamentoView comprovativo={visivel} />
        {feedback ? <p className={styles.correcao}>{feedback}</p> : null}
      </Modal>

      {onCorrigir ? (
        <CorrigirPagamentoModal
          isOpen={corrigirOpen}
          onClose={() => setCorrigirOpen(false)}
          comprovativo={comprovativo}
          onConfirm={(snapshot, observacao) => {
            onCorrigir(snapshot, observacao);
            setCorrigirOpen(false);
            setMostrarOriginal(false);
            setFeedback('Correcção registada. O comprovativo original ficou preservado.');
          }}
        />
      ) : null}
    </>
  );
}
