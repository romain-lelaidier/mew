const express = require('express');
const http = require('http');
const fs = require('fs');
const app = express();
const PORT = process.env.NODE_PORT || 8000;

const utils = require('./utils')
const YTMClient = require('./youtube_extractor')
const HTMLBuilder = require('./web/builder')

const MYSQL_CONFIG = JSON.parse(fs.existsSync("./mysql_config.json")
    ? fs.readFileSync("./mysql_config.json")
    : process.env.MYSQL_CONFIG);

// HTTPS credentials
// const privateKey = fs.readFileSync('server.key', 'utf8');
// const certificate = fs.readFileSync('server.cert', 'utf8');
// const credentials = { key: privateKey, cert: certificate };

const c = new YTMClient(MYSQL_CONFIG);
c.init();

const b = new HTMLBuilder();

const ww = new utils.WebWrapper();

app.use(express.json())

function bres(res, code, contentType, data) {
    // basic response
    res.status(code);
    res.setHeader('Content-Type', contentType);
    res.end(data)
}

function ares(res, condition, message) {
    // assert condition is verified ; otherwise, ends response with message
    // returns condition
    if (!condition) {
        bres(res, 400, 'text/plain', message)
    }
    return condition;
}

function jres(res, obj) {
    // resolves response with JSON object
    bres(res, 200, 'application/json', JSON.stringify(obj))
}

function eres(res, err) {
    // resolves response with 500 status code and prints error
    console.error(err);
    bres(res, 500, 'text/plain', 'Oups, server error : ' + err.toString())
}

app.get('/', (req, res) => {
    res.writeHead(302, {
        'Location': '/web'
    });
    res.end();
    // bres(res, 200, 'text/plain', 'Welcome to the Mew server ! rdn : ' + Math.random())
});

app.get('/api/search_suggestions/:query', (req, res) => {
    const query = req.params.query;

    c.searchSuggestions(query).then(results => {
        jres(res, results)
    }).catch(err => {
        console.log(err)
        eres(res, err)
    })
})

app.get('/api/search/:query', (req, res) => {
    const query = req.params.query;

    c.search(query).then(results => {
        // fs.writeFileSync(file, JSON.stringify(results.SONG));
        jres(res, results)
    }).catch(err => {
        console.log(err)
        eres(res, err)
    })
})

app.post('/api/extract_video/', (req, res) => {
    var valid = ares(res, "info" in req.body, 'No "info" field provided')
        && ares(res, "id" in req.body.info, 'No "id" field provided')
        && ares(res, req.body.info.id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    c.EU(req.body.info).then(info => {
        if ("mobapp" in req.body && req.body.mobapp == true) {
            info.video.streamUrl = info.video.formats
                .filter(fmt => fmt.mimeType.includes("audio/webm"))
                .sort((fmt1, fmt2) => fmt2.bitrate - fmt1.bitrate)
                [0].url;
            console.log(info)
            delete info.video.formats;
        }
        fs.writeFileSync(file, JSON.stringify(info));
        jres(res, info)
    }).catch(err => {
        eres(res, err)
    })
})

app.get('/api/extract_video/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    var obj = { id };
    var params = utils.parseQueryString(req._parsedUrl.query);
    for (var [ key, value ] of Object.entries(params)) {
        obj[key] = value;
    }

    c.EU(obj)
    .then(info => {
        jres(res, info)
    }).catch(err => {
        console.log(err)
        eres(res, err)
    })
})

app.get('/api/extract_album/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{17}$/), 'Invalid album id')
    if (!valid) return;

    var obj = { id };
    var params = utils.parseQueryString(req._parsedUrl.query);
    for (var [ key, value ] of Object.entries(params)) {
        obj[key] = value;
    }

    c.getAlbum(obj)
    .then(album => {
        jres(res, album)
    }).catch(err => {
        console.log(err)
        eres(res, err)
    });
})

app.get('/api/mp3/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    var obj = { id };
    var params = utils.parseQueryString(req._parsedUrl.query);
    for (var [ key, value ] of Object.entries(params)) {
        obj[key] = value;
    }

    console.log("Downloading", obj)

    c.EUDC(obj).then(path => {
        res.status(200);
        res.setHeader('Content-type', 'audio/mpeg');
        res.setHeader('Content-disposition', 'attachment');
        fs.createReadStream(path).pipe(res, end=true);
    }).catch(err => {
        console.log(err)
        eres(res, err)
    })
})

// web server

