// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Usa a variável de ambiente para a URL da API
const BCB_API_URL = process.env.BCB_API_URL;

// Endpoint para buscar a taxa Selic
app.get('/selic', async (req, res) => {
  try {
    const response = await fetch(BCB_API_URL);

    if (!response.ok) {
        throw new Error(`Erro na API do BCB: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar a Selic:', error);
    res.status(500).send('Erro ao buscar dados da Selic.');
  }
});

// Inicia o servidor--------
app.listen(PORT, () => {
  console.log(`Servidor proxy rodando na porta ${PORT}`);
});