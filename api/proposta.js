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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
            console.error('Erro 400: projectId é obrigatório e não foi encontrado na requisição.');
            res.status(400).json({ error: 'ID do projeto é obrigatório.' });
            return;
        }

        // Verifica se o token de acesso está definido
        if (!longLivedToken) {
            console.error('Erro 401: Variável de ambiente SOLARMARKET_TOKEN não foi configurada.');
            res.status(401).json({ error: 'Erro de autenticação: token da API não encontrado.' });
            return;
        }
        
        // Remove espaços em branco antes e depois do token para evitar erros de autenticação.
        const trimmedToken = longLivedToken.trim();

        // ======================================================================
        // CÓDIGO DE DEBUG ADICIONADO PARA O SUPORTE
        // Imprime o comprimento do token para verificação.
        console.log(`Debug: Comprimento do Long-Lived Token: ${trimmedToken.length}`);
        // Imprime a URL completa da API para verificação.
        const apiUrl = `${SOLARMARKET_API_URL}/projects/${projectId}/proposals`;
        console.log(`Debug: Chamando a URL da API: ${apiUrl}`);
        // ======================================================================
        
        // ######################################################################
        // 3. OBTÉM O TOKEN TEMPORÁRIO ANTES DE CHAMAR A API DE PROPOSTA
        // ######################################################################
        console.log('Debug: Tentando obter o token de acesso temporário...');
        const accessToken = await getAccessToken(trimmedToken, SOLARMARKET_API_URL);
        console.log('Debug: Token temporário obtido com sucesso.');
        
        // ######################################################################
        // 4. CHAMA A API DA SOLARMARKET COM O 'projectId'
        // ######################################################################
        // Usa o token "limpo" (sem espaços) no cabeçalho de autorização.
        const propostaResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${accessToken}` // Usa o token temporário
            }
        });
        
        if (!propostaResponse.ok) {
            const propostaErrorText = await propostaResponse.text();
            throw new Error(`Erro ao consultar proposta: ${propostaResponse.status} - ${propostaErrorText}`);
        }

        const propostasData = await propostaResponse.json();
        const propostaAtiva = propostasData && propostasData.length > 0 ? propostasData[0] : null;

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
