/**
 * Função Serverless para consultar a proposta ativa de um projeto na API da SolarMarket.
 * Esta função lida com o ciclo de vida do token de acesso, obtendo um novo token temporário
 * a cada requisição para evitar erros de expiração.
 */
module.exports = async (req, res) => {
    // ######################################################################
    // 1. OBTÉM A CREDENCIAL DE LONGA DURAÇÃO
    // ######################################################################
    // O token de credencial está seguro na variável de ambiente do Vercel.
    const longLivedToken = process.env.SOLARMARKET_TOKEN;

    // A URL da API SolarMarket.
    const SOLARMARKET_API_URL = 'https://gdissolarproposta.vercel.app/api';

    // Captura o ID do projeto enviado na requisição do front-end.
    const { projectId } = req.query;

    // Verifica se o projectId foi fornecido
    if (!projectId) {
        res.status(400).json({ error: 'ID do projeto é obrigatório.' });
        return;
    }

    try {
        // ######################################################################
        // 2. GERA UM TOKEN DE ACESSO TEMPORÁRIO
        // ######################################################################
        const authResponse = await fetch(`${SOLARMARKET_API_URL}/auth/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: longLivedToken })
        });

        // Se a autenticação falhar, retorna o erro
        if (!authResponse.ok) {
            const authError = await authResponse.json();
            throw new Error(`Erro de Autenticação: ${authResponse.status} - ${JSON.stringify(authError)}`);
        }

        const authData = await authResponse.json();
        const accessToken = authData.token;

        // ######################################################################
        // 3. USA O TOKEN TEMPORÁRIO PARA FAZER A CONSULTA DA PROPOSTA
        // ######################################################################
        const propostaResponse = await fetch(`${SOLARMARKET_API_URL}/proposta?projectId=${projectId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        // Se a consulta falhar, retorna o erro
        if (!propostaResponse.ok) {
            const propostaError = await propostaResponse.json();
            throw new Error(`Erro ao consultar proposta: ${propostaResponse.status} - ${JSON.stringify(propostaError)}`);
        }

        const propostaData = await propostaResponse.json();
        
        // Retorna os dados da proposta para o front-end
        res.status(200).json(propostaData);

    } catch (err) {
        console.error('Erro na função serverless:', err.message);
        res.status(500).json({ error: err.message });
    }
};

