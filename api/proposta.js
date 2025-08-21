// Este código atualiza a sua função serverless para buscar propostas
// usando o CPF do cliente, em vez do ID do projeto.

// Importa a biblioteca 'node-fetch' para fazer requisições HTTP
const fetch = require('node-fetch');

// Handler da função serverless, exportado para ser usado pelo Vercel
module.exports = async (req, res) => {
    // Adiciona cabeçalhos CORS para permitir requisições de qualquer origem
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Lida com requisições OPTIONS (pré-voo do CORS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Extrai o 'cpf' dos parâmetros da query (ex: /api/proposta?cpf=12345678900)
    const { cpf } = req.query;

    // URL base da API da SolarMarket
    const apiUrlBase = 'https://business.solarmarket.com.br/api/v2';
    
    // URL CORRETA DA API DE AUTENTICAÇÃO da SolarMarket
    const authApiUrl = `${apiUrlBase}/auth/signin`;

    // Pega o token de autenticação de longa duração da variável de ambiente do Vercel
    const longLivedToken = process.env.SOLARMARKET_TOKEN;

    // Validação básica para garantir que o 'cpf' e o token existam
    if (!cpf) {
        return res.status(400).json({ message: 'Missing cpf parameter' });
    }
    if (!longLivedToken) {
        return res.status(500).json({ message: 'Missing API token. Please configure SOLARMARKET_TOKEN environment variable.' });
    }

    try {
        // PASSO 1: Obter um token de acesso temporário fazendo uma requisição POST
        const authRes = await fetch(authApiUrl, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                token: longLivedToken // Envia o token de longa duração no corpo da requisição
            })
        });

        if (!authRes.ok) {
            const errorText = await authRes.text();
            throw new Error(`Erro de Autenticação: ${authRes.status} - ${errorText}`);
        }

        const authData = await authRes.json();
        const accessToken = authData.token; 

        // PASSO 2: Usar o token de acesso para buscar o cliente pelo CPF
        const clientUrl = `${apiUrlBase}/clients?cnpjCpf=${cpf}`;
        const clientRes = await fetch(clientUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'accept': 'application/json'
            }
        });

        if (!clientRes.ok) {
            const errorText = await clientRes.text();
            throw new Error(`Erro ao buscar cliente: ${clientRes.status} - ${errorText}`);
        }

        const clientData = await clientRes.json();
        // A API retorna um array, pegamos o primeiro cliente encontrado
        const client = clientData[0]; 

        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado com o CPF informado.' });
        }

        // PASSO 3: Usar o ID do cliente para buscar um projeto
        const projectsUrl = `${apiUrlBase}/projects?clientId=${client.id}`;
        const projectsRes = await fetch(projectsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'accept': 'application/json'
            }
        });

        if (!projectsRes.ok) {
            const errorText = await projectsRes.text();
            throw new Error(`Erro ao buscar projetos: ${projectsRes.status} - ${errorText}`);
        }

        const projectsData = await projectsRes.json();
        // A API retorna um array, pegamos o primeiro projeto encontrado
        const project = projectsData[0];

        if (!project) {
            return res.status(404).json({ message: 'Nenhum projeto encontrado para este cliente.' });
        }

        // PASSO 4: Usar o ID do projeto para buscar a proposta ativa
        const proposalsUrl = `${apiUrlBase}/projects/${project.id}/proposals`;
        const proposalsRes = await fetch(proposalsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'accept': 'application/json'
            }
        });

        if (!proposalsRes.ok) {
            const errorText = await proposalsRes.text();
            throw new Error(`Erro ao buscar propostas: ${proposalsRes.status} - ${errorText}`);
        }

        const proposalsData = await proposalsRes.json();
        // A API de propostas pode retornar um array. A sua lógica original pegava o primeiro.
        const proposal = proposalsData[0];
        
        if (!proposal) {
            return res.status(404).json({ message: 'Nenhuma proposta ativa encontrada para este projeto.' });
        }

        // PASSO 5: Retornar a proposta encontrada
        return res.status(200).json(proposal);

    } catch (err) {
        console.error("Erro na função serverless:", err);
        return res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};
