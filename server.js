const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Permite que sua aplicação no OnRender acesse este servidor

// Endpoint para buscar a taxa Selic
app.get('/selic', async (req, res) => {
  const url = 'https://api.bcb.gov.br/dados/SGS/6/dados?formato=json';

  try {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro na API do BCB: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data); // Envia os dados da API do BCB de volta para o seu front-end
  } catch (error) {
    console.error('Erro ao buscar a Selic:', error);
    res.status(500).send('Erro ao buscar dados da Selic.');
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor proxy rodando na porta ${PORT}`);
});