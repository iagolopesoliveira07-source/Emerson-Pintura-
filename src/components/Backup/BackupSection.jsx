import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import Button from '../Button/Button';
import RestoreBackupModal from './RestoreBackupModal';
import {
  createManualBackup,
  formatBackupDate,
  getBackupById,
  listBackups,
  parseBackupFileText,
  queueRestore,
} from '../../services/backupService';
import styles from './BackupSection.module.css';

export default function BackupSection() {
  const fileInputRef = useRef(null);
  const [backups, setBackups] = useState(() => listBackups());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);

  const refreshList = () => setBackups(listBackups());

  const showMessage = (text) => {
    setError('');
    setMessage(text);
    setTimeout(() => setMessage(''), 6000);
  };

  const handleCreateBackup = () => {
    setCreating(true);
    setError('');
    try {
      const result = createManualBackup();
      refreshList();
      showMessage(
        result.archived
          ? 'Backup criado. O ficheiro foi descarregado e ficou uma cópia no navegador.'
          : `Backup descarregado. ${result.warning}`
      );
    } catch (err) {
      setError(err.message || 'Não foi possível criar o backup.');
    } finally {
      setCreating(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseBackupFileText(text);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      setRestoreTarget(parsed.payload);
    } catch {
      setError('Não foi possível ler o ficheiro de backup.');
    }
  };

  const handleRestore = () => {
    if (!restoreTarget) return;
    const result = queueRestore(restoreTarget);
    if (!result.ok) {
      setError(result.error);
      setRestoreTarget(null);
      return;
    }
    window.location.reload();
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.title}>Backup dos dados</h3>
      <p className={styles.description}>
        Cria uma cópia de segurança dos dados da empresa neste computador. O backup não altera os
        dados actuais. A restauração só acontece se confirmar manualmente.
      </p>
      <p className={styles.description}>
        Também é guardada uma cópia automática no navegador, no máximo uma vez por dia, sem
        substituir backups anteriores.
      </p>

      <div className={styles.actions}>
        <Button icon={Download} onClick={handleCreateBackup} disabled={creating}>
          {creating ? 'A criar...' : 'Criar backup agora'}
        </Button>
        <Button variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()}>
          Restaurar a partir de ficheiro
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportFile}
        />
      </div>

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <h4 className={styles.listTitle}>Cópias neste navegador</h4>
      {backups.length === 0 ? (
        <p className={styles.empty}>Ainda não existem backups guardados neste navegador.</p>
      ) : (
        <ul className={styles.list}>
          {backups.map((backup) => (
            <li key={backup.id} className={styles.item}>
              <div>
                <strong>{formatBackupDate(backup.createdAt)}</strong>
                <span className={styles.meta}>
                  {backup.type === 'auto' ? 'Automático' : 'Manual'} · {backup.summary?.funcionarios || 0}{' '}
                  funcionários · {backup.summary?.diarias || 0} diárias · {backup.summary?.obras || 0} obras
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRestoreTarget(getBackupById(backup.id) || backup)}
              >
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <RestoreBackupModal
        isOpen={Boolean(restoreTarget)}
        backup={restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
      />
    </div>
  );
}
