const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

app.get('/api/extract', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;

  if (!id) return res.status(400).json({ error: "ID manquant." });

  const sources = [
    `https://embed.su/embed/${type}/${id}${type === 'tv' ? `/${season}/${episode}` : ''}`,
    `https://vidsrc.me/embed/${type}?tmdb=${id}${type === 'tv' ? `&season=${season}&ep=${episode}` : ''}`,
    `https://vidlink.pro/${type === 'tv' ? 'tv' : 'movie'}/${id}${type === 'tv' ? `/${season}/${episode}` : ''}`,
    `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1${type === 'tv' ? `&s=${season}&e=${episode}` : ''}`
  ];

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process'
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    // Ajout d'un faux User-Agent pour améliorer la furtivité
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    let videoLink = null;

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.mp4') || url.includes('.m3u8')) {
        videoLink = url;
      }
    });

    for (const url of sources) {
      console.log(`[Test Source] : ${url}`);
      try {
        // Changement de 'networkidle2' à 'domcontentloaded' pour éviter les blocages liés aux scripts de pub infinis
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.mouse.click(page.viewport().width / 2, page.viewport().height / 2);
        await new Promise(r => setTimeout(r, 4000));
      } catch (e) {
        console.log(`[Échec de la source] Raison : ${e.message}`);
      }

      if (videoLink) break;
    }

    await browser.close();

    if (videoLink) {
      res.json({ source: videoLink });
    } else {
      res.status(404).json({ error: "Aucun flux compatible trouvé." });
    }
  } catch (error) {
    console.error(`[Erreur système] : ${error.message}`);
    res.status(500).json({ error: "Erreur critique du serveur." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scraper démarré sur le port ${PORT}`));
