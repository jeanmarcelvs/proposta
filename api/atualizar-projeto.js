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
        // O frontend agora envia o projectId e a MENSAGEM do evento
        const { projectId, eventMessage } = req.body;

        if (!projectId || !eventMessage ) {
            return res.status(400).json({ error: 'projectId e eventMessage são obrigatórios.' });
        }

        const accessToken = await getAccessToken(longLivedToken, SOLARMARKET_API_URL);
        
        // --- LÓGICA DE CONCATENAÇÃO ---
        // 1. Buscar os dados atuais do projeto para obter a descrição existente
        const projectUrl = `${SOLARMARKET_API_URL}/projects/${projectId}`;
        const projectResponse = await fetch(projectUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'accept': 'application/json' }
        });
        if (!projectResponse.ok) throw new Error('Não foi possível buscar o projeto para obter a descrição atual.');
        
        const projectData = await projectResponse.json();
        const currentDescription = projectData.data?.description || '';

        // 2. Montar a nova descrição concatenando o evento
        // Usamos '\n' para criar uma nova linha para cada evento
        const newDescription = currentDescription 
            ? `${currentDescription}\n${eventMessage}` 
            : eventMessage;

        // 3. Montar o payload e enviar a atualização
        const updatePayload = {
            description: newDescription
        };

        const updateResponse = await fetch(projectUrl, {
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
