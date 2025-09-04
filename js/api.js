// A URL base agora é a do seu Worker, não mais a API externa.
const WORKER_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev';

// As funções agora são simples wrappers para chamar o seu Worker
export async function get(endpoint) {
    const response = await fetch(`${WORKER_URL}/solarmarket${endpoint}`);
    if (!response.ok) {
        throw new Error(`Erro na requisição GET para ${endpoint}: ${response.statusText}`);
    }
    return await response.json();
}

export async function post(endpoint, dados) {
    const response = await fetch(`${WORKER_URL}/solarmarket${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });
    if (!response.ok) {
        throw new Error(`Erro na requisição POST para ${endpoint}: ${response.statusText}`);
    }
    return await response.json();
}

export async function patch(endpoint, dados) {
    const response = await fetch(`${WORKER_URL}/solarmarket${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });
    if (!response.ok) {
        throw new Error(`Erro na requisição PATCH para ${endpoint}: ${response.statusText}`);
    }
    return await response.json();
}

export async function getSelicTaxa() {
    const response = await fetch(`${WORKER_URL}/selic`);
    if (!response.ok) {
        throw new Error('Falha ao buscar a taxa Selic via Worker.');
    }
    const dados = await response.json();
    return parseFloat(dados[0].valor);
}