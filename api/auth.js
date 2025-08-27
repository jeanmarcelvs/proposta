// Arquivo: auth.js
const fetch = require('node-fetch');

/**
 * Função para obter um token de acesso de curta duração a partir de um token de longa duração.
 * @param {string} longLivedToken - O token de longa duração da SolarMarket.
 * @param {string} apiUrl - A URL base da API da SolarMarket.
 * @returns {Promise<string>} O token de acesso.
 * @throws {Error} Se a autenticação falhar.
 */
async function getAccessToken(longLivedToken, apiUrl) {
    const authUrl = `${apiUrl}/auth/signin`;
    
    const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ token: longLivedToken })
    });

    if (!authResponse.ok) {
        const errorText = await authResponse.text();
        throw new Error(`Erro ao obter token de acesso: ${authResponse.status} - ${errorText}`);
    }

    const authData = await authResponse.json();
    return authData.access_token;
}

module.exports = { getAccessToken };