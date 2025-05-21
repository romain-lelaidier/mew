const express = require('express');
const http = require('http');
const fs = require('fs');
const app = express();
const PORT = process.env.NODE_PORT || 8000;
const YTMClient = require("./youtube_extractor")

// Lire les fichiers de certificat
// const privateKey = fs.readFileSync('server.key', 'utf8');
// const certificate = fs.readFileSync('server.cert', 'utf8');
// const credentials = { key: privateKey, cert: certificate };

const c = new YTMClient()

// Définir une route pour la racine
app.get('/', (req, res) => {
  res.send('Welcome to the Mew server !');
});

app.get('/search_suggestions/:query', (req, res) => {
    const query = req.params.query;
    c.searchSuggestions(query).then(results => {
        res.status(200);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(results));
    }).catch(err => {
        res.status(400);
        res.end(err);
    })
})

app.get('/search/:query', (req, res) => {
    const query = req.params.query;
    c.search(query).then(results => {
        res.status(200);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(results));
    }).catch(err => {
        res.status(400);
        res.end(err);
    })
})

app.post('/download_video', (req, res) => {
    // const id = req.params.id;
    // c.downloadVideo(id, res, (progress) => {})
})

// Créer un serveur HTTPS
const httpServer = http.createServer(app);

// Démarrer le serveur
httpServer.listen(PORT, "::", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

/*
const server = require("http").createServer((req, res) => {
    // Définir le code de statut HTTP et le type de contenu
    if (req.url == "/audio.mp3") {
        console.log("envoi")
        res.writeHead(200, { 
            "Content-Type": "audio/mpeg",
            "Content-Disposition": "attachment"
        });
        c.downloadVideo({
            "top": true,
            "type": "VIDEO",
            "id": "ImKY6TZEyrI",
            "title": "Fade Into You (Official Music Video)",
            "artist": "Mazzy Star",
            "views": "115 M de vues",
            "duration": "4:22",
            "thumbnails": [
                {
                    "url": "https://i.ytimg.com/vi/ImKY6TZEyrI/sddefault.jpg?sqp=-oaymwEWCJADEOEBIAQqCghqEJQEGHgg6AJIWg&rs=AMzJL3lPQ7mk-ERMxvR3XU0MwzeWOYhNdQ",
                    "width": 400,
                    "height": 225
                }
            ]
        }, res, console.log).then(() => {
            console.log("fin")
            // stream.pipe(res, { end: true })
            // console.log(res)
            // fs.writeFileSync("./ytm_search_result.json", JSON.stringify(res))
        })
    }

    // Envoyer la réponse
    // res.end('Hello, Wrld!\n');
});

// Définir le port sur lequel le serveur écoute
const PORT = 3000;

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`Server running at http://192.168.1.119:${PORT}/`);
});
*/
