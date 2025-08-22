/**
 * Função Serverless para consultar as propostas de um projeto na API da SolarMarket.
 * Esta função segue a recomendação do suporte técnico, usando o token de longa duração
 * para gerar um token temporário a cada consulta, garantindo que ele seja sempre válido.
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
    // 1. OBTÉM AS CREDENCIAIS E VALIDAÇÃO INICIAL
    // ######################################################################
    // O token de credencial de longa duração está armazenado de forma segura na variável de ambiente do Vercel.
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

        // Verifica se a variável de ambiente do token de longa duração foi configurada.
        if (!longLivedToken) {
            res.status(500).json({ error: 'Erro de configuração: A variável de ambiente SOLARMARKET_TOKEN não está definida.' });
            return;
        }

        // ######################################################################
        // 2. GERA UM NOVO TOKEN DE ACESSO TEMPORÁRIO A CADA REQUISIÇÃO
        // ######################################################################
        console.log("Iniciando a etapa 1: Gerando um novo token temporário...");
        const authResponse = await fetch(`${SOLARMARKET_API_URL}/auth/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: longLivedToken })
        });
        
        // Log para ajudar a depuração
        console.log("Status da resposta de autenticação:", authResponse.status);

        // Se a autenticação falhar, lança uma exceção com mais detalhes.
        if (!authResponse.ok) {
            const authErrorText = await authResponse.text();
            throw new Error(`Erro de Autenticação: ${authResponse.status} - ${authErrorText}`);
        }

        const authData = await authResponse.json();
        const accessToken = authData.token;

        // Log para inspecionar os dados retornados pela autenticação
        console.log("Dados de autenticação recebidos:", authData);
        if (!accessToken) {
             throw new Error("Erro de Autenticação: O token de acesso não foi encontrado na resposta.");
        }
        console.log("Token de acesso temporário gerado com sucesso.");

        // ######################################################################
        // 3. USA O TOKEN TEMPORÁRIO PARA FAZER A CONSULTA DA PROPOSTA
        // ######################################################################
        console.log("Iniciando a etapa 2: Consultando as propostas com o novo token...");
        const propostaResponse = await fetch(`${SOLARMARKET_API_URL}/projects/${projectId}/proposals`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                // Usa o token temporário com o prefixo 'Bearer'
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        // Log para ajudar a depuração
        console.log("Status da resposta da consulta de propostas:", propostaResponse.status);

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
        // 4. RETORNA OS DADOS DA PROPOSTA PARA O FRONT-END
        // ######################################################################
        console.log("Proposta encontrada e retornada com sucesso.");
        res.status(200).json(propostaAtiva);

    } catch (err) {
        // Este bloco de captura garante que todos os erros sejam tratados.
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};
