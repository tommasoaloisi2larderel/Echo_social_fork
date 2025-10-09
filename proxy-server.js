// Serveur proxy pour contourner CORS en développement
const http = require('http');
const https = require('https');
const url = require('url');

const API_BASE = 'https://reseausocial-production.up.railway.app';
const PORT = 3001;

const server = http.createServer((req, res) => {
  // Activer CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parser l'URL
  const parsedUrl = url.parse(req.url);
  const targetUrl = API_BASE + parsedUrl.path;

  console.log(`[PROXY] ${req.method} ${targetUrl}`);

  // Préparer les options pour la requête vers l'API
  const options = {
    method: req.method,
    headers: {
      ...req.headers,
      host: new URL(API_BASE).host
    }
  };

  // Faire la requête vers l'API
  const proxyReq = https.request(targetUrl, options, (proxyRes) => {
    // Copier les headers de la réponse
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Pipe la réponse
    proxyRes.pipe(res);
  });

  // Gérer les erreurs
  proxyReq.on('error', (e) => {
    console.error(`[PROXY ERROR] ${e.message}`);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Proxy error', message: e.message }));
  });

  // Pipe le body de la requête
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`\n🔧 Serveur proxy démarré sur http://localhost:${PORT}`);
  console.log(`📡 Redirige vers ${API_BASE}\n`);
  console.log(`💡 Modifiez API_BASE_URL dans vos fichiers pour pointer vers http://localhost:${PORT}\n`);
});

