import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import { FormGroup, Input, Select, FormActions } from '../Form/Form';
import {
  adicionarGrupoCatalogo,
  adicionarCategoriaCatalogo,
  renomearCategoriaCatalogo,
  definirCategoriaAtiva,
  contarGastosDaCategoria,
} from '../../utils/gastoEmpresaCategoriaCatalog';
import styles from './GerenciarCategoriasEmpresa.module.css';

export default function GerenciarCategoriasEmpresaModal({
  isOpen,
  onClose,
  catalog,
  gastos = [],
  onSaveCatalog,
  onRenameCategoria,
}) {
  const [formTipo, setFormTipo] = useState(null);
  const [grupoId, setGrupoId] = useState('');
  const [nome, setNome] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFormTipo(null);
      setGrupoId('');
      setNome('');
      setCategoriaId('');
      setError('');
    }
  }, [isOpen]);

  const grupos = catalog?.grupos || [];

  const handleAddGrupo = (e) => {
    e.preventDefault();
    const result = adicionarGrupoCatalogo(catalog, nome);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaveCatalog(result.catalog);
    setFormTipo(null);
    setNome('');
    setError('');
  };

  const handleAddCategoria = (e) => {
    e.preventDefault();
    const result = adicionarCategoriaCatalogo(catalog, { grupoId, nome });
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaveCatalog(result.catalog);
    setFormTipo(null);
    setNome('');
    setGrupoId('');
    setError('');
  };

  const handleEditCategoria = (e) => {
    e.preventDefault();
    const result = onRenameCategoria({ categoriaId, nome });
    if (result?.error) {
      setError(result.error);
      return;
    }
    setFormTipo(null);
    setNome('');
    setCategoriaId('');
    setError('');
  };

  const openEdit = (categoria, grupo) => {
    setFormTipo('editar');
    setCategoriaId(categoria.id);
    setGrupoId(grupo.id);
    setNome(categoria.nome);
    setError('');
  };

  const openAddCategoria = (grupo = null) => {
    setFormTipo('categoria');
    setGrupoId(grupo?.id || grupos[0]?.id || '');
    setNome('');
    setError('');
  };

  const startAddGrupo = () => {
    setFormTipo('grupo');
    setNome('');
    setError('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gerenciar categorias"
      size="lg"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Fechar
          </Button>
        </FormActions>
      }
    >
      <p className={styles.intro}>
        As categorias servem só para classificar o gasto. O IVA continua separado. Desactivar uma
        categoria não apaga gastos.
      </p>

      <div className={styles.actions}>
        <Button type="button" size="sm" icon={Plus} onClick={() => openAddCategoria()}>
          Adicionar categoria
        </Button>
        <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={startAddGrupo}>
          Adicionar grupo
        </Button>
      </div>

      {formTipo === 'grupo' && (
        <form className={styles.formBox} onSubmit={handleAddGrupo}>
          <FormGroup label="Nome do grupo" required error={error}>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </FormGroup>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setFormTipo(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar grupo</Button>
          </FormActions>
        </form>
      )}

      {formTipo === 'categoria' && (
        <form className={styles.formBox} onSubmit={handleAddCategoria}>
          <FormGroup label="Grupo" required>
            <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.nome}
                </option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Nome da categoria" required error={error}>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </FormGroup>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setFormTipo(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar categoria</Button>
          </FormActions>
        </form>
      )}

      {formTipo === 'editar' && (
        <form className={styles.formBox} onSubmit={handleEditCategoria}>
          <FormGroup label="Novo nome da categoria" required error={error}>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </FormGroup>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setFormTipo(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar nome</Button>
          </FormActions>
        </form>
      )}

      <div className={styles.list}>
        {grupos.map((grupo) => (
          <section key={grupo.id} className={styles.group}>
            <div className={styles.groupHeader}>
              <h3>{grupo.nome}</h3>
              <Button type="button" size="sm" variant="secondary" onClick={() => openAddCategoria(grupo)}>
                + Categoria
              </Button>
            </div>
            {(grupo.categorias || []).length === 0 ? (
              <p className={styles.empty}>Ainda não há categorias neste grupo.</p>
            ) : (
              <ul className={styles.catList}>
                {(grupo.categorias || []).map((categoria) => {
                  const associados = contarGastosDaCategoria(gastos, categoria.nome);
                  const ativa = categoria.ativo !== false;
                  return (
                    <li key={categoria.id} className={styles.catRow}>
                      <div className={styles.catInfo}>
                        <span className={styles.catNome}>{categoria.nome}</span>
                        <span className={styles.catMeta}>
                          {associados === 0
                            ? 'Sem gastos associados'
                            : `${associados} gasto${associados === 1 ? '' : 's'} associado${associados === 1 ? '' : 's'}`}
                        </span>
                      </div>
                      <div className={styles.catActions}>
                        <Badge variant={ativa ? 'success' : 'default'}>
                          {ativa ? 'Ativa' : 'Desativada'}
                        </Badge>
                        <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(categoria, grupo)}>
                          Editar
                        </Button>
                        {ativa ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const result = definirCategoriaAtiva(catalog, categoria.id, false);
                              if (!result.error) onSaveCatalog(result.catalog);
                            }}
                          >
                            Desativar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const result = definirCategoriaAtiva(catalog, categoria.id, true);
                              if (!result.error) onSaveCatalog(result.catalog);
                            }}
                          >
                            Reativar
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
}
