const express = require('express');
const { spawn, execFile } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Função de busca rápida com fallback para SoundCloud caso o YouTube bloqueie o IP
function buscarMusica(query, limite = 1) {
  return new Promise((resolve, reject) => {
    // Tenta buscar primeiro no YouTube de forma leve
    execFile('yt-dlp', [
      `ytsearch${limite}:${query}`,
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings'
    ], { timeout: 15000 }, (err, stdout, stderr) => {
      if (!err && stdout) {
        try {
          const data = JSON.parse(stdout);
          if (data.entries && data.entries.length > 0) {
            return resolve({ fonte: 'yt', entries: data.entries });
          }
        } catch (e) {}
      }

      // Se o YouTube bloquear o IP do Render, busca automaticamente no SoundCloud
      execFile('yt-dlp', [
        `scsearch${limite}:${query}`,
        '--dump-single-json',
        '--flat-playlist',
        '--no-warnings'
      ], { timeout: 15000 }, (errSc, stdoutSc) => {
        if (errSc) {
          console.error('Erro na busca:', stderr || errSc);
          return reject(errSc);
        }
        try {
          const dataSc = JSON.parse(stdoutSc);
          resolve({ fonte: 'sc', entries: dataSc.entries || [] });
        } catch (e) {
          reject(e);
        }
      });
    });
  });
}

// Rota para o SITE
app.get('/api/pesquisar', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ erro: 'Digite o nome da música.' });

  try {
    const { fonte, entries } = await buscarMusica(query, 5);
    if (!entries.length) return res.status(404).json({ erro: 'Nenhuma música encontrada.' });

    const resultados = entries.map(item => {
      const urlOriginal = item.url || item.webpage_url || `https://youtube.com{item.id}`;
      const encodedUrl = Buffer.from(urlOriginal).toString('base64url');
      return {
        titulo: item.title || 'Sem título',
        duracao: item.duration_string || (fonte === 'sc' ? 'SoundCloud' : 'MP3'),
        capa: item.thumbnail || (item.thumbnails && item.thumbnails[0]?.url) || 'https://placeholder.com',
        linkDireto: `https://${req.get('host')}/stream/${encodedUrl}.mp3`
      };
    });

    res.json(resultados);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar músicas. Verifique os logs.' });
  }
});

// Rota para o SA:MP (/jbl)
app.get('/buscar', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send('ERRO');

  try {
    const { entries } = await buscarMusica(query, 1);
    const item = entries[0];
    if (!item) return res.status(404).send('NAO_ENCONTRADO');

    const urlOriginal = item.url || item.webpage_url || `https://youtube.com{item.id}`;
    const encodedUrl = Buffer.from(urlOriginal).toString('base64url');
    const streamUrl = `http://${req.get('host')}/stream/${encodedUrl}.mp3`;

    res.send(`${item.title}|${streamUrl}`);
  } catch (err) {
    res.status(500).send('ERRO_BUSCA');
  }
});

// Rota de Streaming MP3 direto
app.get('/stream/:encoded.mp3', (req, res) => {
  try {
    const mediaUrl = Buffer.from(req.params.encoded, 'base64url').toString('utf8');
    res.setHeader('Content-Type', 'audio/mpeg');

    const ytdlp = spawn('yt-dlp', ['-f', 'bestaudio', '-o', '-', mediaUrl]);
    const ffmpeg = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'mp3', '-ab', '128k', '-vn', 'pipe:1']);

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    req.on('close', () => {
      ytdlp.kill();
      ffmpeg.kill();
    });
  } catch (e) {
    res.status(400).send('Link inválido');
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
        
