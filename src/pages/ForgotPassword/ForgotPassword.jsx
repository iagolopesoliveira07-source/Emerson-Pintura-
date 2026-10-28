import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button/Button';
import Logo from '../../components/Logo/Logo';
import { FormGroup, Input } from '../../components/Form/Form';
import styles from './ForgotPassword.module.css';

export default function ForgotPassword() {
  const { resetPassword, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    const { error: resetError } = await resetPassword(email.trim());

    setLoading(false);

    if (resetError) {
      setError(resetError);
      return;
    }

    setSuccess(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Logo size="lg" className={`${styles.logo} ${styles.logoCentered}`} />
          <h1 className={styles.title}>Recuperar senha</h1>
          <p className={styles.subtitle}>
            Enviaremos um link de recuperação para o seu email.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className={styles.notice}>
            A recuperação de senha requer Supabase configurado no ficheiro <code>.env</code>.
          </div>
        ) : success ? (
          <div className={styles.success} role="status">
            Se existir uma conta com esse email, receberá instruções para redefinir a senha.
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <FormGroup label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </FormGroup>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <Button type="submit" full disabled={loading}>
              {loading ? 'A enviar...' : 'Enviar link de recuperação'}
            </Button>
          </form>
        )}

        <Link to="/login" className={styles.backLink}>
          <ArrowLeft size={16} />
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
