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
async function updateProjectDescription(projectId, description) {
    try {
        const response = await fetch('/api/atualizar-projeto', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ projectId, description })
        });

        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Descrição do projeto atualizada com sucesso:', result);
        return result;
    } catch (error) {
        console.error('Falha ao atualizar a descrição do projeto:', error);
        throw error;
    }
}
