// Arquivo: api.js

/**
 * Função para consultar a proposta no backend.
 * @param {string} projectId - O ID do projeto a ser consultado.
 * @returns {Promise<Object>} Uma Promise que resolve com os dados da proposta.
 */
export async function consultarProposta(projectId) {
    const url = `/api/proposta?projectId=${encodeURIComponent(projectId)}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro ao consultar proposta: ${response.status}`);
    }
    return response.json();
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
        body: JSON.stringify({ projectId: projectId })
    });
    if (!response.ok) {
        throw new Error(`Erro ao chamar a API de atualização: ${response.status}`);
    }
    return response.json();
}
