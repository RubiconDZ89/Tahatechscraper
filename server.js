const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/extract', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;
  
  if (!id) return res.status(400).json({ error: "ID manquant." });

  const API_KEY = process.env.SCRAPER_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "Configuration serveur incomplète : clé ScraperAPI manquante." });
  }

  // Liste allégée des sources à tester
  const sources = [
    `https://embed.su/embed/${type}/${id}${type === 'tv' ? `/${season}/${episode}` : ''}`,
    `https://vidsrc.me/embed/${type}?tmdb=${id}${type === 'tv' ? `&season=${season}&ep=${episode}` : ''}`
  ];

  let videoLink = null;

  for (const targetUrl of sources) {
    console.log(`[ScraperAPI] Interrogation de : ${targetUrl}`);
    
    // Requête vers ScraperAPI avec rendu JavaScript activé pour contourner Cloudflare
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true`;

    try {
      const response = await fetch(scraperApiUrl);
      const html = await response.text();

      // Recherche Regex universelle pour trouver les flux médias dans le code source de la page
      const regex = /(https?:\/\/[a-zA-Z0-9.\-_~:/?#\[\]@!$&'()*+,;=]+?\.(?:mp4|m3u8)[a-zA-Z0-9.\-_~:/?#\[\]@!$&'()*+,;=]*)/gi;
      const matches = html.match(regex);

      if (matches && matches.length > 0) {
        // Filtrage de base pour exclure les fausses URL (scripts de pub, vidéos vides)
        const validLink = matches.find(link => !link.includes('adserver') && !link.includes('blank'));
        
        if (validLink) {
          console.log(`[Succès] Flux vidéo capturé !`);
          videoLink = validLink;
          break; // Arrête la recherche dès qu'un lien est trouvé
        }
      } else {
        console.log(`[Échec] Le contournement a fonctionné, mais aucun lien direct .mp4/.m3u8 n'est exposé dans le HTML.`);
      }
    } catch (error) {
      console.error(`[Erreur réseau] Échec de la communication avec l'API : ${error.message}`);
    }
  }

  if (videoLink) {
    res.json({ source: videoLink });
  } else {
    res.status(404).json({ error: "Aucun flux compatible trouvé par le système d'extraction." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur d'extraction via API démarré sur le port ${PORT}`));
