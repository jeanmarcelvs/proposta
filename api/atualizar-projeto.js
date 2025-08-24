// Arquivo: api/atualizar-projeto.js

const fetch = require('node-fetch');

// Função para obter o token de acesso
async function getAccessToken(longLivedToken, apiUrl) {
    const authUrl = `${apiUrl}/auth/signin`;
    const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ token: longLivedToken })
    });
    if (!authResponse.ok) throw new Error(`Erro ao obter token: ${authResponse.status}`);
    const authData = await authResponse.json();
    return authData.access_token;
}

module.exports = async (req, res) => {
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
        // CORREÇÃO: O backend agora só precisa do projectId
        const { projectId } = req.body;

        if (!projectId ) {
            return res.status(400).json({ error: 'projectId é obrigatório.' });
        }

        const accessToken = await getAccessToken(longLivedToken, SOLARMARKET_API_URL);
        
        // --- LÓGICA REFINADA ---
        // 1. Buscar os dados da proposta para obter o nome
        const proposalsUrl = `${SOLARMARKET_API_URL}/projects/${projectId}/proposals`;
        const proposalsResponse = await fetch(proposalsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'accept': 'application/json' }
        });
        if (!proposalsResponse.ok) throw new Error('Não foi possível buscar a proposta para obter o nome.');
        
        const proposalsData = await proposalsResponse.json();
        // A API retorna a proposta mais recente, então podemos pegar o nome dela
        const proposalName = proposalsData.data?.name;

        if (!proposalName) throw new Error('Nome da proposta não encontrado.');

        // 2. Montar o payload com a string correta
        const updatePayload = {
            description: `Cliente Visualizou: ${proposalName}`
        };

        // 3. Enviar a atualização
        const updateUrl = `${SOLARMARKET_API_URL}/projects/${projectId}`;
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
        res.status(500).json({ error: 'Erro ao processar a requisição de atualização.', details: err.message });
    }
};
