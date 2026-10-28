import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { resumoPeriodoAposUltimoAcerto } from '../../utils/obraParceriaAcertos';
import { aplicarValorControleParceria } from '../../utils/obraPartnership';
import { findFuncionarioById } from '../../utils/funcionarioTipo';
import ParceriaDiariaControleModal from './ParceriaDiariaControleModal';
import tipoStyles from './ObraTipo.module.css';
import styles from './ObraParceriaPeriodo.module.css';

function Detalhes({ titulo, items, valorPick, onEdit }) {
  const [aberto, setAberto] = useState(false);
  if (!items?.length) return null;
  return (
    <div>
      {aberto ? (
        items.map((item) => (
          <div key={item.id} className={styles.row}>
            <span>
              {item.nome || item.descricao || '—'} · {item.data ? formatDate(item.data) : '—'}
            </span>
            <span className={styles.rowValor}>
              <strong>{formatCurrency(valorPick(item))}</strong>
              {onEdit ? (
                <button type="button" className={styles.editBtn} onClick={() => onEdit(item)}>
                  Editar
                </button>
              ) : null}
            </span>
          </div>
        ))
      ) : null}
      <button type="button" className={styles.linkBtn} onClick={() => setAberto((v) => !v)}>
        {aberto ? 'Ocultar detalhes' : `Ver detalhes (${titulo})`}
      </button>
    </div>
  );
}

function CardPessoa({ bloco, onEditMaoDeObra }) {
  const isEmerson = bloco.key === 'emerson';
  const isCaixa = bloco.key === 'caixa';
  return (
    <article className={styles.card}>
      <h4>{bloco.nome}</h4>
      {isCaixa ? (
        <>
          <div className={styles.row}>
            <span>Gastos pagos pelo Caixa</span>
            <strong>{formatCurrency(bloco.gastosValor || 0)}</strong>
          </div>
          <p className={styles.empty}>Ficam disponíveis para escolheres no próximo Acerto. Não geram reembolso pessoal.</p>
        </>
      ) : (
        <>
          <div className={styles.row}>
            <span>Gastos / compras</span>
            <strong>{formatCurrency(bloco.gastosValor || 0)}</strong>
          </div>
          <div className={styles.row}>
            <span>{isEmerson ? 'Diária própria' : 'Diárias individuais'}</span>
            <strong>{formatCurrency(bloco.diariasValor || 0)}</strong>
          </div>
          {isEmerson ? (
            <div className={styles.row}>
              <span>Mão de obra dos funcionários</span>
              <strong>{formatCurrency(bloco.maoDeObraValor || 0)}</strong>
            </div>
          ) : null}
          <div className={`${styles.row} ${styles.total}`}>
            <span>Total pendente {bloco.nome}</span>
            <strong>{formatCurrency(bloco.total)}</strong>
          </div>
        </>
      )}
      {isEmerson ? (
        <Detalhes
          titulo="mão de obra"
          items={bloco.maoDeObra}
          valorPick={(item) => item.valorCusto || item.referencia || 0}
          onEdit={onEditMaoDeObra}
        />
      ) : null}
      {!isCaixa ? (
        <Detalhes
          titulo="diárias"
          items={bloco.diarias}
          valorPick={(item) => item.valorCusto || item.referencia || 0}
        />
      ) : null}
      <Detalhes titulo="gastos" items={bloco.gastos} valorPick={(item) => item.valor || 0} />
    </article>
  );
}

