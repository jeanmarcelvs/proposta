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
    // CORREÇÃO: Busca segura por dados do cliente para evitar 'N/A'
    const clienteData = dadosBrutos.data?.find(d =>