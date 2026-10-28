import { useEffect, useState } from 'react';
import ComprovativoPagamentoView from '../../components/ComprovativoPagamento/ComprovativoPagamentoView';
import { decodeComprovativoHash } from '../../utils/comprovativoPagamento';
import styles from '../../components/ComprovativoPagamento/ComprovativoPagamento.module.css';

export default function ComprovativoPublico() {
  const [comprovativo, setComprovativo] = useState(() => decodeComprovativoHash(window.location.hash));

  useEffect(() => {
    const sync = () => setComprovativo(decodeComprovativoHash(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  if (!comprovativo) {
    return (
      <div className={styles.publico}>
        <div className={styles.publicoInner}>
          <p className={styles.publicoErro}>Este comprovativo não está disponível ou o link é inválido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.publico}>
      <div className={styles.publicoInner}>
        <ComprovativoPagamentoView comprovativo={comprovativo} />
      </div>
    </div>
  );
}
