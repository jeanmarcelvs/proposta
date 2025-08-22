/**
 * Arquivo: api/proposta.js
 * Esta é uma Vercel Serverless Function que roda no backend.
 * Ela consulta a API da SolarMarket para obter propostas de projetos.
 */
const fetch = require('node-fetch');

// ######################################################################
// 1. FUNÇÃO PARA OBTER O TOKEN DE ACESSO
// ######################################################################
async function getAccessToken(longLivedToken, apiUrl) {
    const authUrl = `${apiUrl}/auth/signin`;
    
    // A coleção do Postman mostra que a autenticação usa POST com um corpo JSON.
    const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ token: longLivedToken })
    });

    if (!authResponse.ok) {
        const errorText = await authResponse.text();
        throw new Error(`Erro ao obter token de acesso: ${authResponse.status} - ${errorText}`);
    }

    const authData = await authResponse.json();
    // A resposta contém o token de acesso.
    return authData.access_token;
}

module.exports = async (req, res) => {
    // Define os cabeçalhos para resposta JSON e CORS
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Lida com as requisições OPTIONS de preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // ######################################################################
    // 2. OBTÉM AS CREDENCIAIS E VALIDAÇÃO INICIAL
    // ######################################################################
    const longLivedToken = process.env.SOLARMARKET_TOKEN;
    const SOLARMARKET_API_URL = 'https://business.solarmarket.com.br/api/v2';
    
    // Agora a função espera um 'projectId' na requisição.
    const { projectId } = req.query;

    try {
        // Verifica se o projectId foi fornecido
        if (!projectId) {
            console.error('Erro 400: projectId é obrigatório.');
            res.status(400).json({ error: 'projectId é obrigatório.' });
            return;
        }

        // 3. Obtém o token de acesso temporário
        const accessToken = await getAccessToken(longLivedToken, SOLARMARKET_API_URL);
        console.log('Debug: Token temporário obtido com sucesso.');

        // ######################################################################
        // 4. CONSULTA A API DA SOLARMARKET PARA A PROPOSTA
        // ######################################################################
        const apiUrl = `${SOLARMARKET_API_URL}/projects/${projectId}/proposals`;
        console.log(`Debug: Chamando a URL da API: ${apiUrl}`);

        const propostaResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!propostaResponse.ok) {
            const propostaErrorText = await propostaResponse.text();
            throw new Error(`Erro ao consultar proposta: ${propostaResponse.status} - ${propostaErrorText}`);
        }

        const propostasData = await propostaResponse.json();
        console.log('Dados recebidos da API:', JSON.stringify(propostasData, null, 2));
        
        // CORREÇÃO FINAL:
        // O log mostra que o objeto retornado contém uma propriedade 'data' que é a proposta em si,
        // e não um array. Esta linha corrige a lógica para pegar o objeto diretamente.
        const propostaAtiva = propostasData && propostasData.data ? propostasData.data : null;

        if (!propostaAtiva) {
            console.log(`Proposta não encontrada para o Project ID: ${projectId}`);
            res.status(404).json({ error: 'Proposta não encontrada para o projeto especificado.' });
            return;
        }

        // ######################################################################
        // 5. RETORNA OS DADOS DA PROPOSTA PARA O FRONT-END
        // ######################################################################
        res.status(200).json(propostaAtiva);

    } catch (err) {
        // Este bloco de captura garante que todos os erros sejam tratados.
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};
