// A URL base agora é a do seu Worker, não mais a API externa.
const WORKER_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev';

// As funções agora são simples wrappers para chamar o seu Worker
export async function get(endpoint) {
    try {
        const fullUrl = `${WORKER_URL}/solarmarket${endpoint}`;
        
        const response = await fetch(fullUrl);

        if (!response.ok) {
            // Se a resposta não for OK, logamos o erro e o corpo da resposta, se possível.
            const errorBody = await response.text();
            console.error(`Erro na requisição GET para ${endpoint}: ${response.statusText}. Corpo da resposta de erro:`, errorBody);
            return { sucesso: false, dados: null, mensagem: `Erro na API: ${response.statusText}` };
        }

        const dados = await response.json();
        
        return { sucesso: true, dados: dados };

    } catch (error) {
        console.error('DEBUG: Erro na requisição GET (catch):', error);
        return { sucesso: false, dados: null, mensagem: 'Erro na requisição GET.' };
    }
}

export async function post(endpoint, dados) {
    try {
        const fullUrl = `${WORKER_URL}/solarmarket${endpoint}`;
        
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        // Ponto de depuração: Logando o status e o texto do status da resposta

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Erro na requisição POST para ${endpoint}: ${response.statusText}. Corpo da resposta de erro:`, errorBody);
            throw new Error(`Erro na requisição POST para ${endpoint}: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('DEBUG: Erro na requisição POST (catch):', error);
        throw error;
    }
}

export async function patch(endpoint, dados) {
    try {
        const fullUrl = `${WORKER_URL}/solarmarket${endpoint}`;
        
        const response = await fetch(fullUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        // Ponto de depuração: Logando o status e o texto do status da resposta

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Erro na requisição PATCH para ${endpoint}: ${response.statusText}. Corpo da resposta de erro:`, errorBody);
            return { sucesso: false, mensagem: `Erro na API: ${response.statusText}` };
        }
        
        const responseData = await response.json();
        return { sucesso: true, dados: responseData };
        
    } catch (error) {
        console.error('DEBUG: Erro na requisição PATCH (catch):', error);
        return { sucesso: false, mensagem: 'Ocorreu um erro ao tentar atualizar o status de visualização.' };
    }
}

export async function getSelicTaxa() {
    try {
        const fullUrl = `${WORKER_URL}/selic`;
        
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Falha ao buscar a taxa Selic. Corpo da resposta de erro:`, errorBody);
            return null;
        }
        
        const dados = await response.json();
        
        return parseFloat(dados[0].valor);
    } catch (error) {
        console.error('DEBUG: Erro na requisição GET (Selic):', error);
        return null;
    }
}