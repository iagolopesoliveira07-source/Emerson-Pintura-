import { CheckCircle, AlertCircle } from 'lucide-react';

import Button from '../Button/Button';

import Badge from '../Badge/Badge';

import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';

import {

  isObraConcluida,

  canMarkObraAsConcluida,

  markObraAsConcluida,

} from '../../utils/obraStatus';

import { isObraComDadosParciais } from '../../utils/controlDate';

import { calcDiasTrabalhadosObra } from '../../utils/diariaCalculations';

import {
  calcGastosObra,
  calcGastosEmpresaDaObra,
  calcDiariasObra,
  calcRecebimentosObra,
} from '../../utils/calculations';

import { getTipoObra, TIPO_OBRA, isPrepaidCreditObra, isPartnershipObra } from '../../utils/obraSpecial';

import { summarizeObraExtras } from '../../utils/obraExtras';

import { HELP } from '../../utils/helpTexts';
import HelpTip from '../HelpTip/HelpTip';

import shared from '../../pages/shared.module.css';

import styles from './ObraFinalizacaoSection.module.css';



export default function ObraFinalizacaoSection({

  obra,

  gastos,

  gastosEmpresa = [],

  diarias,

  pagamentos,

  funcionarios = [],

  fechamentosPagamento: _fechamentosPagamento = [],

  dataInicioControle,

  onMarkConcluida,

}) {

  const concluida = isObraConcluida(obra.estado);

  const podeConcluir = canMarkObraAsConcluida(obra.estado);



  const tipoObra = getTipoObra(obra);

  const totalGastos = calcGastosObra(obra.id, gastos) + calcGastosEmpresaDaObra(obra.id, gastosEmpresa);

  const totalDiarias = calcDiariasObra(obra.id, diarias, funcionarios);

  const totalCusto = totalGastos + totalDiarias;

  const totalRecebidoPagamentos = calcRecebimentosObra(obra.id, pagamentos);

  const extrasResumo = summarizeObraExtras(obra);

  const parceria = isPartnershipObra(obra);

  const totalRecebido = parceria ? totalRecebidoPagamentos + extrasResumo.recebido : totalRecebidoPagamentos;

  const valorContratado = obra.valorContratado || 0;

  const valorAtualizado = valorContratado + extrasResumo.total;

  const aReceber = parceria
    ? Math.max(0, valorContratado - totalRecebidoPagamentos) + extrasResumo.aCobrar
    : Math.max(0, valorAtualizado - totalRecebidoPagamentos);

  const saldo = valorAtualizado - totalCusto;

  const diasTrabalhados = calcDiasTrabalhadosObra(obra.id, diarias);

  const dadosParciais = isObraComDadosParciais(obra, gastos, diarias, dataInicioControle);
  const prepaid = isPrepaidCreditObra(obra);

  const resumoRows =
    tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA
      ? [
          ['Compensação', '1 ano de aluguel'],
          extrasResumo.quantidade > 0 ? ['Total de extras', formatCurrency(extrasResumo.total), HELP.obra.extras] : null,
          extrasResumo.total > 0.004 ? ['Valor total atualizado', formatCurrency(valorAtualizado), HELP.obra.valorAtualizado] : null,
          parceria && extrasResumo.recebido > 0.004 ? ['Recebido (extras)', formatCurrency(totalRecebido), HELP.obra.recebido] : null,
          extrasResumo.total > 0.004 ? ['Falta receber', formatCurrency(aReceber), HELP.obra.aReceber] : null,
          ['Diárias', formatCurrency(totalDiarias)],
          ['Gastos', formatCurrency(totalGastos)],
          ['Total investido', formatCurrency(totalCusto)],
          ['Dias trabalhados registados', String(diasTrabalhados)],
        ].filter(Boolean)
        : tipoObra === TIPO_OBRA.CREDITO
        ? [
            valorContratado > 0 ? ['Valor original', formatCurrency(valorContratado), HELP.obra.valorOriginal] : null,
            extrasResumo.quantidade > 0 ? ['Total de extras', formatCurrency(extrasResumo.total), HELP.obra.extras] : null,
            extrasResumo.total > 0.004 ? ['Valor total atualizado', formatCurrency(valorAtualizado), HELP.obra.valorAtualizado] : null,
            ['Total recebido', formatCurrency(totalRecebido), HELP.obra.recebido],
            prepaid ? null : valorContratado > 0 || extrasResumo.total > 0.004 ? ['Falta receber', formatCurrency(aReceber), HELP.obra.aReceber] : null,
            ['Diárias', formatCurrency(totalDiarias)],
            ['Gastos', formatCurrency(totalGastos)],
            ['Total investido', formatCurrency(totalCusto)],
            ['Resultado de caixa', formatCurrency(totalRecebido - totalCusto), concluida ? HELP.obra.lucroFinal : HELP.obra.resultadoParcial],
            valorContratado > 0 || extrasResumo.total > 0.004 ? ['Margem teórica restante', formatCurrency(saldo)] : null,
            ['Dias trabalhados registados', String(diasTrabalhados)],
          ].filter(Boolean)
        : [
            valorContratado > 0 ? ['Valor original', formatCurrency(valorContratado), HELP.obra.valorOriginal] : null,
            extrasResumo.quantidade > 0 ? ['Total de extras', formatCurrency(extrasResumo.total), HELP.obra.extras] : null,
            extrasResumo.total > 0.004 ? ['Valor total atualizado', formatCurrency(valorAtualizado), HELP.obra.valorAtualizado] : null,
            ['Total recebido', formatCurrency(totalRecebido), HELP.obra.recebido],
            valorContratado > 0 || (parceria ? extrasResumo.aCobrar > 0.004 : extrasResumo.total > 0.004)
              ? [parceria ? 'Valor a receber' : 'Falta receber', formatCurrency(aReceber), HELP.obra.aReceber]
              : null,
            ['Gastos', formatCurrency(totalGastos)],
            ['Diárias', formatCurrency(totalDiarias)],
            ['Custo total registado', formatCurrency(totalCusto)],
            [
                  dadosParciais ? 'Saldo com dados registados' : 'Saldo / lucro',
                  formatCurrency(saldo),
                  dadosParciais
                    ? HELP.relatorio.dadosIncompletos
                    : concluida
                      ? HELP.obra.lucroFinal
                      : HELP.obra.resultadoParcial,
                ],
            ['Dias trabalhados registados', String(diasTrabalhados)],
          ].filter(Boolean);



  const handleMarcarConcluida = () => {

    const confirmed = window.confirm(

      'Marcar esta obra como concluída? A data de hoje será registada como data de conclusão.'

    );

    if (!confirmed) return;



    onMarkConcluida(markObraAsConcluida(obra));

  };



  return (

    <div className={shared.detailCard}>

      <h3 className={shared.detailCardTitle}>Finalização da obra</h3>



      <div className={styles.content}>

        <div className={styles.statusRow}>

          <span className={styles.statusLabel}>Status da obra</span>

          {concluida ? (

            <Badge variant="success">Concluída</Badge>

          ) : (

            <Badge variant="primary">Em andamento</Badge>

          )}

        </div>



        {concluida ? (

          <>

            <div className={styles.concluidaInfo}>

              <CheckCircle size={18} className={styles.concluidaIcon} aria-hidden="true" />

              <div>

                <div className={styles.concluidaTitulo}>Obra concluída</div>

                {obra.dataConclusao ? (

                  <div className={styles.concluidaData}>

                    Concluída em {formatDateOrNotInformed(obra.dataConclusao)}

                  </div>

                ) : (

                  <div className={styles.concluidaDataSemRegisto}>

                    Data de conclusão não registrada

                  </div>

                )}

              </div>

            </div>



            <div className={styles.resumoFinal}>

              <h4 className={styles.resumoTitle}>Resumo final</h4>



              {dadosParciais && (

                <div className={styles.avisoParcial} role="note">

                  <AlertCircle size={16} aria-hidden="true" />

                  <span>Resultado com dados registados — podem existir informações históricas incompletas.</span>

                </div>

              )}



              <div className={styles.resumoGrid}>

                {resumoRows.map(([label, value, help]) => (

                  <div key={label} className={styles.resumoRow}>

                    <span className={styles.resumoLabel}>
                      {label}
                      {help ? <HelpTip text={help} /> : null}
                    </span>

                    <span className={styles.resumoValue}>{value}</span>

                  </div>

                ))}

              </div>

            </div>

          </>

        ) : podeConcluir ? (

          <>

            <p className={styles.emAndamento}>Obra em andamento</p>

            <Button icon={CheckCircle} onClick={handleMarcarConcluida}>

              Marcar obra como concluída

            </Button>

          </>

        ) : (

          <p className={styles.emAndamento}>

            Obra com status «{obra.estado}». Altere o status ou marque como concluída quando

            terminar.

          </p>

        )}

      </div>

    </div>

  );

}


