// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Importa o axios

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Usa a variável de ambiente para a URL da API
const BCB_API_URL = process.env.BCB_API_URL;

// Endpoint para buscar a taxa Selic
app.get('/selic', async (req, res) => {
  try {
    // Usa axios para fazer a requisição
    const response = await axios.get(BCB_API_URL);
    const data = response.data; // Axios já converte a resposta para JSON
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar a Selic:', error.message);
    res.status(500).send('Erro ao buscar dados da Selic.');
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor proxy rodando na porta ${PORT}`);
});