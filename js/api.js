// A URL base agora é a do seu Worker, não mais a API externa.
const WORKER_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev/erp';
const SECURITY_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev/security';

// Função para obter os headers dinamicamente, incluindo o token de autenticação se disponível.
function getHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    const token = localStorage.getItem('authToken');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// NOVO: Busca proposta por ID e valida com o primeiro nome do cliente (Camada de Segurança)
export async function buscarPropostaPorIdENome(propostaId, primeiroNome) {
    try {
        const response = await fetch(`${SECURITY_URL}/find-proposta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propostaId, primeiroNome })
        });

        if (!response.ok) {
            // Tenta ler a mensagem de erro do servidor (JSON) ou retorna erro genérico
            try {
                const errData = await response.json();
                return { sucesso: false, erro: errData.erro || `Erro ${response.status}: Proposta não encontrada.` };
            } catch (e) {
                return { sucesso: false, erro: `Erro de conexão (${response.status}). Verifique o ID informado.` };
            }
        }

        return await response.json();
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

// NOVO: Função especializada para buscar a árvore de dados completa para a proposta
// Isso substitui as múltiplas chamadas e a lógica de proxy antiga
export async function buscarDadosCompletos(projetoId) {
    try {
        // 1. Busca o Projeto
        const resProjeto = await fetch(`${WORKER_URL}/projetos/${projetoId}`, { headers: getHeaders() });
        if (!resProjeto.ok) throw new Error('Projeto não encontrado');
        const projeto = await resProjeto.json();

        // 2. Identifica a Proposta Ativa (Lógica de Negócio)
        // Busca propostas do projeto
        const resPropostas = await fetch(`${WORKER_URL}/propostas?projetoId=${projetoId}`, { headers: getHeaders() });
        const propostas = await resPropostas.json();
        
        // Pega a última proposta criada ou a que estiver vendida
        let propostaAtiva = null;
        if (Array.isArray(propostas) && propostas.length > 0) {
             propostaAtiva = propostas.find(p => p.status === 'VENDIDA') || propostas.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao))[0];
        }

        if (!propostaAtiva) throw new Error('Nenhuma proposta encontrada para este projeto');

        // 3. Busca o Cliente
        const resCliente = await fetch(`${WORKER_URL}/clientes/${projeto.clienteId}`, { headers: getHeaders() });
        const cliente = await resCliente.json();

        return {
            sucesso: true,
            dados: {
                projeto,
                proposta: propostaAtiva,
                cliente
            }
        };
    } catch (error) {
        console.error("Erro ao buscar dados completos:", error);
        return { sucesso: false, mensagem: error.message };
    }
}

// As funções agora são simples wrappers para chamar o seu Worker
export async function get(endpoint) {
    try {
        const fullUrl = `${WORKER_URL}${endpoint}`;
        
        const response = await fetch(fullUrl, { headers: getHeaders() });

        if (!response.ok) {
            // Se a resposta não for OK, logamos o erro e o corpo da resposta, se possível.
            const errorBody = await response.text();
            console.error(`Erro na requisição GET para ${endpoint}: ${response.status}. Corpo:`, errorBody);
            if (response.status === 401) {
                window.location.href = 'index.html?erro=acesso-negado';
                return { sucesso: false, dados: null, mensagem: 'Não autorizado. Redirecionando para login.' };
            }
            return { sucesso: false, dados: null, mensagem: `Erro na API: ${response.statusText}` };
        }

        const dados = await response.json();
        
        return { sucesso: true, dados: dados };

    } catch (error) {
        return { sucesso: false, dados: null, mensagem: 'Erro na requisição GET.' };
    }
}

export async function post(endpoint, dados) {
    try {
        const fullUrl = `${WORKER_URL}${endpoint}`;
        
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(dados)
        });

        // Ponto de depuração: Logando o status e o texto do status da resposta

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Erro na requisição POST para ${endpoint}: ${response.status}. Corpo:`, errorBody);
            if (response.status === 401) {
                window.location.href = 'index.html?erro=acesso-negado';
                throw new Error('Não autorizado. Redirecionando para login.');
            }
            throw new Error(`Erro na requisição POST para ${endpoint}: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        return responseData;
    } catch (error) {
        throw error;
    }
}

export async function patch(endpoint, dados) {
    try {
        const fullUrl = `${WORKER_URL}${endpoint}`;
        
        const response = await fetch(fullUrl, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(dados)
        });

        // Ponto de depuração: Logando o status e o texto do status da resposta

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Erro na requisição PATCH para ${endpoint}: ${response.status}. Corpo:`, errorBody);
            if (response.status === 401) {
                window.location.href = 'index.html?erro=acesso-negado';
                return { sucesso: false, mensagem: 'Não autorizado. Redirecionando para login.' };
            }
            return { sucesso: false, mensagem: `Erro na API: ${response.statusText}` };
        }
        
        const responseData = await response.json();
        return { sucesso: true, dados: responseData };
        
    } catch (error) {
        return { sucesso: false, mensagem: 'Ocorreu um erro ao tentar atualizar o status de visualização.' };
    }
}

export async function getSelicTaxa() {
    try {
        const fullUrl = `https://gdis-api-service.jeanmarcel-vs.workers.dev/selic`;
        
        // A rota da Selic é pública, não precisa enviar o token de autenticação.
        const response = await fetch(fullUrl, { headers: {
            'Content-Type': 'application/json'
        } });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Falha ao buscar a taxa Selic: ${response.status}. Corpo:`, errorBody);
            if (response.status === 401) {
                window.location.href = 'index.html?erro=acesso-negado';
                return null;
            }
            return null;
        }

        const dados = await response.json();
        
        return parseFloat(dados[0].valor);
    } catch (error) {
        return null;
    }
}

/**
 * NOVO: Validação de Hardware (Fingerprint)
 * Esta função chama a rota específica de segurança que criamos no Worker.
 */
export async function validarDispositivoHardware(dadosDispositivo) {
    try {
        const fullUrl = `${SECURITY_URL}/validate-hardware`;
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(dadosDispositivo)
        });

        return await response.json();
    } catch (error) {
        console.error("Falha na conexão de segurança:", error);
        return { sucesso: false, erro: "Falha na conexão de segurança." };
    }
}