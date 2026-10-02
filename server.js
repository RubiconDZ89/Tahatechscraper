const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

app.get('/api/extract', async (req, res) => {
  const { id } = req.query;
  const targetUrl = `https://vidsrc.me/embed/movie?tmdb=${id}`;
  
  console.log(`[Recherche] Début de l'extraction pour l'ID : ${id}`);

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
    });
    
    const page = await browser.newPage();
    let videoLink = null;

    // Afficher toutes les URLs interceptées dans la console Render
    page.on('response', async (response) => {
      const url = response.url();
      // On log les requêtes média pour voir ce qui passe
      if (url.includes('.mp4') || url.includes('.m3u8') || response.headers()['content-type']?.includes('video')) {
         console.log(`[TROUVÉ] Flux potentiel intercepté : ${url}`);
         videoLink = url;
      }
    });

    console.log(`[Navigation] Ouverture de : ${targetUrl}`);
    // On augmente le délai et on attend que le réseau se calme
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Optionnel : Simuler un clic au centre de la page pour lancer la vidéo
    console.log("[Action] Simulation d'un clic pour déclencher le lecteur...");
    await page.mouse.click(page.viewport().width / 2, page.viewport().height / 2);
    
    // Attendre 5 secondes supplémentaires après le clic pour laisser le trafic réseau se générer
    await new Promise(r => setTimeout(r, 5000));

    // Si on veut voir ce qui bloque, on peut extraire le titre de la page
    const pageTitle = await page.title();
    console.log(`[Titre de la page chargée] : ${pageTitle}`);

    await browser.close();

    if (videoLink) {
      console.log(`[Succès] Lien envoyé au frontend.`);
      res.json({ source: videoLink });
    } else {
      console.log(`[Échec] Aucun flux détecté pour l'ID ${id}.`);
      res.status(404).json({ error: "Aucun flux compatible trouvé." });
    }
  } catch (error) {
    console.error(`[Erreur Fatale] : ${error.message}`);
    res.status(500).json({ error: "Erreur du serveur d'extraction." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scraper démarré sur le port ${PORT}`));
