/**
 * Arquivo: api/proposta.js
 * Esta é uma Vercel Serverless Function que roda no backend.
 * Ela consulta a API da SolarMarket para obter propostas de projetos.
 */
const fetch = require('node-fetch');
const { getAccessToken } = require('./auth'); // O caminho foi ajustado e usa require()

module.exports = async (req, res) => {
    // Define os cabeçalhos para resposta JSON e CORS
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manipula a requisição OPTIONS para preflight CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Garante que apenas o método GET seja permitido
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Use GET.' });
    }

    // ######################################################################
    // 2. EXTRAI O PROJECT ID DA URL DA REQUISIÇÃO
    // ######################################################################
    const { projectId } = req.query;

    if (!projectId) {
        return res.status(400).json({ error: 'Parâmetro projectId é obrigatório.' });
    }

    // Dados de configuração
    const longLivedToken = process.env.SOLARMARKET_TOKEN;
    const SOLARMARKET_API_URL = 'https://business.solarmarket.com.br/api/v2';

    try {
        // ######################################################################
        // 3. OBTÉM O TOKEN DE ACESSO
        // ######################################################################
        const accessToken = await getAccessToken(longLivedToken, SOLARMARKET_API_URL);

        // ######################################################################
        // 4. CONSULTA A PROPOSTA NA API DA SOLARMARKET
        // ######################################################################
        const propostaUrl = `${SOLARMARKET_API_URL}/proposals?projectId=${projectId}`;
        const propostaResponse = await fetch(propostaUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        // Trata a resposta da API, incluindo erros comuns como 404
        if (!propostaResponse.ok) {
            const propostaErrorText = await propostaResponse.text();
            throw new Error(`Erro ao consultar proposta: ${propostaResponse.status} - ${propostaErrorText}`);
        }

        const propostasData = await propostaResponse.json();
        console.log('Dados recebidos da API:', JSON.stringify(propostasData, null, 2));
        
        // CORREÇÃO:
        // A API retorna um objeto com uma propriedade 'data' que contém a proposta.
        // Acessamos o valor dessa propriedade de forma segura e o enviamos diretamente.
        if (propostasData && propostasData.data) {
            // ######################################################################
            // 5. RETORNA OS DADOS DA PROPOSTA PARA O FRONT-END
            // ######################################################################
            console.log('Debug: Enviando dados da proposta para o frontend...');
            res.status(200).json(propostasData.data);
        } else {
            console.log(`Proposta não encontrada para o Project ID: ${projectId}`);
            res.status(404).json({ error: 'Proposta não encontrada para o projeto especificado.' });
            return;
        }

    } catch (err) {
        // Este bloco de captura garante que todos os erros sejam tratados.
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};