const express = require('express');
const http = require('http');
const fs = require('fs');
const app = express();
app.use(express.json())
const PORT = process.env.NODE_PORT || 8000;
const YTMClient = require("./youtube_extractor")

const MYSQL_ROOT_PASSWORD = fs.existsSync("mysql_root_password.txt")
    ? fs.readFileSync("mysql_root_password.txt")
    : process.env.MYSQL_ROOT_PASSWORD;

// HTTPS credentials
// const privateKey = fs.readFileSync('server.key', 'utf8');
// const certificate = fs.readFileSync('server.cert', 'utf8');
// const credentials = { key: privateKey, cert: certificate };

const c = new YTMClient({
    host: 'localhost',
    user: 'root',
    password: MYSQL_ROOT_PASSWORD,
    database: 'mew'
})
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
    c.searchSuggestions(query).then(results => {
        jres(res, results)
    }).catch(err => {
        console.log(err)
        bres(res, 500, 'text/plain', err.toString())
    })
})

app.get('/api/search/:query', (req, res) => {
    const query = req.params.query;
    c.search(query).then(results => {
        jres(res, results)
    }).catch(err => {
        console.log(err)
        bres(res, 500, 'text/plain', err.toString())
    })
})

app.post('/api/extract_video/', (req, res) => {
    var valid = ares(res, "info" in req.body, 'No "info" field provided')
        && ares(res, "id" in req.body.info, 'No "id" field provided')
        && ares(res, req.body.info.id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    c.extractVideo(req.body.info).then(info => {
        jres(res, info)
    }).catch(err => {
        bres(res, 500, 'text/plain', err.toString())
    })
    // const info = req.params.id;
    // res.setHeader('Content-Type', 'audio/mpeg');
    // res.setHeader('Content-Disposition', 'attachment');
    // c.downloadVideo({ id }, res, (progress) => {})
})

const httpServer = http.createServer(app);
httpServer.listen(PORT, "::", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