export default function ObraParceriaPeriodoSection({
  obra,
  gastos,
  gastosEmpresa = [],
  diarias,
  pagamentos,
  funcionarios,
}) {
  const { updateDiaria } = useApp();
  const [diariaControle, setDiariaControle] = useState(null);
  const resumo = useMemo(() => {
    try {
      return resumoPeriodoAposUltimoAcerto(obra, {
        gastos,
        gastosEmpresa,
        diarias,
        pagamentos,
        funcionarios,
      });
    } catch (error) {
      console.error('[parceria] Falha ao montar período após o Acerto', error);
      return null;
    }
  }, [obra, gastos, gastosEmpresa, diarias, pagamentos, funcionarios]);

  const abrirControle = (item) => {
    const diaria = (diarias || []).find((row) => row && String(row.id) === String(item.id));
    if (diaria) setDiariaControle(diaria);
  };

  const guardarControle = ({ valor, observacao }) => {
    if (!diariaControle) return;
    updateDiaria(aplicarValorControleParceria(diariaControle, { valor, observacao }));
    setDiariaControle(null);
  };

  if (!resumo?.ultimo) return null;

  const reserva = resumo.reserva || { inicial: 0 };

  return (
    <section className={`${tipoStyles.panel} ${styles.wrap}`}>
      <div className={styles.head}>
        <h3 className={styles.title}>Depois do último Acerto</h3>
        <span className={styles.done}>{resumo.ultimo.titulo || 'Último Acerto'} — concluído</span>
      </div>
      <p className={styles.hint}>
        A reserva deixada no último Acerto continua disponível. Os custos abaixo ainda não entraram em nenhum Acerto.
        No Novo Acerto escolhes o que queres considerar.
      </p>

      <article className={styles.card} style={{ marginBottom: '1rem' }}>
        <div className={styles.row}>
          <span>Reserva deixada no último Acerto</span>
          <strong className={styles.heroRestante}>{formatCurrency(reserva.inicial)}</strong>
        </div>
        <div className={styles.row}>
          <span>Custos ainda não incluídos em Acerto</span>
          <strong>{formatCurrency(resumo.totalNovosCustos)}</strong>
        </div>
        <p className={styles.empty}>
          Nada disto é descontado automaticamente. A reserva só entra no próximo Acerto se a utilizares.
        </p>
      </article>

      <div className={styles.grid} style={{ marginBottom: '1rem' }}>
        <article className={styles.card}>
          <h4>Pendente para próximos Acertos</h4>
          <div className={styles.row}>
            <span>Emerson</span>
            <strong>{formatCurrency(resumo.emerson.total)}</strong>
          </div>
          <div className={styles.row}>
            <span>Fábio</span>
            <strong>{formatCurrency(resumo.fabio.total)}</strong>
          </div>
          <div className={styles.row}>
            <span>Juliano</span>
            <strong>{formatCurrency(resumo.juliano.total)}</strong>
          </div>
          <div className={styles.row}>
            <span>Pago pelo Caixa</span>
            <strong>{formatCurrency(resumo.caixaGastosValor)}</strong>
          </div>
          <div className={`${styles.row} ${styles.total}`}>
            <span>Total pendente</span>
            <strong>{formatCurrency(resumo.totalNovosCustos)}</strong>
          </div>
        </article>
      </div>

      <h3 className={styles.title}>Lançamentos que continuam pendentes</h3>
      <p className={styles.hint}>
        Continuam na obra. No Novo Acerto marcas só os que queres descontar.
      </p>
      <div className={styles.grid}>
        <CardPessoa bloco={resumo.emerson} onEditMaoDeObra={abrirControle} />
        <CardPessoa bloco={resumo.fabio} />
        <CardPessoa bloco={resumo.juliano} />
        <CardPessoa
          bloco={{
            key: 'caixa',
            nome: 'Pago pelo Caixa',
            gastosValor: resumo.caixaGastosValor,
            gastos: resumo.caixaGastos,
            total: resumo.caixaGastosValor,
          }}
        />
      </div>

      <ParceriaDiariaControleModal
        isOpen={Boolean(diariaControle)}
        onClose={() => setDiariaControle(null)}
        diaria={diariaControle}
        funcionario={findFuncionarioById(funcionarios, diariaControle?.funcionarioId)}
        onSubmit={guardarControle}
      />
    </section>
  );
}
