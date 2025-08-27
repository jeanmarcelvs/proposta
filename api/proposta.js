/**
 * Arquivo: api/proposta.js
 * Vercel Serverless Function para consultar a API da SolarMarket.
 * Usa node-fetch com a URL correta para obter a proposta.
 */
const fetch = require('node-fetch');

// Função para obter um token de acesso de curta duração, embutida para garantir compatibilidade.
async function getAccessToken(longLivedToken, apiUrl) {
    const authUrl = `${apiUrl}/auth/signin`;
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
    return authData.access_token;
}

module.exports = async (req, res) => {
    // Configurações de cabeçalho para permitir a comunicação com seu site.
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Use GET.' });
    }

    const { projectId } = req.query;
    if (!projectId) {
        return res.status(400).json({ error: 'Parâmetro projectId é obrigatório.' });
    }

    const longLivedToken = process.env.SOLARMARKET_TOKEN;
    const SOLARMARKET_API_URL = 'https://business.solarmarket.com.br/api/v2';

    try {
        const accessToken = await getAccessToken(longLivedToken, SOLARMARKET_API_URL);
        const propostaUrl = `${SOLARMARKET_API_URL}/projects/${projectId}/proposals`;
        
        const propostaResponse = await fetch(propostaUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!propostaResponse.ok) {
            const propostaErrorText = await propostaResponse.text();
            throw new Error(`Erro ao consultar proposta: ${propostaResponse.status} - ${propostaErrorText}`);
        }

        const propostasData = await propostaResponse.json();
        
        // CORREÇÃO: Envie o objeto completo diretamente, pois a API já retorna o objeto da proposta.
        if (propostasData) {
            res.status(200).json(propostasData);
        } else {
            res.status(404).json({ error: 'Proposta não encontrada para o projeto especificado.' });
        }
    } catch (err) {
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};