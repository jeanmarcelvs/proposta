/**
 * Arquivo: api/proposta.js
 * Esta é uma Vercel Serverless Function que consulta a API da SolarMarket.
 */
import solarmarket from '@api/solarmarket';

export default async function (req, res) {
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

    try {
        // Usa a biblioteca solarmarket para obter a proposta
        const propostaResponse = await solarmarket.consultarPropostas({ projectId });

        // A API da SolarMarket já trata a autenticação internamente.
        // Acessamos os dados da resposta diretamente.
        if (propostaResponse.status !== 200) {
            throw new Error(`Erro ao consultar proposta: ${propostaResponse.status} - ${propostaResponse.statusText}`);
        }

        const propostasData = propostaResponse.data;
        
        if (propostasData && propostasData.data) {
            res.status(200).json(propostasData.data);
        } else {
            res.status(404).json({ error: 'Proposta não encontrada para o projeto especificado.' });
        }

    } catch (err) {
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
}