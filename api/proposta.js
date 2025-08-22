/**
 * Função Serverless para consultar as propostas de um projeto na API da SolarMarket.
 * Esta função usa o token de longa duração diretamente para fazer a consulta,
 * seguindo o padrão de uso da documentação da API.
 * ATENÇÃO: PARA EVITAR O ERRO 401, CERTIFIQUE-SE QUE A VARIÁVEL DE AMBIENTE
 * 'SOLARMARKET_TOKEN' ESTÁ CORRETAMENTE CONFIGURADA NO SEU PROJETO VERCEL.
 * O valor deve ser o token de longa duração fornecido pela SolarMarket.
 */
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
    // 1. OBTÉM A CREDENCIAL DE LONGA DURAÇÃO E CONFIGURA VARIÁVEIS
    // ######################################################################
    // O token de credencial está armazenado de forma segura na variável de ambiente do Vercel.
    const longLivedToken = process.env.SOLARMARKET_TOKEN;

    // A URL CORRETA DA API SOLARMARKET.
    const SOLARMARKET_API_URL = 'https://business.solarmarket.com.br/api/v2';

    // Captura o ID do projeto enviado na requisição do front-end.
    const { projectId } = req.query;

    try {
        // Verifica se o projectId foi fornecido
        if (!projectId) {
            res.status(400).json({ error: 'ID do projeto é obrigatório.' });
            return;
        }

        // Adicionamos uma verificação extra para garantir que o token de longa duração está presente.
        if (!longLivedToken) {
            res.status(500).json({ error: 'Erro de configuração: A variável de ambiente SOLARMARKET_TOKEN não está definida.' });
            return;
        }

        // ######################################################################
        // 2. USA O TOKEN DE LONGA DURAÇÃO PARA CONSULTAR A PROPOSTA DIRETAMENTE
        // ######################################################################
        const propostaResponse = await fetch(`${SOLARMARKET_API_URL}/projects/${projectId}/proposals`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                // Usamos o token de longa duração diretamente aqui.
                'Authorization': `Bearer ${longLivedToken}`
            }
        });

        // Se a consulta falhar, lança uma exceção com mais detalhes.
        if (!propostaResponse.ok) {
            const propostaErrorText = await propostaResponse.text();
            throw new Error(`Erro ao consultar proposta: ${propostaResponse.status} - ${propostaErrorText}`);
        }

        const propostasData = await propostaResponse.json();

        // O endpoint pode retornar um array, então vamos pegar a primeira proposta encontrada.
        const propostaAtiva = propostasData && propostasData.length > 0 ? propostasData[0] : null;

        if (!propostaAtiva) {
            res.status(404).json({ error: 'Proposta não encontrada para o projeto especificado.' });
            return;
        }

        // ######################################################################
        // 3. RETORNA OS DADOS DA PROPOSTA PARA O FRONT-END
        // ######################################################################
        res.status(200).json(propostaAtiva);

    } catch (err) {
        // Este bloco de captura garante que todos os erros sejam tratados.
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};
