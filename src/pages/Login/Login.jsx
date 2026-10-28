import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button/Button';
import Logo from '../../components/Logo/Logo';
import { FormGroup, Input } from '../../components/Form/Form';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConfigured, setupPassword, login } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: setupError } = await setupPassword(password, confirmPassword);

    setLoading(false);

    if (setupError) {
      setError(setupError);
      return;
    }

    navigate(from, { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: loginError } = await login(password);

    setLoading(false);

    if (loginError) {
      setError(loginError);
      return;
    }

    navigate(from, { replace: true });
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Logo size="xl" className={`${styles.logo} ${styles.logoCentered}`} />
          <p className={styles.subtitle}>Gestão de Obras</p>
        </div>

        {!isConfigured ? (
          <>
            <h2 className={styles.formTitle}>Configuração inicial</h2>
            <p className={styles.formDescription}>
              Defina uma senha para proteger o acesso à aplicação.
            </p>

            <form className={styles.form} onSubmit={handleSetup}>
              <FormGroup label="Nova senha">
                <Input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </FormGroup>

              <FormGroup label="Confirmar senha">
                <Input
                  type="password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </FormGroup>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" full disabled={loading}>
                {loading ? 'A definir...' : 'Definir senha'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h2 className={styles.formTitle}>Entrar</h2>

            <form className={styles.form} onSubmit={handleLogin}>
              <FormGroup label="Senha">
                <Input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </FormGroup>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" full disabled={loading}>
                {loading ? 'A entrar...' : 'Entrar'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
