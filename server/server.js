const express = require('express');
const http = require('http');
const fs = require('fs');
const app = express();
app.use(express.json())
const PORT = process.env.NODE_PORT || 8000;
const YTMClient = require("./youtube_extractor")
const DEBUG = process.env.DEBUG || false;

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

const httpServer = http.createServer(app);
httpServer.listen(PORT, "::", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
