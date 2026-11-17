const express = require('express');
const { spawn, execFile } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Função auxiliar para buscar via yt-dlp
function buscarYoutube(query, limite = 1) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', [`ytsearch${limite}:${query}`, '--dump-single-json', '--no-warnings'], (err, stdout) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Rota para o SITE
app.get('/api/pesquisar', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ erro: 'Digite o nome da música.' });

  try {
    const info = await buscarYoutube(query, 5);
    const resultados = info.entries.map(video => ({
      id: video.id,
      titulo: video.title,
      duracao: video.duration_string || 'N/A',
      capa: video.thumbnail,
      linkDireto: `http://${req.get('host')}/tocar/${video.id}.mp3`
    }));
    res.json(resultados);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar músicas.' });
  }
});

// Rota para o SA:MP (/jbl)
app.get('/buscar', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send('ERRO');

  try {
    const info = await buscarYoutube(query, 1);
    const video = info.entries[0];
    if (!video) return res.status(404).send('NAO_ENCONTRADO');

    const streamUrl = `http://${req.get('host')}/tocar/${video.id}.mp3`;
    res.send(`${video.title}|${streamUrl}`);
  } catch (err) {
    res.status(500).send('ERRO_BUSCA');
  }
});

// Rota de Streaming MP3 direto
app.get('/tocar/:id.mp3', (req, res) => {
  const videoUrl = `https://youtube.com{req.params.id}`;
  res.setHeader('Content-Type', 'audio/mpeg');

  const ytdlp = spawn('yt-dlp', ['-f', 'bestaudio', '-o', '-', videoUrl]);
  const ffmpeg = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'mp3', '-ab', '128k', '-vn', 'pipe:1']);

  ytdlp.stdout.pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(res);

  req.on('close', () => {
    ytdlp.kill();
    ffmpeg.kill();
  });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
