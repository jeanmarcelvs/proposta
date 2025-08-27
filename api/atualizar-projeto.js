// Arquivo: api/atualizar-projeto.js
import solarmarket from '@api/solarmarket';

export default async function (req, res) {
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
    
    try {
        const { projectId, newDescription } = req.body;

        if (!projectId || !newDescription ) {
            return res.status(400).json({ error: 'projectId e newDescription são obrigatórios.' });
        }
        
        // Usa a biblioteca solarmarket para atualizar o projeto
        const updateResponse = await solarmarket.atualizarProjeto(projectId, {
            description: newDescription
        });

        if (updateResponse.status !== 200) {
            throw new Error(`Erro ao atualizar projeto: ${updateResponse.status} - ${updateResponse.statusText}`);
        }

        const responseData = updateResponse.data;
        res.status(200).json({ success: true, data: responseData });

    } catch (err) {
        console.error('Erro na função serverless (atualizar-projeto):', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};