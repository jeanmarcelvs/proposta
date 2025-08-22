/**
 * Arquivo: api/proposta.js
 * Esta é uma Vercel Serverless Function que roda no backend.
 * Ela consulta a API da SolarMarket para obter propostas de projetos.
 */
const fetch = require('node-fetch');

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
            res.status(400).json({ error: 'ID do projeto é obrigatório.' });
            return;
        }

        // ======================================================================
        // CÓDIGO DE DEBUG ADICIONADO PARA O SUPORTE
        // Imprime o token de acesso para verificação.
        console.log(`Debug: Usando o Token de Acesso: ${longLivedToken ? 'Token recebido com sucesso.' : 'Token ausente!'}`);
        // Imprime a URL completa da API para verificação.
        const apiUrl = `${SOLARMARKET_API_URL}/projects/${projectId}/proposals`;
        console.log(`Debug: Chamando a URL da API: ${apiUrl}`);
        // ======================================================================

        // ######################################################################
        // 2. CHAMA A API DA SOLARMARKET COM O 'projectId'
        // ######################################################################
        const propostaResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${longLivedToken}`
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
