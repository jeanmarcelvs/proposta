/**
 * model.js
 * * Este arquivo é o Modelo do projeto. Ele contém a lógica de negócios,
 * se comunica com a camada de API e prepara os dados para o Controlador.
 */
// Importa as funções da API, incluindo a nova 'authenticate' e 'patch'
import { get, post, authenticate, patch } from './api.js';

// **ATENÇÃO: SUBSTITUA COM A SUA TOKEN DE API PESSOAL**
// Para fins de teste, ela está aqui. Em produção, use um método mais seguro.

//const apiToken = process.env.API_TOKEN;
const apiToken = "3649:y915jaWXevVcFJWaIdzNZJHlYfXL3MdbOwXX041T"

// Objeto que armazena os dados da proposta, incluindo as duas versões
let dadosProposta = {
    premium: null,
    acessivel: null
};

// Objeto que centraliza os caminhos das imagens
const caminhosImagens = {
    equipamentos: {
        premium: 'imagens/huawei.png',
        acessivel: 'imagens/auxsolar.png'
    },
    instalacao: {
        premium: 'imagens/instalacao-premium.png',
        acessivel: 'imagens/instalacao-acessivel.png'
    }
};

/**
 * Função auxiliar para encontrar um objeto no array 'variables' pela chave
 * e retornar seu valor formatado.
 * @param {Array} array O array de objetos de variáveis.
 * @param {string} chave A chave a ser procurada (ex: 'consumo_mensal').
 * @returns {string|number|null} O valor da chave ou null se não for encontrada.
 */
function buscarValorVariavel(array, chave) {
    if (!Array.isArray(array)) {
        console.error('ERRO: O objeto de variáveis não é um array.');
        return null;
    }
    const item = array.find(v => v.key === chave);
    return item ? item.value : null;
}

/**
 * Função para tratar os dados da API e preparar os objetos de propostas.
 * @param {object} dadosApiBrutos Dados brutos retornados pela API.
 * @returns {object} Um objeto formatado com os dados da proposta.
 */
function tratarDadosProposta(dadosApiBrutos) {
    // CORREÇÃO: Acessando as propriedades diretamente do objeto principal
    if (!dadosApiBrutos || !dadosApiBrutos.variables) {
        console.error("ERRO: Dados brutos da API inválidos para tratamento.");
        return null;
    }

    const variables = dadosApiBrutos.variables;
    const propostaId = dadosApiBrutos.id;
    const cliente = dadosApiBrutos.owner.name;

    const consumoMensal = buscarValorVariavel(variables, 'consumo_mensal');
    const valorSistema = buscarValorVariavel(variables, 'valor_sistema');
    const valorEconomia = buscarValorVariavel(variables, 'economia_mensal');
    const valorPayback = buscarValorVariavel(variables, 'payback');
    const geracaoMensal = buscarValorVariavel(variables, 'geracao_mensal');

    return {
        id: propostaId,
        cliente: cliente,
        consumoMensal: consumoMensal ? `${consumoMensal} kWh` : 'Não disponível',
        geracaoMensal: geracaoMensal ? `${geracaoMensal} kWh` : 'Não disponível',
        valorSistema: valorSistema ? parseFloat(valorSistema).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não disponível',
        economiaMensal: valorEconomia ? parseFloat(valorEconomia).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não disponível',
        payback: valorPayback ? `${valorPayback} meses` : 'Não disponível'
    };
}

/**
 * Busca e trata a proposta na API. Agora busca a principal e a acessível.
 * @param {string} numeroProjeto O ID da proposta principal.
 * @returns {Promise<object>} Objeto com os dados de ambas as propostas.
 */
