// Este trecho de código faz parte da Vercel Serverless Function (`api/proposta.js`).

module.exports = async (req, res) => {
    // ...código anterior que define credenciais e URLs...

    // 1. OBTÉM O 'projectId' da URL da requisição (parâmetro de consulta).
    const { projectId } = req.query;
    
    // O token de acesso que será enviado na requisição.
    // Ele é obtido do Vercel Environment Variable (process.env.SOLARMARKET_TOKEN).
    const longLivedToken = process.env.SOLARMARKET_TOKEN;

    try {
        // Verifica se o projectId foi fornecido
        if (!projectId) {
            console.error('Erro 400: projectId é obrigatório e não foi encontrado na requisição.');
            res.status(400).json({ error: 'ID do projeto é obrigatório.' });
            return;
        }

        // ======================================================================
        // CÓDIGO DE DEBUG ADICIONADO PARA O SUPORTE
        // Imprime o token de acesso para verificação.
        console.log(`Debug: Usando o Token de Acesso: ${longLivedToken ? 'Token recebido com sucesso.' : 'Token ausente!'}`);
        // Imprime a URL completa da API para verificação.
        const apiUrl = `${SOLARMARKET_API_URL}/projects/${projectId}/proposals`;
        console.log(`Debug: Chamando a URL da API: ${apiUrl}`);
        // ======================================================================

        // 2. UTILIZA O 'projectId' para construir a URL da API da SolarMarket.
        // O endpoint utilizado é o de listagem de propostas para um projeto específico.
        const propostaResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${longLivedToken}`
            }
        });
        
        // ...código posterior que lida com a resposta...

    } catch (err) {
        // ...tratamento de erro...
    }
};
