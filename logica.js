/**
 * Arquivo: logica.js
 * Responsável por toda a lógica de negócio e processamento dos dados da proposta.
 */

// Valores de configuração para a lógica de negócio
const CONFIG = {
    REDUCAO_MIN: 0.10,
    REDUCAO_MAX: 0.20,
    FAIXA_POTENCIA_MAX: 10,
    TARIFA_PADRAO_KWH: 0.90
};

/**
 * Função para processar os dados brutos da API e criar um objeto padronizado.
 * @param {object} dadosBrutos - O objeto JSON recebido diretamente da API.
 * @returns {object} Um objeto com os dados da proposta organizados e padronizados.
 */
export function processarDadosProposta(dadosBrutos) {

    // Extrai os arrays principais para facilitar o acesso.
    const pricingTable = dadosBrutos.pricingTable || [];
    const dadosSistema = dadosBrutos.variables?.filter(d => d.topic === "Sistema Solar") || [];
    const dadosFinanceiro = dadosBrutos.variables?.filter(d => d.topic === "Financeiro") || [];
    const dadosGerais = dadosBrutos.variables?.filter(d => d.topic === "Dados gerais") || [];
    const dadosCliente = dadosBrutos.variables?.filter(d => d.topic === "Cliente") || [];
    
    // ######################################################################
    // FUNÇÕES AUXILIARES
    // ######################################################################
    
    /**
     * Encontra um item em um array por sua chave e retorna seu valor.
     * Prioriza 'formattedValue' para exibição.
     * @param {Array} arrayDeDados - O array de objetos.
     * @param {string} chave - A chave a ser buscada.
     * @returns {object} Um objeto com o valor e a unidade, ou um objeto vazio se não encontrado.
     */
    const buscarValor = (arrayDeDados, chave) => {
        const item = arrayDeDados.find(d => d.key === chave);
        if (item) {
            return {
                value: item.value,
                rawValue: item.rawValue,
                formattedValue: item.formattedValue,
                unit: item.unit
            };
        }
        return {};
    };

    /**
     * Calcula o valor da conta de energia ideal com o sistema.
     * @param {number} geracaoMensal - A geração mensal do sistema em kWh.
     * @returns {number} O valor ideal da conta em Reais.
     */
    const calcularValorContaIdeal = (geracaoMensal) => {
        const energiaInjetada = geracaoMensal * 0.95; // Estimativa de perdas
        const saldoEnergia = Math.max(0, energiaInjetada - geracaoMensal);
        return saldoEnergia * CONFIG.TARIFA_PADRAO_KWH;
    };

    /**
     * Calcula a proposta econômica com base em preços reduzidos.
     * @param {number} potenciaSistema - A potência do sistema em kWp.
     * @param {number} precoTotalVenda - O preço total de venda da proposta premium.
     * @param {array} planosFinanciamento - Os planos de financiamento da proposta premium.
     * @returns {object} Um novo objeto de proposta econômica.
     */
    const calcularPropostaEconomica = (potenciaSistema, precoTotalVenda, planosFinanciamento) => {
        let reducao = CONFIG.REDUCAO_MIN;
        if (potenciaSistema > CONFIG.FAIXA_POTENCIA_MAX) {
            reducao = CONFIG.REDUCAO_MAX;
        }

        const novoPrecoTotal = precoTotalVenda * (1 - reducao);
        const novosPlanos = planosFinanciamento.map(plano => ({
            ...plano,
            totalFinanciado: novoPrecoTotal,
            valorParcela: (novoPrecoTotal * (plano.taxaJuros / 100) / (1 - Math.pow(1 + (plano.taxaJuros / 100), -plano.prazo)))
        }));

        return {
            precoTotalVenda: {
                rawValue: novoPrecoTotal,
                formattedValue: `R$ ${novoPrecoTotal.toFixed(2).replace('.', ',')}`
            },
            planosFinanciamento: novosPlanos
        };
    };

    /**
     * Encontra a parcela de equilíbrio entre a conta de luz e o financiamento.
     * @param {Array} planos - O array de planos de financiamento.
     * @param {number} consumoMedio - O consumo médio mensal em kWh.
     * @returns {object|null} O plano de financiamento com a parcela mais próxima do valor da conta, ou null.
     */
    const encontrarParcelaEquilibrio = (planos, consumoMedio) => {
        // A conta de luz sem o sistema é o consumo médio * a tarifa padrão
        const valorContaSemSistema = consumoMedio * CONFIG.TARIFA_PADRAO_KWH;

        // Encontra o plano cuja parcela é mais próxima do valor da conta
        let melhorPlano = null;
        let menorDiferenca = Infinity;

        for (const plano of planos) {
            const diferenca = Math.abs(plano.valorParcela - valorContaSemSistema);
            if (diferenca < menorDiferenca) {
                menorDiferenca = diferenca;
                melhorPlano = plano;
            }
        }
        return melhorPlano;
    };

    // ######################################################################
    // 3. EXTRAÇÃO E FORMATAÇÃO DOS DADOS DA API
    // ######################################################################

    const nomeCliente = buscarValor(dadosCliente, 'clientName').formattedValue || 'Não Informado';
    const cpfCnpj = buscarValor(dadosCliente, 'clientCpfCnpj').formattedValue || 'Não Informado';
    const enderecoCliente = buscarValor(dadosCliente, 'clientAddress').formattedValue || 'Não Informado';
    const potenciaSistema = buscarValor(dadosSistema, 'systemPower');
    const geracaoMensal = buscarValor(dadosSistema, 'monthlyGeneration');
    const consumoMedio = buscarValor(dadosGerais, 'monthlyAverageConsumption');
    const precoTotalVenda = buscarValor(dadosFinanceiro, 'totalSalePrice');
    const validadeProposta = buscarValor(dadosGerais, 'proposalValidity');
    const planosFinanciamento = pricingTable.find(p => p.topic === 'Financiamento')?.data || [];

    // ######################################################################
    // 4. ESTRUTURAÇÃO DO OBJETO FINAL (PROPOSTA PADRONIZADA)
    // ######################################################################
    
    // Esta é a nossa proposta 'Premium'
    const propostaPadronizada = {
        cliente: {
            nome: nomeCliente,
            cpfCnpj: cpfCnpj,
            endereco: enderecoCliente
        },
        sistema: {
            potencia: potenciaSistema.formattedValue,
            geracaoMensal: geracaoMensal.formattedValue,
            consumoMedio: consumoMedio.formattedValue
        },
        financiamento: {
            precoTotalVenda: precoTotalVenda.formattedValue,
            planosFinanciamento: planosFinanciamento
        },
        dataValidade: validadeProposta.formattedValue,
        // ######################################################################
        // ADICIONA A PROPOSTA ECONÔMICA GERADA
        // ######################################################################
        propostaEconomica: calcularPropostaEconomica(potenciaSistema.rawValue, precoTotalVenda.rawValue, planosFinanciamento)
    };

    // Identifica a parcela de equilíbrio para a proposta Premium
    propostaPadronizada.parcelaEquilibrioPremium = encontrarParcelaEquilibrio(propostaPadronizada.financiamento.planosFinanciamento, consumoMedio.rawValue);

    // Identifica a parcela de equilíbrio para a proposta Econômica
    const planosEconomica = propostaPadronizada.propostaEconomica.planosFinanciamento;
    propostaPadronizada.propostaEconomica.parcelaEquilibrio = encontrarParcelaEquilibrio(planosEconomica, consumoMedio.rawValue);

    // Adiciona o valor ideal da conta ao objeto da proposta
    propostaPadronizada.valorContaIdeal = calcularValorContaIdeal(geracaoMensal.rawValue);
    
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
        return true; // Considera como expirada se a data não for fornecida.
    }
    const dataExpiracaoObj = new Date(dataExpiracao);
    const dataAtual = new Date();
    dataAtual.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas a data

    return dataAtual > dataExpiracaoObj;
}