export async function buscarETratarProposta(numeroProjeto) {
    try {
        console.log(`Modelo: Buscando proposta PREMIUM para o ID: ${numeroProjeto}`);

        // 1. Autenticação na API
        const authResponse = await authenticate(apiToken);
        if (!authResponse.sucesso) {
            console.error("Modelo: Falha na autenticação.", authResponse.mensagem);
            return {
                sucesso: false,
                mensagem: authResponse.mensagem
            };
        }
        const accessToken = authResponse.accessToken;

        // 2. Busca a proposta principal (PREMIUM)
        const endpointPrincipal = `/projects/${numeroProjeto}`;
        const respostaPrincipal = await get(endpointPrincipal, accessToken);

        if (!respostaPrincipal.sucesso) {
            console.error("Modelo: Falha ao buscar a proposta PREMIUM.", respostaPrincipal.mensagem);
            return respostaPrincipal;
        }
        const dadosPropostaPrincipal = respostaPrincipal.dados;

        // Armazena a proposta principal (PREMIUM)
        dadosProposta.premium = tratarDadosProposta(dadosPropostaPrincipal);

        // 3. Verifica se existe um ID de proposta acessível na resposta
        // CORREÇÃO: Usando a chave correta fornecida pelo usuário, acessando 'variables' do objeto principal
        const idPropostaAcessivel = buscarValorVariavel(dadosPropostaPrincipal.variables, 'vc_prejeto_acessivel');

        // Apenas busca a segunda proposta se o ID for um valor válido e numérico
        if (idPropostaAcessivel && !isNaN(idPropostaAcessivel)) {
            console.log(`Modelo: ID da proposta acessível encontrado: ${idPropostaAcessivel}. Buscando...`);

            // 4. Busca a segunda proposta (+Acessível)
            const endpointAcessivel = `/projects/${idPropostaAcessivel}`;
            const respostaAcessivel = await get(endpointAcessivel, accessToken);

            if (respostaAcessivel.sucesso) {
                // Armazena a proposta acessível
                dadosProposta.acessivel = tratarDadosProposta(respostaAcessivel.dados);
                console.log("Modelo: Dados da proposta +Acessível carregados com sucesso!");
            } else {
                console.warn("Modelo: Não foi possível carregar a proposta +Acessível. Acessível será nulo.");
                dadosProposta.acessivel = null;
            }
        } else {
            console.warn("Modelo: Nenhum ID de proposta acessível válido encontrado. Acessível será nulo.");
            dadosProposta.acessivel = null;
        }

        // 5. Retorna o objeto completo com ambas as propostas
        return {
            sucesso: true,
            dados: dadosProposta,
            caminhosImagens: caminhosImagens
        };

    } catch (erro) {
        console.error('Modelo: Ocorreu um erro no fluxo de busca de propostas:', erro);
        return {
            sucesso: false,
            mensagem: 'Ocorreu um erro inesperado ao buscar as propostas.'
        };
    }
}

/**
 * Função para atualizar o status de visualização na API.
 * @param {object} dados Os dados a serem enviados (ex: numeroProjeto e tipo de visualização).
 */
export async function atualizarStatusVisualizacao(dados) {
    try {
        console.log("Modelo: Recebendo dados para atualização.");
        const authResponse = await authenticate(apiToken);
        if (!authResponse.sucesso) {
            console.error("Modelo: Falha na autenticação para atualizar status.", authResponse.mensagem);
            return authResponse;
        }

        const accessToken = authResponse.accessToken;

        // Formata a data e hora para a mensagem da API
        const agora = new Date();
        const dataHoraFormatada = `${agora.getDate().toString().padStart(2, '0')}-${(agora.getMonth() + 1).toString().padStart(2, '0')}-${agora.getFullYear()} ${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;

        // Monta a mensagem para o campo 'description'
        const novaDescricao = `${dados.tipoVisualizacao}: ${dataHoraFormatada}`;

        // O endpoint correto é o do projeto, e o método é PATCH
        const endpoint = `/projects/${dados.propostaId}`;
        const body = {
            description: novaDescricao
        };

        const respostaApi = await patch(endpoint, body, accessToken);

        if (respostaApi.sucesso) {
            console.log("Modelo: Status de visualização atualizado com sucesso!");
        } else {
            console.error("Modelo: Falha ao atualizar status de visualização.");
        }
    } catch (erro) {
        console.error("Modelo: Erro ao tentar atualizar o status de visualização.", erro);
        return {
            sucesso: false,
            mensagem: 'Ocorreu um erro inesperado ao atualizar o status.'
        };
    }
}