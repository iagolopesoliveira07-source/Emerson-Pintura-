import { useState } from 'react';
import { Save, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import ResetDataModal from '../../components/ResetDataModal/ResetDataModal';
import BackupSection from '../../components/Backup/BackupSection';
import { FormGroup, Input, FormRow } from '../../components/Form/Form';
import shared from '../shared.module.css';
import styles from './Configuracoes.module.css';

export default function Configuracoes() {
  const { configuracoes, updateConfiguracoes, resetApplicationData } = useApp();
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ ...configuracoes });
  const [saved, setSaved] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('pref_')) {
      const prefKey = name.replace('pref_', '');
      setForm((prev) => ({
        ...prev,
        preferencias: { ...prev.preferencias, [prefKey]: type === 'checkbox' ? checked : value },
      }));
    } else if (name.startsWith('user_')) {
      const userKey = name.replace('user_', '');
      setForm((prev) => ({
        ...prev,
        utilizador: { ...prev.utilizador, [userKey]: value },
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
    setSaved(false);
  };

  const handleSave = () => {
    updateConfiguracoes(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = async () => {
    await resetApplicationData();
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 5000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    setChangingPassword(true);

    const { error } = await changePassword(currentPassword, newPassword, confirmNewPassword);

    setChangingPassword(false);

    if (error) {
      setPasswordError(error);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordSuccess(true);
    setTimeout(() => setPasswordSuccess(false), 5000);
  };

  return (
    <div className={shared.page}>
      <PageHeader
        title="Configurações"
        subtitle="Dados da empresa e preferências"
        actions={
          <Button icon={Save} onClick={handleSave}>
            {saved ? 'Guardado!' : 'Guardar alterações'}
          </Button>
        }
      />

      {resetSuccess && (
        <div className={shared.successBanner} role="status">
          Todos os dados foram apagados com sucesso. A aplicação está pronta para novos registos.
        </div>
      )}

      {passwordSuccess && (
        <div className={shared.successBanner} role="status">
          Senha alterada com sucesso.
        </div>
      )}

      <div className={shared.detailGrid}>
        <div className={shared.detailCard}>
          <h3 className={shared.detailCardTitle}>Dados da empresa</h3>
          <FormGroup label="Nome da empresa">
            <Input name="nomeEmpresa" value={form.nomeEmpresa} onChange={handleChange} />
          </FormGroup>
          <FormRow>
            <FormGroup label="NIF">
              <Input name="nif" value={form.nif} onChange={handleChange} />
            </FormGroup>
            <FormGroup label="Telefone">
              <Input name="telefone" value={form.telefone} onChange={handleChange} />
            </FormGroup>
          </FormRow>
          <FormGroup label="Morada">
            <Input name="morada" value={form.morada} onChange={handleChange} />
          </FormGroup>
          <FormGroup label="Email">
            <Input name="email" type="email" value={form.email} onChange={handleChange} />
          </FormGroup>
          <FormGroup label="Moeda">
            <Input name="moeda" value={form.moeda} onChange={handleChange} disabled />
          </FormGroup>
        </div>

        <div className={shared.detailCard}>
          <h3 className={shared.detailCardTitle}>Controlo financeiro</h3>
          <p className={styles.controlSectionDesc}>
            Define a partir de que data os registos passam a ser considerados completos nos gráficos
            e indicadores de lucro. Dados anteriores permanecem visíveis no histórico, mas são
            marcados como parciais.
          </p>
          <FormGroup label="Data de início do controlo detalhado">
            <Input
              name="dataInicioControle"
              type="date"
              value={form.dataInicioControle || ''}
              onChange={handleChange}
            />
          </FormGroup>
        </div>

        <div className={shared.detailCard}>
          <h3 className={shared.detailCardTitle}>Perfil do utilizador</h3>
          <FormGroup label="Nome">
            <Input name="user_nome" value={form.utilizador.nome} onChange={handleChange} />
          </FormGroup>
          <FormGroup label="Email">
            <Input name="user_email" type="email" value={form.utilizador.email} onChange={handleChange} />
          </FormGroup>
          <FormGroup label="Cargo">
            <Input name="user_cargo" value={form.utilizador.cargo} onChange={handleChange} />
          </FormGroup>

          <h3 className={shared.detailCardTitle} style={{ marginTop: '1.5rem' }}>Preferências</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            <input
              type="checkbox"
              name="pref_notificacoes"
              checked={form.preferencias.notificacoes}
              onChange={handleChange}
            />
            Activar notificações
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              name="pref_temaEscuro"
              checked={form.preferencias.temaEscuro}
              onChange={handleChange}
            />
            Tema escuro (em breve)
          </label>
        </div>
      </div>

      <div className={styles.securitySection}>
        <h3 className={styles.securitySectionTitle}>
          <KeyRound size={18} />
          Segurança
        </h3>
        <p className={styles.securitySectionDescription}>
          Altere a senha de acesso à aplicação.
        </p>

        <form className={styles.passwordForm} onSubmit={handleChangePassword}>
          <FormGroup label="Senha actual">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </FormGroup>
          <FormGroup label="Nova senha">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </FormGroup>
          <FormGroup label="Confirmar nova senha">
            <Input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </FormGroup>

          {passwordError && (
            <p className={styles.passwordError} role="alert">
              {passwordError}
            </p>
          )}

          <Button type="submit" disabled={changingPassword}>
            {changingPassword ? 'A alterar...' : 'Alterar senha'}
          </Button>
        </form>

        <p className={styles.securityNote}>
          Esta aplicação é local e não possui recuperação de senha por email. Se esquecer a senha,
          será necessário remover manualmente a chave <code>emerson_pinturas_auth</code> nas
          ferramentas de desenvolvimento do navegador e definir uma nova senha na configuração inicial.
        </p>
      </div>

      <BackupSection />

      <div className={styles.dataSection}>
        <h3 className={styles.dataSectionTitle}>Dados da aplicação</h3>
        <p className={styles.dataSectionDescription}>
          Armazenamento: <strong>Local (navegador)</strong>
        </p>
        <p className={styles.dataSectionDescription}>
          Gerencie os dados cadastrados no sistema.
        </p>
        <p className={styles.dataSectionDescription}>
          Apaga todos os lançamentos cadastrados e deixa a aplicação pronta para começar um novo registo.
        </p>
        <p className={styles.dataSectionWarning}>
          Esta ação apagará todos os lançamentos, mas manterá a senha de acesso configurada.
        </p>
        <Button variant="danger" onClick={() => setResetModalOpen(true)}>
          Zerar todos os dados
        </Button>
      </div>

      <ResetDataModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleReset}
      />
    </div>
  );
}
