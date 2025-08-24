// Arquivo: api.js

export async function consultarProposta(projectId) {
    const url = `/api/proposta?projectId=${encodeURIComponent(projectId)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erro ao consultar proposta: ${response.status}`);
    return response.json();
}

/**
 * Envia um evento de tracking para o backend.
 * @param {string} projectId - O ID do projeto.
 * @param {string} eventMessage - A mensagem do evento a ser registrada.
 * @returns {Promise<Object>}
 */
export async function registrarEvento(projectId, eventMessage) {
    const url = '/api/atualizar-projeto';
    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, eventMessage })
    });
    if (!response.ok) throw new Error(`Erro ao chamar a API de atualização: ${response.status}`);
    return response.json();
}
