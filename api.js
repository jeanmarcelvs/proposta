// Arquivo: api.js

export async function consultarProposta(projectId) {
    const url = `/api/proposta?projectId=${encodeURIComponent(projectId)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erro ao consultar proposta: ${response.status}`);
    return response.json();
}

/**
 * Envia a nova descrição completa do projeto para o backend.
 * @param {string} projectId - O ID do projeto.
 * @param {string} newDescription - A nova descrição completa a ser salva.
 * @returns {Promise<Object>}
 */
export async function atualizarDescricao(projectId, newDescription) {
    const url = '/api/atualizar-projeto';
    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, newDescription })
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Erro na API de atualização:", errorBody);
        throw new Error(`Erro ao chamar a API de atualização: ${response.status}`);
    }
    return response.json();
}
