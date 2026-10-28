export const HELP = {
  obra: {
    valorOriginal: 'Valor base/original combinado com o cliente.',
    extras: 'Acréscimo ao valor desta mesma obra. Não é uma segunda obra nem uma cobrança separada.',
    valorAtualizado: 'Valor total real da obra: valor inicial mais todos os extras. O falta receber compara os pagamentos com este valor.',
    recebido: 'Soma dos pagamentos registados nesta obra. Não inclui o valor dos extras como se já tivesse sido recebido.',
    aReceber: 'Valor atualizado da obra menos o total recebido. Se os pagamentos cobrirem o total, fica em zero.',
    resultadoParcial: 'Resultado provisório enquanto a obra ainda está em andamento.',
    lucroFinal: 'Resultado definitivo somente quando a obra estiver concluída.',
    credito: 'Obra com saldo pré-pago. Os serviços abatem esse crédito. Não existe valor a receber.',
    servicoCredito: 'Agrupa diárias e gastos de um trabalho específico sem criar uma nova obra.',
    semServico: 'Use quando ainda não souber a qual serviço aquela diária ou gasto pertence.',
    creditoRecebido: 'Valor já pago antecipadamente. Não deve aparecer como pendente.',
    saldoCredito: 'Crédito inicial menos os serviços já abatidos.',
    abatidoCredito: 'O valor deste serviço já foi descontado do saldo disponível.',
    resultadoServico: 'Valor do serviço menos diárias e gastos. Não é valor a receber.',
  },
  extras: {
    pendente: 'Extra a cobrar: soma ao valor da obra e fica em a receber.',
    cobrado: 'Extra a cobrar: soma ao valor da obra e fica em a receber.',
    a_cobrar: 'Extra a cobrar: soma ao valor da obra e fica em a receber.',
    recebido: 'Extra já pago pelo cliente: soma ao valor da obra e entra em recebido, saindo de a receber.',
    status:
      'A cobrar aumenta o total da obra e o a receber. Recebido aumenta o total da obra e entra em recebido, sem duplicar.',
  },
  diaria: {
    pendente: 'Diária ainda não incluída em nenhum pagamento fechado.',
    paga: 'Diária já incluída em um pagamento confirmado.',
    estado: 'Pendente: ainda não está num pagamento fechado. Paga: já entrou num pagamento confirmado.',
    fecharPagamento: 'Selecione somente as diárias que deseja pagar agora.',
    extrasAjustes: 'Valor adicionado ou retirado manualmente no fechamento do pagamento.',
    multiObra:
      'Um único registo de diária para pagamento. Nas obras aparece a parte (½ ou dia inteiro), sem duplicar o valor.',
    gratificacao: 'Valor adicional pago ao funcionário.',
    observacao: 'Informação como hora extra, saída mais cedo ou outro ajuste. Não altera automaticamente o valor.',
  },
  gasto: {
    obra: 'Custo diretamente relacionado à execução de obras.',
    semObra: 'Sem obra, a categoria decide: despesas gerais vão para Gastos da Empresa; material de obra fica em Gastos das Obras — Sem obra específica.',
    empresa: 'Despesa geral da empresa que não pertence diretamente a uma obra.',
    combustivel: 'Preferencialmente registrado como Gasto da Empresa e associado à viatura.',
    tipoDocumento: 'Fatura: documento de despesa. Nota de crédito: reduz um gasto anterior e corrige o IVA.',
    notaCredito: 'Documento que reduz um gasto/fatura anterior e também corrige o IVA correspondente.',
  },
  iva: {
    taxa: 'Percentagem de IVA aplicada na fatura, por exemplo 23%.',
    dedutivel:
      'Percentagem do IVA que a empresa pode recuperar. IVA 23% e dedutível 50% não significa IVA de 11,5%. Ex.: base €100 → IVA €23 → dedutível €11,50.',
    naoDedutivel: 'Parte do IVA que não pode ser recuperada.',
    regraFornecedor: 'Valores padrão preenchidos automaticamente ao selecionar este fornecedor.',
    alteracaoManual: 'Alterar nesta fatura não deve modificar faturas antigas.',
    salvarFornecedor: 'Guarda categoria, IVA e percentagem dedutível para próximas faturas.',
    registrado: 'IVA existente nos documentos cadastrados no sistema.',
  },
  recebimento: {
    faturado: 'Valor emitido/cobrado ao cliente. Não significa que já foi recebido.',
    recebido: 'Dinheiro que efetivamente entrou.',
    aReceber: 'Valor que ainda está pendente.',
  },
  relatorio: {
    resultadoPeriodo:
      'Resultado interno do período: recebimentos reais das obras da Emerson, mais a parte dela nos Acertos concluídos, menos os gastos da empresa. Não inclui o valor do orçamento nem a parte dos parceiros.',
    dadosIncompletos: 'Períodos antigos podem não ter todas as informações de IVA ou gastos cadastradas.',
    totalDiarias: 'Quantidade total de diárias registradas no período.',
  },
  viatura: {
    associar: 'Permite saber quanto cada veículo custa à empresa.',
    carregamento: 'Gasto de carregamento de veículo elétrico.',
    viaVerde: 'Despesa associada ao uso das viaturas.',
    combustivel: 'Preferencialmente registado na empresa e associado à viatura.',
  },
};
