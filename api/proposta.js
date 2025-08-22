/**
 * Função Serverless para consultar a proposta ativa de um projeto na API da SolarMarket.
 * Esta função lida com o ciclo de vida do token de acesso, obtendo um novo token temporário
 * a cada requisição para evitar erros de expiração.
 */
module.exports = async (req, res) => {
    // ######################################################################
    // 1. OBTÉM A CREDENCIAL DE LONGA DURAÇÃO E CONFIGURA VARIÁVEIS
    // ######################################################################
    // O token de credencial está seguro na variável de ambiente do Vercel.
    const longLivedToken = process.env.SOLARMARKET_TOKEN;

    // A URL CORRETA DA API SOLARMARKET.
    const SOLARMARKET_API_URL = 'https://business.solarmarket.com.br/api/v2';

    // Captura o ID do projeto enviado na requisição do front-end.
    // O front-end envia como 'projectId', que será usado como 'id' na API.
    const { projectId } = req.query;

    // Inicia um bloco try-catch para garantir que qualquer erro na requisição
    // seja capturado e retornado ao front-end como um JSON.
    try {
        // Verifica se o projectId foi fornecido
        if (!projectId) {
            // Se o projectId estiver ausente, retorna um erro 400 (Bad Request).
            res.status(400).json({ error: 'ID do projeto é obrigatório.' });
            return; // Encerra a execução da função aqui.
        }

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

        // Se a autenticação falhar, lê a resposta como texto para evitar
        // o erro 'Unexpected token' e lança uma exceção com mais detalhes.
        if (!authResponse.ok) {
            const authErrorText = await authResponse.text();
            throw new Error(`Erro de Autenticação: ${authResponse.status} - ${authErrorText}`);
        }

        const authData = await authResponse.json();
        const accessToken = authData.token;

        // ######################################################################
        // 3. USA O TOKEN TEMPORÁRIO PARA FAZER A CONSULTA DA PROPOSTA
        // ######################################################################
        // O caminho da API foi corrigido para '/proposals/get-proposta' com base na sua coleção do Postman.
        const propostaResponse = await fetch(`${SOLARMARKET_API_URL}/proposals/get-proposta?id=${projectId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        // Se a consulta falhar, lê a resposta como texto para evitar
        // o erro 'Unexpected token' e lança uma exceção com mais detalhes.
        if (!propostaResponse.ok) {
            const propostaErrorText = await propostaResponse.text();
            throw new Error(`Erro ao consultar proposta: ${propostaResponse.status} - ${propostaErrorText}`);
        }

        const propostaData = await propostaResponse.json();

        // ######################################################################
        // 4. RETORNA OS DADOS DA PROPOSTA PARA O FRONT-END
        // ######################################################################
        res.status(200).json(propostaData);

    } catch (err) {
        // Este bloco de captura garante que todos os erros (inclusive a falha de
        // análise do JSON) sejam tratados e retornados ao cliente de forma segura.
        console.error('Erro na função serverless:', err.message);
        // O status 500 é mantido para erros internos.
        res.status(500).json({ error: 'Erro ao processar a requisição.', details: err.message });
    }
};
