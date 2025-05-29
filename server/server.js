const express = require('express');
const http = require('http');
const fs = require('fs');
const app = express();
app.use(express.json())
const PORT = process.env.NODE_PORT || 8000;
const { YTMClient, parseQueryString } = require("./youtube_extractor")
const DEBUG = process.env.DEBUG || false;

if (DEBUG) {
    console.log("DEBUG MODE")
}

const MYSQL_CONFIG = JSON.parse(fs.existsSync("./mysql_config.json")
    ? fs.readFileSync("./mysql_config.json")
    : process.env.MYSQL_CONFIG);

// HTTPS credentials
// const privateKey = fs.readFileSync('server.key', 'utf8');
// const certificate = fs.readFileSync('server.cert', 'utf8');
// const credentials = { key: privateKey, cert: certificate };

const c = new YTMClient(MYSQL_CONFIG)
c.init()

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

app.get('/', (req, res) => {
    bres(res, 200, 'text/plain', 'Welcome to the Mew server ! rdn : ' + Math.random())
});

app.get('/api/search_suggestions/:query', (req, res) => {
    const query = req.params.query;

    let file = "debug/search_suggestions.json"
    if (DEBUG && fs.existsSync(file)) {
        console.log("search suggestions saved")
        fs.createReadStream(file).pipe(res, end=true)
    } else {
        c.searchSuggestions(query).then(results => {
            fs.writeFileSync(file, JSON.stringify(results));
            jres(res, results)
        }).catch(err => {
            console.log(err)
            bres(res, 500, 'text/plain', err.toString())
        })
    }
})

app.get('/api/search/:query', (req, res) => {
    const query = req.params.query;

    let file = "debug/search.json"
    if (DEBUG && fs.existsSync(file)) {
        console.log("search saved")
        fs.createReadStream(file).pipe(res, end=true)
    } else {
        c.search(query).then(results => {
            fs.writeFileSync(file, JSON.stringify(results));
            jres(res, results)
        }).catch(err => {
            console.log(err)
            bres(res, 500, 'text/plain', err.toString())
        })
    }
})

app.get('/api/convert/:url', (req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'audio/webm');
    fs.createReadStream("testing/test.webm").pipe(res, end=true)
})

app.post('/api/extract_video/', (req, res) => {
    var valid = ares(res, "info" in req.body, 'No "info" field provided')
        && ares(res, "id" in req.body.info, 'No "id" field provided')
        && ares(res, req.body.info.id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    let file = "debug/extract.json"
    if (DEBUG && fs.existsSync(file)) {
        console.log("extract saved")
        fs.createReadStream(file).pipe(res, end=true)
    } else {
        c.extractVideo(req.body.info).then(info => {
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
            bres(res, 500, 'text/plain', err.toString())
        })
    }
})

app.get('/api/extract_video/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    c.extractVideo({ id }).then(info => {
        jres(res, info)
    }).catch(err => {
        console.log(err)
        bres(res, 500, 'text/plain', err.toString())
    })
})

app.get('/api/mp3/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    var obj = { id };
    var params = parseQueryString(req._parsedUrl.query);
    for (var [ key, value ] of Object.entries(params)) {
        obj[key] = value;
    }

    console.log("Downloading", obj)

    c.extractVideoAudioAsMp3(obj).then(stream => {
        res.status(200);
        res.setHeader('Content-type', 'audio/mpeg');
        res.setHeader('Content-disposition', 'attachment');
        stream.pipe(res, end=true);
    }).catch(err => {
        console.log(err)
        bres(res, 500, 'text/plain', err.toString())
    })
})

// web server

var loaded = {};
for (const webFile of [ 'index', 'search' ]) {
    loaded[webFile] = fs.readFileSync(`./web/${webFile}.html`).toString();
}

function searchResultsToHTML(query, info) {
    var res = `Search results for <span style="text-decoration:underline">${query}</span> :<br><br>`;
    for (var r of info.SONG) {
        var params = [];
        for (var type of [ 'title', 'artist', 'album' ]) {
            if (r[type]) params.push(type + '=' + encodeURIComponent(r[type]));
        }
        res += `<a class="sr" href="/api/mp3/${r.id}?${params.join('&')}" style="text-decoration:none"><img height="100px" src="${c.chooseThumbnail(r.thumbnails).url}"/><br><span><b>${r.title}</b></span><br><span>${r.artist}</span><br><span><i>${r.album}</i></span></div><br><br>`
    }
    return res;
}

app.get('/web/', (req, res) => {
    bres(res, 200, 'text/html', loaded.index)
})

app.get('/web/search', (req, res) => {
    var params = parseQueryString(req._parsedUrl.query);
    var valid = ares(res, "query" in params, 'No query specified')
    if (!valid) return;

    c.search(params.query).then(info => {
    // fs.promises.readFile("debug/search.json").then(info => {
        // fs.writeFileSync("debug/search.json", JSON.stringify(info))
        // info = JSON.parse(info)
        bres(res, 200, 'text/html', loaded.search.replace('XXX', searchResultsToHTML(params.query, info)))
    }).catch(err => {
        bres(res, 500, 'text/plain', 'server error : ' + err.toString())
    })
})

const httpServer = http.createServer(app);
httpServer.listen(PORT, "::", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
