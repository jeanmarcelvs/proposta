/**
 * api.js
 * * Este arquivo é responsável por toda a comunicação com a API externa Solar Market.
 * Centraliza a lógica de autenticação e as chamadas de API.
 */

// A URL base da API externa
const BASE_URL = 'https://business.solarmarket.com.br/api/v2';

/**
 * Realiza a autenticação na API e retorna um access_token temporário.
 * @param {string} apiToken A token de API do seu perfil.
 * @returns {Promise<object>} Um objeto com o access_token ou uma mensagem de erro.
 */
export async function authenticate(apiToken) {
    try {
        console.log('API: Iniciando autenticação...');
        const response = await fetch(`${BASE_URL}/auth/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ token: apiToken })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('API: Falha na autenticação.', data);
            return {
                sucesso: false,
                mensagem: data.mensagem || 'Falha na autenticação. Verifique sua token de API.'
            };
        }

        console.log('API: Autenticação bem-sucedida!');
        return {
            sucesso: true,
            accessToken: data.access_token
        };

    } catch (error) {
        console.error('API: Erro de rede durante a autenticação.', error);
        return {
            sucesso: false,
            mensagem: 'Não foi possível conectar-se ao servidor de autenticação.'
        };
    }
}

/**
 * Faz uma requisição GET para a API externa.
 * @param {string} endpoint O caminho específico da API (ex: '/projects/1770/proposals').
 * @param {string} accessToken A token de autenticação temporária (JWT).
 * @returns {Promise<object>} Um objeto contendo os dados da API ou um erro.
 */
export async function get(endpoint, accessToken) {
    try {
        console.log(`API: Buscando dados em ${BASE_URL}${endpoint}`);
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('API: Erro na resposta da requisição GET.', data);
            return {
                sucesso: false,
                mensagem: data.mensagem || 'Ocorreu um erro ao buscar os dados.'
            };
        }

        // Acessa o objeto aninhado 'data' para retornar apenas o conteúdo relevante.
        return {
            sucesso: true,
            dados: data.data
        };

    } catch (error) {
        console.error('API: Erro de rede ou na requisição GET.', error);
        return {
            sucesso: false,
            mensagem: 'Não foi possível conectar-se ao servidor ou o token é inválido.'
        };
    }
}

/**
 * Faz uma requisição POST para a API externa.
 * @param {string} endpoint O caminho específico da API (ex: '/algum/endpoint').
 * @param {object} dados O corpo da requisição a ser enviado.
 * @param {string} accessToken A token de autenticação temporária (JWT).
 * @returns {Promise<object>} Um objeto confirmando o sucesso ou retornando um erro.
 */
export async function post(endpoint, dados, accessToken) {
    try {
        console.log(`API: Enviando dados para ${BASE_URL}${endpoint}`);
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(dados)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('API: Erro na resposta da requisição POST.', data);
            return {
                sucesso: false,
                mensagem: data.mensagem || 'Ocorreu um erro ao enviar os dados.'
            };
        }

        return {
            sucesso: true,
            mensagem: data.mensagem || 'Dados enviados com sucesso.'
        };

    } catch (error) {
        console.error('API: Erro de rede ou na requisição POST.', error);
        return {
            sucesso: false,
            mensagem: 'Não foi possível conectar-se ao servidor.'
        };
    }
}

/**
 * NOVO: Faz uma requisição PATCH para a API externa.
 * @param {string} endpoint O caminho específico da API (ex: '/projects/1770').
 * @param {object} dados O corpo da requisição a ser enviado.
 * @param {string} accessToken A token de autenticação temporária (JWT).
 * @returns {Promise<object>} Um objeto confirmando o sucesso ou retornando um erro.
 */
export async function patch(endpoint, dados, accessToken) {
    try {
        console.log(`API: Enviando dados para ${BASE_URL}${endpoint} com PATCH`);
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(dados)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('API: Erro na resposta da requisição PATCH.', data);
            return {
                sucesso: false,
                mensagem: data.mensagem || 'Ocorreu um erro ao atualizar os dados.'
            };
        }

        return {
            sucesso: true,
            mensagem: 'Dados atualizados com sucesso.',
            dados: data.data
        };

    } catch (error) {
        console.error('API: Erro de rede ou na requisição PATCH.', error);
        return {
            sucesso: false,
            mensagem: 'Não foi possível conectar-se ao servidor.'
        };
    }
}

// NOVO: Função para buscar a taxa Selic na API do Banco Central
/**
 * Busca a taxa Selic mais recente na API do Banco Central do Brasil.
 * @returns {Promise<number|null>} A taxa Selic anual em formato decimal ou null em caso de falha.
 */
export async function getSelicTaxa() {
    const url = 'https://api.bcb.gov.br/dados/SGS/6/dados?formato=json';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('API BCB: Erro na resposta.', await response.text());
            return null;
        }

        const dados = await response.json();

        if (dados && dados.length > 0) {
            // A API do BCB retorna os dados em ordem crescente de data,
            // então o último item é o mais recente.
            const dadoMaisRecente = dados[dados.length - 1];
            
            // O valor é um string no formato "XX,XX", precisamos converter para número
            // e dividir por 100 para ter o formato decimal (ex: 15.00 -> 0.15)
            const valorSelic = parseFloat(dadoMaisRecente.valor.replace(',', '.')) / 100;

            console.log(`API BCB: Selic atual encontrada: ${valorSelic * 100}%`);
            return valorSelic;
        } else {
            console.warn('API BCB: Não foram encontrados dados para a Selic.');
            return null;
        }

    } catch (error) {
        console.error('API BCB: Erro de rede ou na requisição.', error);
        return null;
    }
}