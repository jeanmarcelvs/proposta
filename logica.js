/**
 * Arquivo: logica.js
 * Responsável por toda a lógica de negócio e processamento dos dados da proposta.
 */

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
     * @returns {object} Um objeto com o valor e o valor bruto.
     */
    function encontrarItemPorChave(arrayDeDados, chave) {
        const item = arrayDeDados.find(dado => dado.key === chave);
        if (!item) {
            return { value: 'N/A', rawValue: null };
        }
        // Prioriza o valor já formatado para a exibição
        const valorFormatado = item.formattedValue !== null ? item.formattedValue : 'N/A';
        // Usa o valor bruto para os cálculos internos
        const valorBruto = item.value !== null ? parseFloat(String(item.value).replace(',', '.')) : null;

        return {
            value: valorFormatado,
            rawValue: valorBruto
        };
    }

    /**
     * Encontra um item na tabela de preços por 'category'.
     * @param {string} category - A categoria a ser buscada.
     * @returns {object} Um objeto com fabricante, modelo e quantidade.
     */
    function encontrarItemPorCategoria(category) {
        const item = pricingTable.find(item => item.category === category);
        if (!item) {
            return { fabricante: 'Não especificado', modelo: 'Não encontrado', quantidade: 0 };
        }
        return {
            fabricante: item.item.split(' ')[0],
            modelo: item.item,
            quantidade: item.qnt
        };
    }

    /**
     * CORREÇÃO FINAL E ROBUSTA: Agrupa todos os dados de financiamento de forma precisa.
     * A lógica agora coleta todas as chaves de prazo e parcela e as agrupa pelo índice.
     * @param {Array} dados - O array de dados financeiros.
     * @returns {Array} Um array de objetos de planos de financiamento.
     */
    function agruparPlanosDeFinanciamento(dados) {
        const planosMap = new Map();

        // Itera sobre os dados para encontrar e agrupar as informações de prazo e parcela
        dados.forEach(dado => {
            const matchPrazo = dado.key.match(/^f_prazo_(\d+)$/);
            const matchParcela = dado.key.match(/^f_parcela_(\d+)$/);
            
            if (matchPrazo) {
                const indice = matchPrazo[1];
                if (!planosMap.has(indice)) planosMap.set(indice, {});
                planosMap.get(indice).prazo = {
                    value: dado.formattedValue !== null ? dado.formattedValue : 'N/A',
                    rawValue: dado.value !== null ? parseFloat(String(dado.value).replace(',', '.')) : null,
                };
            } else if (matchParcela) {
                const indice = matchParcela[1];
                if (!planosMap.has(indice)) planosMap.set(indice, {});
                planosMap.get(indice).parcela = {
                    value: dado.formattedValue !== null ? dado.formattedValue : 'N/A',
                    rawValue: dado.value !== null ? parseFloat(String(dado.value).replace(',', '.')) : null,
                };
            }
        });

        // Converte o mapa em um array e ordena os planos pelos seus índices numéricos
        const planos = Array.from(planosMap.keys())
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
            .map(indice => {
                const plano = planosMap.get(indice);
                // Garante que o objeto plano tenha todas as propriedades, mesmo que alguma esteja faltando no JSON
                return {
                    prazo: plano.prazo?.value || 'N/A',
                    parcela: plano.parcela?.value || 'N/A',
                    prazoRawValue: plano.prazo?.rawValue,
                    parcelaRawValue: plano.parcela?.rawValue,
                };
            });
            
        return planos;
    }

    /**
     * Lógica de Negócio: Calcula os valores para a Proposta Econômica.
     * @param {number} potenciaKw - Potência do sistema em kWp.
     * @param {number} precoPremium - O preço total da proposta Premium (valor numérico).
     * @param {Array} planosPremium - Os planos de financiamento da proposta Premium.
     * @returns {object} Um objeto com os dados calculados para a proposta Econômica.
     */
    function calcularPropostaEconomica(potenciaKw, precoPremium, planosPremium) {
        if (isNaN(potenciaKw) || isNaN(precoPremium)) {
            return {
                precoTotalVenda: 'N/A',
                planosFinanciamento: [],
            };
        }
        const REDUCAO_MIN = 0.079;
        const REDUCAO_MAX = 0.098;
        const FAIXA_POTENCIA_MAX = 100;

        const fatorReducao = REDUCAO_MIN + (REDUCAO_MAX - REDUCAO_MIN) * (1 - Math.min(potenciaKw / FAIXA_POTENCIA_MAX, 1));
        
        const precoEconomico = precoPremium * (1 - fatorReducao);

        const planosEconomicos = planosPremium.map(plano => {
            const parcelaOriginal = plano.parcelaRawValue;
            if (isNaN(parcelaOriginal)) return { ...plano, valorTotal: 'N/A', parcela: 'N/A' };
            const parcelaEconomica = parcelaOriginal * (1 - fatorReducao);
            return {
                ...plano,
                valorTotal: precoEconomico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                parcela: parcelaEconomica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                prazoRawValue: plano.prazoRawValue,
                parcelaRawValue: parcelaEconomica,
            };
        });

        return {
            precoTotalVenda: precoEconomico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            planosFinanciamento: planosEconomicos,
        };
    }
    
    /**
     * Lógica de Negócio: Identifica a Parcela de Equilíbrio.
     * @param {Array} planos - O array de planos de financiamento.
     * @param {number} consumoMedio - O consumo médio mensal do cliente.
     * @returns {string|null} O prazo (prazo) do plano de equilíbrio ou `null` se não encontrar.
     */
    function encontrarParcelaEquilibrio(planos, consumoMedio) {
        if (typeof consumoMedio !== 'number' || isNaN(consumoMedio)) {
            return null;
        }
        const valorIdealParcela = consumoMedio * (1 - 0.35);

        let melhorPlano = null;
        let menorDiferenca = Infinity;

        planos.forEach(plano => {
            const valorParcela = plano.parcelaRawValue;
            if (isNaN(valorParcela)) return;

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
     * @param {string} geracaoMensalStr - Geração média mensal em kWh como string.
     * @returns {string} Valor da conta formatado em Reais, ou 'N/A'.
     */
    function calcularValorContaIdeal(geracaoMensalStr) {
        const TARIFA_FIXA = 1.18;
        const geracaoNumerica = parseFloat(String(geracaoMensalStr).replace('.', '').replace(',', '.'));
        if (isNaN(geracaoNumerica)) {
            return 'N/A';
        }
        const valorConta = geracaoNumerica * TARIFA_FIXA;
        return valorConta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ######################################################################
    // CRIAÇÃO DO OBJETO FINAL PADRONIZADO
    // ######################################################################
    const nomeCliente = encontrarItemPorChave(dadosCliente, 'cliente_nome').value;
    const cidadeCliente = encontrarItemPorChave(dadosCliente, 'cliente_cidade').value;
    const estadoCliente = encontrarItemPorChave(dadosCliente, 'cliente_estado').value;
    const potenciaSistema = encontrarItemPorChave(dadosSistema, 'potencia_sistema');
    const geracaoMensal = encontrarItemPorChave(dadosSistema, 'geracao_mensal');
    const precoTotalVenda = encontrarItemPorChave(dadosFinanceiro, 'preco');
    const consumoMedio = encontrarItemPorChave(dadosGerais, 'consumo_medio');
    
    const planosFinanciamento = agruparPlanosDeFinanciamento(dadosFinanceiro);

    const localizacao = (cidadeCliente !== 'N/A' || estadoCliente !== 'N/A') ?
        [cidadeCliente, estadoCliente].filter(item => item !== 'N/A').join(', ') : 'Localização não disponível';

    const propostaPadronizada = {
        // Dados do cliente e datas
        idProjeto: dadosBrutos.id || 'N/A',
        nomeCliente: nomeCliente || 'Nome do cliente não disponível',
        localizacao: localizacao,
        dataCriacao: dadosBrutos.generatedAt || 'N/A',
        dataExpiracao: dadosBrutos.expirationDate || 'N/A',
        
        // Dados do sistema solar
        potenciaSistema: potenciaSistema.value,
        geracaoMensal: geracaoMensal.value,
        inversor: encontrarItemPorCategoria('Inversor'),
        modulos: encontrarItemPorCategoria('Módulo'),
        // CORREÇÃO: Busca o tipo de instalação diretamente do objeto principal
        tipoInstalacao: dadosBrutos.variables?.find(v => v.key === 'vc_tipo_de_estrutura')?.formattedValue || 'N/A',

        // Dados financeiros
        consumoMedio: consumoMedio.value,
        precoTotalVenda: precoTotalVenda.value,
        payback: encontrarItemPorChave(dadosFinanceiro, 'payback').value,
        planosFinanciamento: planosFinanciamento,

        // Lógica de Negócio: Calcula a versão Econômica da proposta
        propostaEconomica: calcularPropostaEconomica(potenciaSistema.rawValue, precoTotalVenda.rawValue, planosFinanciamento)
    };

    // Identifica a parcela de equilíbrio para a proposta Premium
    propostaPadronizada.parcelaEquilibrioPremium = encontrarParcelaEquilibrio(propostaPadronizada.planosFinanciamento, consumoMedio.rawValue);

    // Identifica a parcela de equilíbrio para a proposta Econômica
    const planosEconomica = propostaPadronizada.propostaEconomica.planosFinanciamento;
    propostaPadronizada.propostaEconomica.parcelaEquilibrio = encontrarParcelaEquilibrio(planosEconomica, consumoMedio.rawValue);

    // Adiciona o valor ideal da conta ao objeto da proposta
    propostaPadronizada.valorContaIdeal = calcularValorContaIdeal(geracaoMensal.value);
    
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