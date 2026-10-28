import styles from './Badge.module.css';

const ESTADO_VARIANTS = {
  'Aguardando confirmação': 'warning',
  'Aguardando início': 'default',
  'Em andamento': 'primary',
  Pausada: 'orange',
  'Aguardando pagamento': 'purple',
  Encerrada: 'success',
  Cancelada: 'danger',
  Parada: 'orange',
  Concluída: 'success',
  'Ativo': 'success',
  'Inativo': 'default',
  'Em aberto': 'warning',
  'Acerto pendente': 'warning',
  'Acertado': 'success',
  'Valor adicional': 'danger',
  'Parcialmente pago': 'info',
  'Pago': 'success',
  'Pendente': 'warning',
  'Cobrado': 'purple',
  'Recebido': 'success',
  'Atrasado': 'danger',
  'Por conferir': 'warning',
};

export default function Badge({ children, variant, estado }) {
  const resolvedVariant = variant || ESTADO_VARIANTS[children] || 'default';
  return (
    <span className={`${styles.badge} ${styles[resolvedVariant]}`}>{children}</span>
  );
}
