const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

app.get('/api/extract', async (req, res) => {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: "ID TMDB manquant." });
  }

  // URL cible du scraper (Modifiable selon la source primaire utilisée)
  const targetUrl = `https://vidsrc.me/embed/movie?tmdb=${id}`;

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
    let videoLink = null;

    // Interception stricte des flux vidéo
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.mp4') || url.includes('.m3u8')) {
        videoLink = url;
      }
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await browser.close();

    if (videoLink) {
      res.json({ source: videoLink });
    } else {
      res.status(404).json({ error: "Aucun flux direct intercepté." });
    }
  } catch (error) {
    res.status(500).json({ error: "Délai d'attente ou erreur d'extraction." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur d'extraction démarré sur le port ${PORT}`));
