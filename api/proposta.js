// O código abaixo é a correção para a sua função serverless no Vercel.
// Ele resolve o erro 401 Unauthorized adicionando o token de autenticação
// ao cabeçalho da requisição.

// Importa a biblioteca 'node-fetch' para fazer requisições HTTP
const fetch = require('node-fetch');

// Handler da função serverless, exportado para ser usado pelo Vercel
module.exports = async (req, res) => {
    // Extrai o 'projectId' dos parâmetros da query (ex: /api/proposta?projectId=123)
    const { projectId } = req.query;

    // URL da API externa da SolarMarket
    const solarMarketApiUrl = `https://api.solarmarket.com/propostas?projectId=${projectId}`; // Exemplo de URL da API externa

    // Pega o token de autenticação da variável de ambiente do Vercel
    // O nome da variável foi confirmado como 'SOLARMARKET_TOKEN'
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
                'Authorization': `Bearer ${token}`, // AQUI ESTÁ A CORREÇÃO. O token é adicionado ao cabeçalho de autorização.
                'Content-Type': 'application/json'
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
