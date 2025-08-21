// O código abaixo é a correção para a sua função serverless no Vercel.
// Ele implementa a lógica de geração de tokens temporários, seguindo a documentação da API.

// Importa a biblioteca 'node-fetch' para fazer requisições HTTP
const fetch = require('node-fetch');

// Handler da função serverless, exportado para ser usado pelo Vercel
module.exports = async (req, res) => {
    // Extrai o 'projectId' dos parâmetros da query (ex: /api/proposta?projectId=123)
    const { projectId } = req.query;

    // URL da API externa da SolarMarket para propostas.
    const solarMarketApiUrl = `https://business.solarmarket.com.br/api/v2/projects/${projectId}/proposals`;
    
    // URL CORRETA DA API DE AUTENTICAÇÃO da SolarMarket
    const authApiUrl = `https://business.solarmarket.com.br/api/v2/auth/signin`;

    // Pega o token de autenticação de longa duração da variável de ambiente do Vercel
    const longLivedToken = process.env.SOLARMARKET_TOKEN;

    // Validação básica para garantir que o 'projectId' e o token existam
    if (!projectId) {
        return res.status(400).json({ message: 'Missing projectId parameter' });
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

        // Verifica se a requisição de autenticação foi bem-sucedida
        if (!authRes.ok) {
            const errorText = await authRes.text();
            throw new Error(`Erro de Autenticação: ${authRes.status} - ${errorText}`);
        }

        const authData = await authRes.json();
        // A documentação indica que a resposta de autenticação contém um novo token de acesso
        const accessToken = authData.token; 

        // PASSO 2: Usar o novo token de acesso para a requisição de propostas
        const apiRes = await fetch(solarMarketApiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`, // Usa o token de acesso temporário
                'accept': 'application/json'
            }
        });

        // Verifica se a resposta da API de propostas foi bem-sucedida
        if (!apiRes.ok) {
            const errorText = await apiRes.text();
            throw new Error(`Erro HTTP: ${apiRes.status} - ${errorText}`);
        }

        const data = await apiRes.json();
        
        // Retorna os dados da API para o cliente
        return res.status(200).json(data);

    } catch (err) {
        console.error("Erro na função serverless:", err);
        return res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};
