// Este é o código corrigido para a sua função serverless no Vercel.
// Ele remove a lógica de autenticação de duas etapas que estava causando o erro 404,
// e volta para a autenticação direta, que é a mais provável de funcionar.

// Importa a biblioteca 'node-fetch' para fazer requisições HTTP
const fetch = require('node-fetch');

// Handler da função serverless, exportado para ser usado pelo Vercel
module.exports = async (req, res) => {
    // Extrai o 'projectId' dos parâmetros da query (ex: /api/proposta?projectId=123)
    const { projectId } = req.query;

    // URL da API externa da SolarMarket para propostas. Esta URL está correta.
    const solarMarketApiUrl = `https://business.solarmarket.com.br/api/v2/projects/${projectId}/proposals`;

    // Pega o token de autenticação da variável de ambiente do Vercel
    const token = process.env.SOLARMARKET_TOKEN;

    // Validação básica para garantir que o 'projectId' e o 'token' existem
    if (!projectId) {
        return res.status(400).json({ message: 'Missing projectId parameter' });
    }
    if (!token) {
        return res.status(500).json({ message: 'Missing API token. Please configure SOLARMARKET_TOKEN environment variable.' });
    }

    try {
        // Faz a requisição para a API da SolarMarket, incluindo o token no cabeçalho
        const apiRes = await fetch(solarMarketApiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`, // AQUI O TOKEN É USADO DIRETAMENTE
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        // Verifica se a resposta da API foi bem-sucedida (status 200-299)
        if (!apiRes.ok) {
            // Se a API externa retornar um erro, repassa esse erro
            const errorText = await apiRes.text();
            throw new Error(`Erro HTTP: ${apiRes.status} - ${errorText}`);
        }

        // Converte a resposta da API para JSON
        const data = await apiRes.json();
        
        // Retorna os dados da API para o cliente (o seu index.html)
        return res.status(200).json(data);

    } catch (err) {
        console.error("Erro na função serverless:", err);
        // Em caso de erro, retorna uma resposta de erro para o cliente
        return res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};
