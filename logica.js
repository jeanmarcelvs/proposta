/**
 * Função para processar os dados brutos da API e criar um objeto padronizado.
 * @param {object} dadosBrutos - O objeto JSON recebido diretamente da API.
 * @returns {object} Um objeto com os dados da proposta organizados e padronizados.
 */
export function processarDadosProposta(dadosBrutos) {

    // Extrai os arrays principais para facilitar o acesso.
    const tabelaPrecos = dadosBrutos.pricingTable || [];
    const dadosSistema = dadosBrutos.data?.find(d => d.topic === "Sistema Solar")?.items || [];
    const dadosFinanceiro = dadosBrutos.data?.find(d => d.topic === "Financeiro")?.items || [];
    const dadosGerais = dadosBrutos.data?.find(d => d.topic === "Dados gerais")?.items || [];
    const dadosCliente = dadosBrutos.data?.find(d => d.topic === "Cliente")?.items || [];
    
    // ######################################################################
    // FUNÇÕES AUXILIARES
    // ######################################################################
    
    // Função para encontrar um item em um array por sua chave ('key').
    function encontrarItemPorChave(arrayDeDados, chave) {
        const item = arrayDeDados.find(dado => dado.key === chave);
        return item || { value: 'N/A' };
    }

    // Função para encontrar um item na tabela de preços por 'category'.
    function encontrarItemPorCategoria(categoria) {
        const item = tabelaPrecos.find(item => item.category === categoria);
        if (!item) {
            return { fabricante: 'Não especificado', modelo: 'Não encontrado', quantidade: 0 };
        }
        return {
            fabricante: item.item.split(' ')[0],
            modelo: item.item,
            quantidade: item.qnt
        };
    }

    // Função para agrupar dados de financiamento que possuem chaves incrementais.
    function agruparPlanosDeFinanciamento(dados) {
        const planos = [];
        let i = 1;
        while (true) {
            const nomeFinanciamento = encontrarItemPorChave(dados, `f_nome_${i}`);
            if (nomeFinanciamento.value === 'N/A') break;
            
            const plano = {
                nome: nomeFinanciamento.value,
                entrada: encontrarItemPorChave(dados, `f_entrada_${i}`).value,
                valorTotal: encontrarItemPorChave(dados, `f_valor_${i}`).value,
                prazo: encontrarItemPorChave(dados, `f_prazo_${i}`).value,
                parcela: encontrarItemPorChave(dados, `f_parcela_${i}`).value,
            };
            planos.push(plano);
            i++;
        }
        return planos;
    }

    /**
     * Lógica de Negócio: Calcula os valores para a Proposta Econômica.
     * O fator de redução é inversamente proporcional à potência do sistema.
     * @param {number} potenciaKw - Potência do sistema em kWp.
     * @param {number} precoPremium - O preço total da proposta Premium.
     * @param {Array} planosPremium - Os planos de financiamento da proposta Premium.
     * @returns {object} Um objeto com os dados calculados para a proposta Econômica.
     */
    function calcularPropostaEconomica(potenciaKw, precoPremium, planosPremium) {
        const REDUCAO_MIN = 0.079;
        const REDUCAO_MAX = 0.098;
        const FAIXA_POTENCIA_MAX = 100;

        const fatorReducao = REDUCAO_MIN + (REDUCAO_MAX - REDUCAO_MIN) * (1 - Math.min(potenciaKw / FAIXA_POTENCIA_MAX, 1));
        
        const precoEconomico = precoPremium * (1 - fatorReducao);

        const planosEconomicos = planosPremium.map(plano => {
            const parcelaOriginal = parseFloat(String(plano.parcela).replace(',', '.'));
            const parcelaEconomica = parcelaOriginal * (1 - fatorReducao);
            return {
                ...plano,
                valorTotal: precoEconomico.toFixed(2),
                parcela: parcelaEconomica.toFixed(2).replace('.', ','),
            };
        });

        return {
            precoTotalVenda: precoEconomico.toFixed(2).replace('.', ','),
            planosFinanciamento: planosEconomicos,
        };
    }
    
    /**
     * Lógica de Negócio: Identifica a Parcela de Equilíbrio.
     * É a parcela mais próxima de 35% do consumo médio, com o menor prazo.
     * @param {Array} planos - O array de planos de financiamento.
     * @param {number} consumoMedio - O consumo médio mensal do cliente.
     * @returns {string|null} O prazo (prazo) do plano de equilíbrio ou `null` se não encontrar.
     */
    function encontrarParcelaEquilibrio(planos, consumoMedio) {
        const valorReferencia = parseFloat(String(consumoMedio).replace(',', '.'));
        const valorIdealParcela = valorReferencia * (1 - 0.35);

        let melhorPlano = null;
        let menorDiferenca = Infinity;

        planos.forEach(plano => {
            const valorParcela = parseFloat(String(plano.parcela).replace(',', '.'));
            const diferenca = Math.abs(valorParcela - valorIdealParcela);

            if (diferenca < menorDiferenca) {
                menorDiferenca = diferenca;
                melhorPlano = plano;
            } else if (diferenca === menorDiferenca && plano.prazo < melhorPlano.prazo) {
                melhorPlano = plano;
            }
        });
        
        return melhorPlano ? melhorPlano.prazo : null;
    }

    /**
     * Lógica de Negócio: Calcula o valor da conta ideal.
     * @param {number} geracaoMensal - Geração média mensal em kWh.
     * @returns {string} Valor da conta formatado em Reais.
     */
    function calcularValorContaIdeal(geracaoMensal) {
        const TARIFA_FIXA = 1.18;
        const geracaoNumerica = parseFloat(String(geracaoMensal).replace(',', '.'));
        const valorConta = geracaoNumerica * TARIFA_FIXA;
        return valorConta.toFixed(2).replace('.', ',');
    }

    // ######################################################################
    // CRIAÇÃO DO OBJETO FINAL PADRONIZADO
    // ######################################################################
    const nomeCliente = encontrarItemPorChave(dadosCliente, 'cliente_nome').value;
    const cidadeCliente = encontrarItemPorChave(dadosCliente, 'cliente_cidade').value;
    const estadoCliente = encontrarItemPorChave(dadosCliente, 'cliente_estado').value;

    const propostaPadronizada = {
        // Dados do cliente e datas
        idProjeto: dadosBrutos.id || 'N/A',
        // CORREÇÃO: Utiliza o valor do JSON para o nome e a localização
        nomeCliente: nomeCliente || 'Nome do cliente não disponível',
        localizacao: `${cidadeCliente}, ${estadoCliente}` || 'Localização não disponível',
        // CORREÇÃO: Utiliza o 'generatedAt' para a data da proposta e 'expirationDate' para a validade
        dataCriacao: dadosBrutos.generatedAt || 'N/A',
        dataExpiracao: dadosBrutos.expirationDate || 'N/A',
        
        // Dados do sistema solar
        potenciaSistema: encontrarItemPorChave(dadosSistema, 'potencia_sistema').value,
        geracaoMensal: encontrarItemPorChave(dadosSistema, 'geracao_mensal').value,
        inversor: encontrarItemPorCategoria('Inversor'),
        modulos: encontrarItemPorCategoria('Módulo'),
        // NOVO: Adiciona a informação do tipo de instalação
        tipoInstalacao: encontrarItemPorChave(dadosGerais, 'vc_tipo_de_estrutura').value,

        // Dados financeiros
        consumoMedio: encontrarItemPorChave(dadosGerais, 'consumo_medio').value,
        precoTotalVenda: encontrarItemPorChave(dadosFinanceiro, 'preco').value,
        payback: encontrarItemPorChave(dadosFinanceiro, 'payback').value,
        planosFinanciamento: agruparPlanosDeFinanciamento(dadosFinanceiro),

        // Lógica de Negócio: Calcula a versão Econômica da proposta
        propostaEconomica: {}
    };

    // Preenche os dados da proposta Econômica
    const potenciaKw = parseFloat(String(propostaPadronizada.potenciaSistema).replace(',', '.'));
    const precoPremium = parseFloat(String(propostaPadronizada.precoTotalVenda).replace(',', '.'));
    const planosPremium = propostaPadronizada.planosFinanciamento;
    propostaPadronizada.propostaEconomica = calcularPropostaEconomica(potenciaKw, precoPremium, planosPremium);

    // Identifica a parcela de equilíbrio para a proposta Premium
    const consumoMedioNum = parseFloat(String(propostaPadronizada.consumoMedio).replace(',', '.'));
    propostaPadronizada.parcelaEquilibrioPremium = encontrarParcelaEquilibrio(planosPremium, consumoMedioNum);

    // Identifica a parcela de equilíbrio para a proposta Econômica
    const planosEconomica = propostaPadronizada.propostaEconomica.planosFinanciamento;
    propostaPadronizada.propostaEconomica.parcelaEquilibrio = encontrarParcelaEquilibrio(planosEconomica, consumoMedioNum);

    // Adiciona o valor ideal da conta ao objeto da proposta
    propostaPadronizada.valorContaIdeal = calcularValorContaIdeal(propostaPadronizada.geracaoMensal);
    
    // Adiciona o valor ideal da conta também à proposta econômica, pois não muda
    propostaPadronizada.propostaEconomica.valorContaIdeal = propostaPadronizada.valorContaIdeal;

    return propostaPadronizada;
}

/**
 * Função para verificar se a proposta expirou.
 * @param {string} dataExpiracao - A data de expiração da proposta (ISO 8601).
 * @returns {boolean} `true` se a proposta expirou, `false` caso contrário.
 */
export function verificarPropostaExpirada(dataExpiracao) {
    if (!dataExpiracao) {
        return true; // Considera expirada se a data não existir
    }
    const dataAtual = new Date();
    const dataValidade = new Date(dataExpiracao);
    return dataAtual > dataValidade;
}