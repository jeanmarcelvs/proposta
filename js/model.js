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
    if (!dadosApiBrutos || !dadosApiBrutos.data || !dadosApiBrutos.data.variables) {
        console.error("ERRO: Dados brutos da API inválidos para tratamento.");
        return null;
    }

    const variables = dadosApiBrutos.data.variables;
    const propostaId = dadosApiBrutos.data.id;
    const cliente = dadosApiBrutos.data.owner.name;

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
        mostrarLoadingOverlay();
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
        // ATUALIZAÇÃO: Usando a chave correta fornecida pelo usuário
        const idPropostaAcessivel = buscarValorVariavel(dadosPropostaPrincipal.data.variables, 'vc_prejeto_acessivel');

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
 * CORREÇÃO: Função para ocultar a tela de splash
 * No seu código original essa função estava em indexController.js, mas
 * como é um comportamento global, pode ser movida para cá.
 */
function esconderTelaSplash() {
  const telaSplash = document.getElementById('tela-splash');
  if (telaSplash) {
    telaSplash.classList.add('oculto');
  }
}