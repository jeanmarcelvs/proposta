const WORKER_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev/erp';
const SECURITY_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev/security';

function getHeaders() {
    return { 'Content-Type': 'application/json' };
}

/**
 * Busca os dados da proposta no Worker
 */
export async function buscarPropostaService(propostaId) {
    try {
        const response = await fetch(`${SECURITY_URL}/find-proposta`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ propostaId })
        });
        if (!response.ok) return { sucesso: false };
        return await response.json();
    } catch (error) {
        return { sucesso: false };
    }
}

// Exporta um alias para resolver o conflito de nomes no model.js
export { buscarPropostaService as buscarDadosCompletos };

/**
 * Valida o Fingerprint do dispositivo no Cloudflare
 */
export async function validarDispositivoService(payload) {
    try {
        const response = await fetch(`${SECURITY_URL}/validate-hardware`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        return { sucesso: false, mensagem: "Erro de conexão segura." };
    }
}

export async function getSelic() {
    try {
        const res = await fetch('https://gdis-api-service.jeanmarcel-vs.workers.dev/selic');
        const data = await res.json();
        return parseFloat(data[0].valor);
    } catch (e) {
        return 11.25;
    }
}