// Use a sintaxe "require" para importar módulos, compatível com a configuração padrão do Node.js no Vercel.
const fetch = require("node-fetch");

// A função do handler, que será chamada quando a requisição chegar.
module.exports = async (req, res) => {
    // Extrai o 'projectId' dos parâmetros da URL.
    const { projectId } = req.query;

    // Obtém o token da variável de ambiente, garantindo que ele não seja exposto.
    const token = process.env.SOLARMARKET_TOKEN;

    // Define a URL da API da SolarMarket com o 'projectId'.
    const apiUrl = `https://api.solarmarket.com.br/api/projetos/${projectId}/propostas/ativas`;

    try {
        // Faz a requisição para a API da SolarMarket, passando o token de autenticação no cabeçalho.
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        // Se a resposta não for bem-sucedida, lança um erro com o status HTTP.
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
        }

        // Converte a resposta para JSON.
        const data = await response.json();

        // Retorna a resposta com um status de sucesso (200) e os dados da API.
        res.status(200).json(data);
    } catch (error) {
        // Em caso de erro, retorna um status de erro interno (500) e a mensagem de erro.
        console.error("Erro na função serverless:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
};