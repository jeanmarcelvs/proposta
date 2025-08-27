/**
 * Arquivo: api/proposta.js
 * Esta é uma Vercel Serverless Function que consulta a API da SolarMarket.
 */
import solarmarket from '@api/solarmarket';
import fetch from 'node-fetch';

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

    const longLivedToken = process.env.SOLARMARKET_TOKEN;
    const SOLARMARKET_API_URL = 'https://business.solarmarket.com.br/api/v2';

    try {
        // Usa a biblioteca solarmarket para obter o token de acesso
        const authResponse = await solarmarket.autenticarUsuario({ token: longLivedToken });
        const accessToken = authResponse.data.access_token;

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
}