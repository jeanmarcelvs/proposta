// api.js

/**
 * Função de comunicação com o backend para consultar a proposta.
 * Esta função é exportada para ser utilizada por outros módulos JS.
 * @param {string} projectId - O ID do projeto a ser consultado.
 * @returns {Promise<Object>} Uma Promise que resolve com os dados da proposta.
 */
export async function consultarProposta(projectId) {
    // URL da sua Vercel Serverless Function
    const url = `/api/proposta?projectId=${encodeURIComponent(projectId)}`;
    
    // Realiza a requisição e trata a resposta
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Erro ao consultar proposta: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data;
}



/**
 * Função para notificar o backend que o preço foi visualizado.
 * @param {string} projectId - O ID do projeto a ser atualizado.
 * @returns {Promise<Object>} Uma Promise que resolve com a resposta da atualização.
 */
export async function notificarVisualizacao(projectId) {
    const url = '/api/atualizar-projeto';
    
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        // CORREÇÃO: Enviamos apenas o projectId
        body: JSON.stringify({ projectId: projectId })
    });

    if (!response.ok) {
        throw new Error(`Erro ao chamar a API de atualização: ${response.status}`);
    }

    return response.json();
}