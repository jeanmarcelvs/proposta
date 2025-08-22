/**
 * Arquivo: api/proposta.js
 * Esta é uma Vercel Serverless Function que roda no backend.
 * Ela consulta a API da SolarMarket para obter propostas de projetos.
 */
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
    // 1. OBTÉM AS CREDENCIAIS E VALIDAÇÃO INICIAL
    // ######################################################################
    const longLivedToken = process.env.SOLARMARKET_TOKEN;
    const SOLARMARKET_API_URL = 'https://business.solarmarket.com.br/api/v2';
    
    // Agora a função espera um 'projectId' na requisição.
    const { projectId } = req.query;

    try {
        // Verifica se o projectId foi fornecido
        if (!projectId) {
            console.error('Erro 400: projectId é obrigatório e não foi encontrado na requisição.');
            res.status(400).json({ error: 'Erro de requisição: O ID do projeto é obrigatório.' });
            return;
        }

        if (!longLivedToken) {
            console.error('Erro 500: Variável de ambiente SOLARMARKET_TOKEN não está definida.');
            res.status(500).json({ error: 'Erro de configuração: A variável de ambiente SOLARMARKET_TOKEN não está definida.' });
            return;
        }

        // ######################################################################
        // 2. GERA UM NOVO TOKEN DE ACESSO TEMPORÁRIO
        // ######################################################################
        const authResponse = await fetch(`${SOLARMARKET_API_URL}/auth/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: longLivedToken })
        });
        
        if (!authResponse.ok) {
            const authErrorText = await authResponse.text();
            throw new Error(`Erro de Autenticação: ${authResponse.status} - ${authErrorText}`);
        }

        const authData = await authResponse.json();
        const accessToken = authData.access_token; 

        if (!accessToken) {
             throw new Error("Erro de Autenticação: O token de acesso não foi encontrado na resposta.");
        }

        // ######################################################################
        // 3. USA O TOKEN TEMPORÁRIO PARA FAZER A CONSULTA DA PROPOSTA
        // ######################################################################
        const propostaResponse = await fetch(`${SOLARMARKET_API_URL}/projects/${projectId}/proposals`, {
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
        const propostaAtiva = propostasData && propostasData.length > 0 ? propostasData[0] : null;

        if (!propostaAtiva) {
            console.log(`Proposta não encontrada para o Project ID: ${projectId}`);
            res.status(404).json({ error: 'Proposta não encontrada para o projeto especificado.' });
            return;
        }

        // ######################################################################
        // 4. RETORNA OS DADOS DA PROPOSTA PARA O FRONT-END
        // ######################################################################
        res.status(200).json(propostaAtiva);

    } catch (err) {
        // Este bloco de captura garante que todos os erros sejam tratados.
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};
