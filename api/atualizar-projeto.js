// Arquivo: api/atualizar-projeto.js
const fetch = require('node-fetch');

// Função para obter um token de acesso de curta duração, embutida para garantir compatibilidade.
async function getAccessToken(longLivedToken, apiUrl) {
    const authUrl = `${apiUrl}/auth/signin`;
    const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ token: longLivedToken })
    });
    if (!authResponse.ok) {
        const errorText = await authResponse.text();
        throw new Error(`Erro ao obter token: ${authResponse.status} - ${errorText}`);
    }
    const authData = await authResponse.json();
    return authData.access_token;
}

module.exports = async (req, res) => {
    // Configurações de cabeçalho para permitir a comunicação com seu site.
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Método não permitido. Use PATCH.' });
    }

    const longLivedToken = process.env.SOLARMARKET_TOKEN;
    const SOLARMARKET_API_URL = 'https://business.solarmarket.com.br/api/v2';
    
    try {
        const { projectId, newDescription } = req.body;
        if (!projectId || !newDescription) {
            return res.status(400).json({ error: 'projectId e newDescription são obrigatórios.' });
        }

        const accessToken = await getAccessToken(longLivedToken, SOLARMARKET_API_URL);
        
        // A URL correta que você demonstrou.
        const updateUrl = `${SOLARMARKET_API_URL}/projects/${projectId}`;
        const updatePayload = { description: newDescription };

        const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(updatePayload)
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Erro ao atualizar projeto: ${updateResponse.status} - ${errorText}`);
        }
        const responseData = await updateResponse.json();
        res.status(200).json({ success: true, data: responseData });

    } catch (err) {
        console.error('Erro na função serverless (atualizar-projeto):', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};