const express = require('express');
const path = require('path');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Busca um servidor ativo da rede Audius
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

    if (dados.data && dados.data.length > 0) {
      const resultados = dados.data.slice(0, 8).map(track => {
        const minutos = Math.floor(track.duration / 60);
        const segundos = String(track.duration % 60).padStart(2, '0');
        return {
          titulo: `${track.user.name} - ${track.title}`,
          duracao: `${minutos}:${segundos}`,
          capa: track.artwork?.['150x150'] || 'https://placeholder.com',
          linkDireto: `https://${req.get('host')}/stream/audius/${track.id}.mp3`
        };
      });
      return res.json(resultados);
    }

    // Reserva: Busca na API pública do Deezer se não achar no Audius
    const dzRes = await fetch(`https://deezer.com{encodeURIComponent(query)}`);
    const dzDados = await dzRes.json();

    if (!dzDados.data || !dzDados.data.length) {
      return res.status(404).json({ erro: 'Nenhuma música encontrada.' });
    }

    const resultadosDz = dzDados.data.slice(0, 8).map(track => ({
      titulo: `${track.artist.name} - ${track.title}`,
      duracao: 'Prévia 30s',
      capa: track.album?.cover_medium || 'https://placeholder.com',
      linkDireto: `https://${req.get('host')}/stream/deezer/${track.id}.mp3`
    }));

    res.json(resultadosDz);
  } catch (err) {
    console.error('Erro na busca:', err);
    res.status(500).json({ erro: 'Erro interno: ' + err.message });
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

    if (dados.data && dados.data.length > 0) {
      const track = dados.data;
      const streamUrl = `http://${req.get('host')}/stream/audius/${track.id}.mp3`;
      return res.send(`${track.user.name} - ${track.title}|${streamUrl}`);
    }

    // Reserva Deezer para o SA:MP
    const dzRes = await fetch(`https://deezer.com{encodeURIComponent(query)}`);
    const dzDados = await dzRes.json();

    if (dzDados.data && dzDados.data.length > 0) {
      const track = dzDados.data;
      const streamUrl = `http://${req.get('host')}/stream/deezer/${track.id}.mp3`;
      return res.send(`${track.artist.name} - ${track.title}|${streamUrl}`);
    }

    res.status(404).send('NAO_ENCONTRADO');
  } catch (err) {
    res.status(500).send('ERRO_BUSCA');
  }
});

// Streaming Audius (Música Completa)
app.get('/stream/audius/:id.mp3', async (req, res) => {
  try {
    const host = await getAudiusHost();
    const streamEndpoint = `${host}/v1/tracks/${req.params.id}/stream?app_name=SomBCN`;
    const audioRes = await fetch(streamEndpoint);
    if (!audioRes.ok) return res.status(404).send('Áudio indisponível');

    res.setHeader('Content-Type', 'audio/mpeg');
    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (err) {
    res.status(500).send('Erro no streaming');
  }
});

// Streaming Deezer
app.get('/stream/deezer/:id.mp3', async (req, res) => {
  try {
    const infoRes = await fetch(`https://deezer.com{req.params.id}`);
    const info = await infoRes.json();
    if (!info.preview) return res.status(404).send('Áudio indisponível');

    const audioRes = await fetch(info.preview);
    res.setHeader('Content-Type', 'audio/mpeg');
    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (err) {
    res.status(500).send('Erro no streaming');
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
