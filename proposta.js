// Arquivo: api/proposta.js
import fetch from "node-fetch";
// A token fixa da API SolarMarket é armazenada com segurança como uma variável de ambiente no Vercel.
// Isso evita que ela seja exposta no código-fonte do seu site.
const tokenFixa = process.env.SOLARMARKET_TOKEN;
export default async function handler(request, response) {
const projectId = request.query.projectId;
if (!projectId) {
return response.status(400).send('ID do projeto não fornecido.');
}
try {
// Passo 1: Autenticação para obter o access_token temporário (JWT)
// Este passo é executado ANTES de CADA requisição, garantindo uma token válida.
const authRes = await fetch('https://business.solarmarket.com.br/api/v2/auth/signin', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ token: tokenFixa })
});
const authData = await authRes.json();
const accessToken = authData.access_token;
if (!accessToken) {
return response.status(500).send('Erro de autenticação com a API SolarMarket.');
}
// Passo 2: Consulta a proposta ativa com a access_token segura
// A token temporária recém-obtida é usada para esta requisição.
const proposalsRes = await fetch(`https://business.solarmarket.com.br/api/v2/projects/${projectId}/proposals
method: 'GET',
headers: {
'accept': 'application/json',
'Authorization': `Bearer ${accessToken}`
}
});
const proposalsData = await proposalsRes.json();
return response.status(200).json(proposalsData);
} catch (err) {
console.error(err);
return response.status(500).send('Erro ao consultar proposta.');
}
}