/**
 * model.js
 * Este arquivo é o Modelo do projeto. Ele contém a lógica de negócios,
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
 * @param {Array} variables O array de objetos de onde extrair os dados.
 * @param {string} key A chave do objeto a ser encontrado.
 * @returns {string|null} O valor formatado ou null se não encontrado.
 */
function buscarValorVariavel(variables, key) {
    if (!Array.isArray(variables)) {
        console.error("ERRO: O objeto de variáveis não é um array.");
        return null;
    }
    const item = variables.find(v => v.key === key);
    return item ? (item.value || 'N/A') : null;
}

/**
 * Trata os dados brutos da API e extrai informações da proposta.
 * @param {object} dadosBrutos Objeto de dados recebido da API.
 * @param {string} tipo O tipo de proposta ('premium' ou 'acessivel').
 * @returns {object} Um objeto com os dados da proposta formatados.
 */
function tratarDadosProposta(dadosBrutos, tipo) {
    console.log(`Modelo: Tratando dados para proposta ${tipo}`);

    // CORRIGIDO: Adiciona uma verificação mais robusta para os dados
    if (!dadosBrutos || !Array.isArray(dadosBrutos.variables)) {
        console.error("ERRO: Dados brutos da API inválidos para tratamento.");
        return null;
    }

    const variables = dadosBrutos.variables;
    const cliente = dadosBrutos.project.name || 'Cliente';
    const propostaId = dadosBrutos.project.id;

    // Extrai valores das variáveis
    const consumo = buscarValorVariavel(variables, 'consumo-medio');
    const geracao = buscarValorVariavel(variables, 'geracao-estimada');
    const valorSistema = buscarValorVariavel(variables, 'valor-sistema');
    const economia = buscarValorVariavel(variables, 'economia-mensal');
    const payback = buscarValorVariavel(variables, 'payback');

    // Mapeamento dinâmico das imagens
    const imagemEquipamentos = caminhosImagens.equipamentos[tipo];
    const imagemInstalacao = caminhosImagens.instalacao[tipo];

    const propostaFormatada = {
        id: propostaId,
        cliente: cliente,
        consumoMensal: `${consumo} kWh`,
        geracaoMensal: `${geracao} kWh`,
        valorSistema: `R$ ${valorSistema}`,
        economiaMensal: `R$ ${economia}`,
        payback: `${payback} anos`,
        equipamentos: {
            imagem: imagemEquipamentos
        },
        instalacao: {
            imagemInstalacao: imagemInstalacao
        }
    };

    return propostaFormatada;
}

/**
 * Busca uma proposta na API pelo ID do projeto e trata os dados.
 * @param {string} numeroProjeto O ID do projeto.
 * @param {string} tipo O tipo de proposta a ser buscada.
 * @returns {Promise<object>} Um objeto com os dados da proposta ou erro.
 */
async function buscarPropostaPorTipo(numeroProjeto, tipo) {
    console.log(`Modelo: Buscando proposta ${tipo.toUpperCase()} para o ID: ${numeroProjeto}`);
    const authResponse = await authenticate(apiToken);

    if (!authResponse.sucesso) {
        return { sucesso: false, mensagem: authResponse.mensagem };
    }

    const accessToken = authResponse.accessToken;
    const endpoint = `/projects/${numeroProjeto}/proposals`;
    const dadosApi = await get(endpoint, accessToken);
    
    // NOVO: Linha de depuração para ver a estrutura completa do JSON
    console.log("DEBUG: Estrutura completa do objeto dadosApi:", JSON.stringify(dadosApi, null, 2));

    console.log("Modelo: Resposta bruta da API:", dadosApi);

    // CORRIGIDO: Agora, passamos o objeto 'dadosApi.dados' diretamente para a função tratarDadosProposta
    if (!dadosApi.sucesso || !dadosApi.dados || !Array.isArray(dadosApi.dados.variables)) {
        return { sucesso: false, mensagem: 'Não foram encontradas propostas válidas para este projeto.' };
    }

    const propostaTratada = tratarDadosProposta(dadosApi.dados, tipo);
    if (!propostaTratada) {
        return {
            sucesso: false,
            mensagem: 'Dados da API para a proposta ' + tipo + ' são inválidos.'
        };
    }

    return { sucesso: true, proposta: propostaTratada };
}

/**
 * Busca a proposta principal e a proposta acessível (se houver) e armazena os dados.
 * @param {string} numeroProjeto O ID do projeto principal.
 * @returns {Promise<object>} Objeto com os dados de ambas as propostas ou um erro.
 */
export async function buscarETratarProposta(numeroProjeto) {
    dadosProposta.premium = null;
    dadosProposta.acessivel = null;

    // Busca a proposta principal (PREMIUM)
    const propostaPremium = await buscarPropostaPorTipo(numeroProjeto, 'premium');
    if (!propostaPremium.sucesso) {
        return propostaPremium; // Retorna erro se a proposta premium não for encontrada
    }
    dadosProposta.premium = propostaPremium.proposta;

    // Tenta encontrar o ID da proposta acessível
    const dadosBrutos = await get(`/projects/${numeroProjeto}/proposals`, (await authenticate(apiToken)).accessToken);
    let idPropostaAcessivel = null;
    // CORRIGIDO: Ajuste na lógica para encontrar o ID da proposta acessível, acessando diretamente o array de variáveis
    if (dadosBrutos.sucesso && dadosBrutos.dados && Array.isArray(dadosBrutos.dados.variables)) {
        idPropostaAcessivel = buscarValorVariavel(dadosBrutos.dados.variables, 'proposta-acessivel');
    }

    if (idPropostaAcessivel) {
        console.log(`Modelo: ID de proposta acessível encontrado: ${idPropostaAcessivel}`);
        const propostaAcessivel = await buscarPropostaPorTipo(idPropostaAcessivel, 'acessivel');
        if (propostaAcessivel.sucesso) {
            dadosProposta.acessivel = propostaAcessivel.proposta;
        } else {
            console.warn("Modelo: Falha ao carregar a proposta acessível. Continuar com a premium.");
        }
    } else {
        console.log("Modelo: Nenhum ID de proposta acessível válido encontrado. Acessível será nulo.");
    }

    return {
        sucesso: true,
        proposta: dadosProposta
    };
}

/**
 * Atualiza o status de visualização da proposta na API.
 * @param {object} dados Objeto com propostaId e tipoVisualizacao.
 */
export async function atualizarStatusVisualizacao(dados) {
    console.log("Modelo: Tentando atualizar o status de visualização na API.");
    try {
        const authResponse = await authenticate(apiToken);
        if (!authResponse.sucesso) {
            console.error("Modelo: Falha na autenticação para atualizar status.", authResponse.mensagem);
            return authResponse;
        }

        const accessToken = authResponse.accessToken;
        const agora = new Date();
        const dataHoraFormatada = `${agora.getDate().toString().padStart(2, '0')}-${(agora.getMonth() + 1).toString().padStart(2, '0')}-${agora.getFullYear()} ${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;
        const novaDescricao = `${dados.tipoVisualizacao}: ${dataHoraFormatada}`;
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
        console.error("Modelo: Erro no processo de atualização do status de visualização.", erro);
        return { sucesso: false, mensagem: 'Erro inesperado ao atualizar status.' };
    }
}