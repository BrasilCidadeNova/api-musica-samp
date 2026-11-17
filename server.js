const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Busca um nó ativo da rede aberta Audius
async function getAudiusHost() {
  const res = await fetch('https://audius.co');
  const json = await res.json();
  return json.data;
}

// Rota para o SITE
app.get('/api/pesquisar', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ erro: 'Digite o nome da música.' });

  try {
    const host = await getAudiusHost();
    const buscaUrl = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=SomBCN`;
    const resposta = await fetch(buscaUrl);
    const dados = await resposta.json();

    if (!dados.data || !dados.data.length) {
      return res.status(404).json({ erro: 'Nenhuma música encontrada.' });
    }

    const resultados = dados.data.slice(0, 8).map(track => {
      const minutos = Math.floor(track.duration / 60);
      const segundos = String(track.duration % 60).padStart(2, '0');
      return {
        titulo: `${track.user.name} - ${track.title}`,
        duracao: `${minutos}:${segundos}`,
        capa: track.artwork?.['150x150'] || 'https://placeholder.com',
        linkDireto: `https://${req.get('host')}/stream/${track.id}.mp3`
      };
    });

    res.json(resultados);
  } catch (err) {
    console.error('Erro Audius:', err);
    res.status(500).json({ erro: 'Erro ao buscar músicas.' });
  }
});

// Rota para o SA:MP (/jbl)
app.get('/buscar', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send('ERRO');

  try {
    const host = await getAudiusHost();
    const buscaUrl = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=SomBCN`;
    const resposta = await fetch(buscaUrl);
    const dados = await resposta.json();

    if (!dados.data || !dados.data.length) return res.status(404).send('NAO_ENCONTRADO');

    const track = dados.data;
    const streamUrl = `http://${req.get('host')}/stream/${track.id}.mp3`;
    res.send(`${track.user.name} - ${track.title}|${streamUrl}`);
  } catch (err) {
    res.status(500).send('ERRO_BUSCA');
  }
});

// Rota de Streaming MP3 direto
app.get('/stream/:id.mp3', async (req, res) => {
  try {
    const host = await getAudiusHost();
    const streamEndpoint = `${host}/v1/tracks/${req.params.id}/stream?app_name=SomBCN`;
    
    const audioRes = await fetch(streamEndpoint);
    if (!audioRes.ok) return res.status(404).send('Áudio indisponível');

    res.setHeader('Content-Type', 'audio/mpeg');
    const { Readable } = require('stream');
    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (err) {
    res.status(500).send('Erro no streaming');
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
