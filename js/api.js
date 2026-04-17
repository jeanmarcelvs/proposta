const WORKER_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev/erp';
const SECURITY_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev/security';

function getHeaders() {
    return { 'Content-Type': 'application/json' };
}

/**
 * Busca os dados da proposta no Worker
 * Ajustado para enviar 'idAlvo' e 'primeiroNome' conforme o seu Worker espera
 */
async function buscarPropostaService(propostaId, primeiroNome) {
    try {
        const response = await fetch(`${SECURITY_URL}/find-proposta`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ propostaId, primeiroNome }) // Sincronizado com a expectativa do Worker
        });
        if (!response.ok) return { sucesso: false };
        return await response.json();
    } catch (error) {
        console.error("Erro na busca da proposta:", error);
        return { sucesso: false, erro: error.message };
    }
}

/**
 * Valida o Fingerprint do dispositivo no Cloudflare
 */
async function validarDispositivoService(payload) {
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

async function getSelic() {
    try {
        const res = await fetch('https://gdis-api-service.jeanmarcel-vs.workers.dev/selic');
        const data = await res.json();
        return parseFloat(data[0].valor);
    } catch (e) {
        return 11.25;
    }
}

/**
 * EXPORTAÇÃO ÚNICA E LIMPA
 * Resolve o SyntaxError: não pode haver export const e export {} com o mesmo nome.
 */
export { 
    buscarPropostaService, 
    validarDispositivoService,
    getSelic,
    buscarPropostaService as buscarDadosCompletos // Apelido para compatibilidade
};