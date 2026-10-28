import { Component } from 'react';
import { Link } from 'react-router-dom';
import Button from '../Button/Button';
import styles from './ErrorBoundary.module.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[app] Falha ao renderizar a página', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const detail = String(
        this.state.error?.stack || this.state.error?.message || this.state.error
      );
      if (this.props.isolate) {
        return (
          <div className={styles.wrap} role="alert" style={{ margin: '1rem 0', padding: '1rem' }}>
            <h2 className={styles.title}>{this.props.label || 'Secção indisponível'}</h2>
            <p className={styles.text}>
              Esta parte da página falhou. O resto da obra e os dados guardados mantêm-se.
            </p>
            <pre className={styles.text} style={{ whiteSpace: 'pre-wrap' }}>
              {detail}
            </pre>
            <div className={styles.actions}>
              <Button type="button" onClick={this.handleRetry}>
                Tentar novamente
              </Button>
            </div>
          </div>
        );
      }
      return (
        <div className={styles.wrap} role="alert">
          <h2 className={styles.title}>
            Erro: {this.state.error?.message || String(this.state.error)}
          </h2>
          <p className={styles.text}>
            Ocorreu um erro ao abrir este ecrã. Os dados guardados não foram apagados. Volte à lista
            ou tente novamente.
          </p>
          <pre className={styles.text} style={{ whiteSpace: 'pre-wrap' }}>
            {detail}
          </pre>
          <div className={styles.actions}>
            <Button type="button" onClick={this.handleRetry}>
              Tentar novamente
            </Button>
            <Link to="/obras" className={styles.link}>
              Voltar às obras
            </Link>
            <Link to="/" className={styles.link}>
              Ir ao Dashboard
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
