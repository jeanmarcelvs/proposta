// A URL base agora é a do seu Worker, não mais a API externa.
const WORKER_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev';

// As funções agora são simples wrappers para chamar o seu Worker
export async function get(endpoint) {
    try {
        const fullUrl = `${WORKER_URL}/solarmarket${endpoint}`;
        
        // Ponto de depuração: Logando a URL completa da requisição
        console.log('DEBUG: Requisição GET para:', fullUrl);
        
        const response = await fetch(fullUrl);

        // Ponto de depuração: Logando a resposta HTTP completa
        console.log('DEBUG: Resposta completa da API:', response);
        
        // Ponto de depuração: Logando o status e o texto do status da resposta
        console.log(`DEBUG: Status da Resposta: ${response.status} - ${response.statusText}`);

        if (!response.ok) {
            // Se a resposta não for OK, logamos o erro e o corpo da resposta, se possível.
            const errorBody = await response.text();
            console.error(`DEBUG: Erro na requisição GET para ${endpoint}: ${response.statusText}. Corpo da resposta de erro:`, errorBody);
            return { sucesso: false, dados: null, mensagem: `Erro na API: ${response.statusText}` };
        }

        const dados = await response.json();
        // Ponto de depuração: Logando os dados JSON recebidos
        console.log('DEBUG: Dados JSON recebidos:', dados);
        
        return { sucesso: true, dados: dados };

    } catch (error) {
        console.error('DEBUG: Erro na requisição GET (catch):', error);
        return { sucesso: false, dados: null, mensagem: 'Erro na requisição GET.' };
    }
}

export async function post(endpoint, dados) {
    try {
        const fullUrl = `${WORKER_URL}/solarmarket${endpoint}`;
        
        // Ponto de depuração: Logando a URL e os dados do POST
        console.log('DEBUG: Requisição POST para:', fullUrl);
        console.log('DEBUG: Dados enviados no corpo do POST:', dados);
        
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        // Ponto de depuração: Logando o status e o texto do status da resposta
        console.log(`DEBUG: Status da Resposta POST: ${response.status} - ${response.statusText}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`DEBUG: Erro na requisição POST para ${endpoint}: ${response.statusText}. Corpo da resposta de erro:`, errorBody);
            throw new Error(`Erro na requisição POST para ${endpoint}: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('DEBUG: Dados JSON de retorno do POST:', responseData);
        return responseData;
    } catch (error) {
        console.error('DEBUG: Erro na requisição POST (catch):', error);
        throw error;
    }
}

export async function patch(endpoint, dados) {
    try {
        const fullUrl = `${WORKER_URL}/solarmarket${endpoint}`;
        
        // Ponto de depuração: Logando a URL e os dados do PATCH
        console.log('DEBUG: Requisição PATCH para:', fullUrl);
        console.log('DEBUG: Dados enviados no corpo do PATCH:', dados);
        
        const response = await fetch(fullUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        // Ponto de depuração: Logando o status e o texto do status da resposta
        console.log(`DEBUG: Status da Resposta PATCH: ${response.status} - ${response.statusText}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`DEBUG: Erro na requisição PATCH para ${endpoint}: ${response.statusText}. Corpo da resposta de erro:`, errorBody);
            return { sucesso: false, mensagem: `Erro na API: ${response.statusText}` };
        }
        
        const responseData = await response.json();
        console.log('DEBUG: Dados JSON de retorno do PATCH:', responseData);
        return { sucesso: true, dados: responseData };
        
    } catch (error) {
        console.error('DEBUG: Erro na requisição PATCH (catch):', error);
        return { sucesso: false, mensagem: 'Ocorreu um erro ao tentar atualizar o status de visualização.' };
    }
}

export async function getSelicTaxa() {
    try {
        const fullUrl = `${WORKER_URL}/selic`;
        
        // Ponto de depuração: Logando a URL da requisição Selic
        console.log('DEBUG: Requisição GET para Selic em:', fullUrl);

        const response = await fetch(fullUrl);
        
        // Ponto de depuração: Logando o status e o texto do status da resposta
        console.log(`DEBUG: Status da Resposta SELIC: ${response.status} - ${response.statusText}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`DEBUG: Falha ao buscar a taxa Selic. Corpo da resposta de erro:`, errorBody);
            return null;
        }
        
        const dados = await response.json();
        // Ponto de depuração: Logando os dados JSON da Selic
        console.log('DEBUG: Dados JSON da Selic recebidos:', dados);
        
        return parseFloat(dados[0].valor);
    } catch (error) {
        console.error('DEBUG: Erro na requisição GET (Selic):', error);
        return null;
    }
}