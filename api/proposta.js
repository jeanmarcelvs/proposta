const fetch = require('node-fetch');

// Função de autenticação "detetive"
async function getAccessToken(longLivedToken, apiUrl) {
    console.log('DEBUG: Tentando obter token de acesso...');
    console.log('DEBUG: Token sendo usado (parcial):', longLivedToken ? longLivedToken.substring(0, 10) + '...' : 'TOKEN NÃO DEFINIDO');

    const authUrl = `${apiUrl}/auth/signin`;
    
    try {
        const authResponse = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({ token: longLivedToken })
        });

        // Loga a resposta completa da API para debug
        console.log('DEBUG: Resposta da autenticação da API - Status:', authResponse.status);
        const authData = await authResponse.json();
        console.log('DEBUG: Corpo da resposta da autenticação:', JSON.stringify(authData, null, 2));

        if (!authResponse.ok) {
            throw new Error(`Erro ao obter token de acesso: ${authResponse.status} - ${JSON.stringify(authData)}`);
        }

        return authData.access_token;
    } catch (err) {
        console.error('ERRO CRÍTICO NA AUTENTICAÇÃO:', err.message);
        throw err;
    }
}

module.exports = async (req, res) => {
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

        const propostaUrl = `${SOLARMARKET_API_URL}/proposals?projectId=${projectId}`;
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
        
        if (propostasData && propostasData.data) {
            res.status(200).json(propostasData.data);
        } else {
            res.status(404).json({ error: 'Proposta não encontrada para o projeto especificado.' });
        }
    } catch (err) {
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};