app.get('/web/', (req, res) => {
    var params = utils.parseQueryString(req._parsedUrl.query);
    bres(res, 200, 'text/html', b.index(params));
})

app.get('/web/legal', (req, res) => {
    var params = utils.parseQueryString(req._parsedUrl.query);
    bres(res, 200, 'text/html', b.legal(params));
})

app.get('/web/favicon.ico', (req, res) => {
    res.status(200);
    res.setHeader('Content-type', 'image/x-icon');
    fs.createReadStream('./icon/favicon.ico').pipe(res, end=true);
})

app.get('/web/css', (req, res) => {
    var params = utils.parseQueryString(req._parsedUrl.query);
    var path = params.small ? "./web/small.css" : "./web/style.css";
    res.status(200);
    res.setHeader('Content-type', 'text/css');
    fs.createReadStream(path).pipe(res, end=true);
})

app.get('/web/search', (req, res) => {
    var params = utils.parseQueryString(req._parsedUrl.query);
    var valid = ares(res, "query" in params, 'No query specified')
        && ares(res, params.query.length >= 3, 'Query length should be at least 3')
    if (!valid) return;

    c.search(params.query, ['SONG']).then(info => {
    // fs.promises.readFile("debug/search.json").then(info => {
        // info = JSON.parse(info)
        fs.writeFileSync("debug/search.json", JSON.stringify(info))
        bres(res, 200, 'text/html', b.searchResults(params, info));
    }).catch(err => {
        eres(res, err)
    })
})

app.get('/web/play/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    var obj = { id };
    var params = utils.parseQueryString(req._parsedUrl.query);
    for (var [ key, value ] of Object.entries(params)) {
        obj[key] = value;
    }

    c.EU(obj)
    // fs.promises.readFile("debug/eu.json")
    .then(info => {
        // info = JSON.parse(info.toString())
        fs.writeFileSync("debug/eu.json", JSON.stringify(info));
        bres(res, 200, 'text/html', b.player(params, info));
    }).catch(err => {
        eres(res, err)
    })
})

app.get('/web/eudc/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    var obj = { id };
    var params = utils.parseQueryString(req._parsedUrl.query);
    for (var [ key, value ] of Object.entries(params)) {
        obj[key] = value;
    }

    c.initiateEUDC(obj)
    .then(info => {
        bres(res, 200, 'text/html', b.waiter(params, info));
    }).catch(err => {
        eres(res, err);
    });
})

app.get('/web/download/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    c.ddb.loadState(id)
    .then(obj => {
        if (obj && obj.progress == 2000) {
            // serving mp3 file
            var path = `./streams/${id}.mp3`;
            var contentLength = fs.statSync(path).size;
            res.status(200);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Disposition', 'attachment');
            res.setHeader('Content-Length', contentLength);
            res.set('Transfer-Encoding', 'chunked');
            fs.createReadStream(path).pipe(res);
        } else {
            bres(res, 404, 'text/plain', 'Video not downloaded')
        }
    }).catch(err => {
        eres(res, err)
    })
});

app.get('/web/down', (req, res) => {
    var params = utils.parseQueryString(req._parsedUrl.query);

    c.ddb.loadAll()
    .then(results => {
        bres(res, 200, 'text/html', b.downloads(params, results));
    }).catch(err => {
        eres(res, err)
    })
})

app.get('/web/album/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{17}$/), 'Invalid album id')
    if (!valid) return;

    var obj = { id };
    var params = utils.parseQueryString(req._parsedUrl.query);
    for (var [ key, value ] of Object.entries(params)) {
        obj[key] = value;
    }

    c.getAlbum(obj)
    // fs.promises.readFile('debug/album.json')
    .then(album => {
        fs.writeFileSync('debug/album.json', JSON.stringify(album))
        // album = JSON.parse(album)
        bres(res, 200, 'text/html', b.album(params, album));
    }).catch(err => {
        eres(res, err)
    });
})

app.get('/web/img', (req, res) => {
    var params = utils.parseQueryString(req._parsedUrl.query);
    var url = params.url;
    var valid = ares(res, url, 'No url provided');
    if (!valid) return;

    ww.get(
        "thumbnail", "png",
        url,
        { responseType: 'stream' }
    ).then(axres => {
        res.status(200);
        axres.pipe(res, end=true);
    }).catch(err => {
        eres(res, err)
    })
})

const httpServer = http.createServer(app);
httpServer.listen(PORT, "::", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
