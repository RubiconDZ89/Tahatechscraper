const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Système de cache en mémoire intelligent (durée de validité : 2 heures)
// Évite de consommer inutilement le quota ScraperAPI si l'utilisateur clique plusieurs fois.
const videoCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 heures en millisecondes

app.get('/api/extract', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;
  
  if (!id) return res.status(400).json({ error: "ID manquant." });

  // Clé unique pour identifier le média demandé
  const cacheKey = `${type}_${id}_${season}_${episode}`;
  const cachedData = videoCache.get(cacheKey);

  // Si le lien est déjà en cache et valide, on le renvoie instantanément (0 requête consommée)
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
    console.log(`[Cache] Lien récupéré en mémoire pour l'ID : ${id}`);
    return res.json({ source: cachedData.source });
  }

  const API_KEY = process.env.SCRAPER_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "Configuration serveur incomplète : clé ScraperAPI manquante." });
  }

  const sources = [
    `https://embed.su/embed/${type}/${id}${type === 'tv' ? `/${season}/${episode}` : ''}`,
    `https://vidsrc.me/embed/${type}?tmdb=${id}${type === 'tv' ? `&season=${season}&ep=${episode}` : ''}`
  ];

  let videoLink = null;

  for (const targetUrl of sources) {
    console.log(`[ScraperAPI] Test de la source : ${targetUrl}`);
    
    // Paramètre render=true pour exécuter le JS et contourner les protections anti-bot
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true`;

    try {
      const response = await fetch(scraperApiUrl);
      const html = await response.text();

      // Recherche par Expression Régulière optimisée pour capturer les flux .mp4 ou .m3u8
      const regex = /(https?:\/\/[a-zA-Z0-9.\-_~:/?#\[\]@!$&'()*+,;=]+?\.(?:mp4|m3u8)[a-zA-Z0-9.\-_~:/?#\[\]@!$&'()*+,;=]*)/gi;
      const matches = html.match(regex);

      if (matches && matches.length > 0) {
        const validLink = matches.find(link => !link.includes('adserver') && !link.includes('blank'));
        
        if (validLink) {
          console.log(`[Succès] Flux vidéo extrait avec succès !`);
          videoLink = validLink;
          break; 
        }
      } else {
        console.log(`[Info] Aucun lien direct détecté dans le HTML rendu pour cette source.`);
      }
    } catch (error) {
      console.error(`[Erreur réseau] Échec de l'appel ScraperAPI : ${error.message}`);
    }
  }

  if (videoLink) {
    // Sauvegarde du résultat dans le cache intelligent
    videoCache.set(cacheKey, {
      source: videoLink,
      timestamp: Date.now()
    });

    res.json({ source: videoLink });
  } else {
    res.status(404).json({ error: "Aucun flux compatible trouvé malgré le contournement." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur intelligent démarré sur le port ${PORT}`));
