const express = require('express');
const http = require('http');
const fs = require('fs');
const app = express();
const PORT = process.env.NODE_PORT || 8000;

const utils = require('./utils')
const YTMClient = require('./youtube_extractor')

const MYSQL_CONFIG = JSON.parse(fs.existsSync("./mysql_config.json")
    ? fs.readFileSync("./mysql_config.json")
    : process.env.MYSQL_CONFIG);

// HTTPS credentials
// const privateKey = fs.readFileSync('server.key', 'utf8');
// const certificate = fs.readFileSync('server.cert', 'utf8');
// const credentials = { key: privateKey, cert: certificate };

const c = new YTMClient(MYSQL_CONFIG)
c.init()

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

app.get('/', (req, res) => {
    bres(res, 200, 'text/plain', 'Welcome to the Mew server ! rdn : ' + Math.random())
});

app.get('/api/search_suggestions/:query', (req, res) => {
    const query = req.params.query;

    c.searchSuggestions(query).then(results => {
        fs.writeFileSync(file, JSON.stringify(results));
        jres(res, results)
    }).catch(err => {
        console.log(err)
        bres(res, 500, 'text/plain', err.toString())
    })
})

app.get('/api/search/:query', (req, res) => {
    const query = req.params.query;

    c.search(query).then(results => {
        // fs.writeFileSync(file, JSON.stringify(results.SONG));
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
        bres(res, 500, 'text/plain', err.toString())
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

    c.EU(obj).then(info => {
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
        bres(res, 500, 'text/plain', err.toString())
    })
})

// web server

var loaded = {};
for (const webFile of [ 'index', 'search', 'waiter' ]) {
    loaded[webFile] = fs.readFileSync(`./web/${webFile}.html`).toString();
}

function durationToString(d) {
    const pad = (i, w, s) => (s.length < i) ? pad(i, w, w + s) : s;
    return Math.floor(d / 60) + ':' + pad(2, '0', (d%60).toString())
}

function viewsToString(v) {
    if (Math.floor(v/1e9) > 0) return `${Math.floor(v/1e8)/10}Mds`
    if (Math.floor(v/1e6) > 0) return `${Math.floor(v/1e5)/10}M`
    if (Math.floor(v/1e3) > 0) return `${Math.floor(v/1e2)/10}k`
    return v.toString()
}

function searchResultsToHTML(params, info) {
    var res = `Search results for <span style="text-decoration:underline">${params.query}</span> :<br><br><form action="/web/search"><input type="text" name="query" value="${params.query}"><input type="submit" value="Search"></form>`;
    var songsHTML = "";
    var maxCount = params.small ? 4 : 20;
    for (var r of info.SONG.slice(0, maxCount)) {
        var params = [];
        for (var type of [ 'title', 'artist', 'album' ]) {
            if (r[type]) params.push(type + '=' + encodeURIComponent(r[type]));
        }
        var songDetails = [];
        if ('duration' in r) songDetails.push(durationToString(r.duration));
        if ('views' in r) songDetails.push(viewsToString(r.views));
        songsHTML += `<a href="/web/eudc/${r.id}?${params.join('&')}"><img src="${c.chooseThumbnail(r.thumbnails).url}"/><br><span><b>${r.title}</b></span><br><span>${r.artist}</span><br><span><i>${r.album}</i></span>${songDetails.length > 0 ? '<br><span>' + songDetails.join(' · ') + '</span>' : ''}</a><br><br>`
    }
    var artistsHTML = "";
    for (var r of info.ARTIST.slice(0, maxCount)) {
        artistsHTML += `<a href="/"><img src="${c.chooseThumbnail(r.thumbnails).url}"/><br><span><b>${r.title}</b></span></a><br><br>`
    }
    var albumsHTML = "";
    for (var r of info.ALBUM.slice(0, maxCount)) {
        albumsHTML += `<a href="/"><img src="${c.chooseThumbnail(r.thumbnails).url}"/><br><span><b>${r.title}</b></span></a><br><br>`
    }
    res += `<h2>Songs</h2><div id="SONG">${songsHTML}</div>`
    res += `<h2>Artists</h2><div id="ARTIST">${artistsHTML}</div>`
    res += `<h2>Albums</h2><div id="ALBUM">${albumsHTML}</div>`
    return res;
}

function waiterHTML(params, info) {
    var { video } = info;
    const formatProgress = p => {
        if (p == -1) return "Info extracted";
        if (p == 1000) return "Success";
        if (p >= 0 && p <= 1000) return `Converting (${p/10}%)`;
        return p.toString()
    }
    return `<div>
        <span>State: ${formatProgress(video.progress)}</span><br>
        <a href="/web/download/${video.id}">${video.progress == 1000 ? "Click to download" : ""}</a><br>
        <img width="120" src="${video.thumbnail}"/><br>
        <span><b>${video.title}</b></span><br>
        <span>${video.artist}</span><br>
        <span><i>${video.album}</i></span><br>
    </div>`
}

function changeHTMLLinks(baseURL, html) {
    if (!baseURL) return html;
    return html.replaceAll('/web/', baseURL + '/web/').replaceAll('/api/', baseURL + '/api/')
}

app.get('/web/', (req, res) => {
    var params = utils.parseQueryString(req._parsedUrl.query);
    bres(res, 200, 'text/html', changeHTMLLinks(params.baseURL, loaded.index))
})

app.get('/web/search', (req, res) => {
    var params = utils.parseQueryString(req._parsedUrl.query);
    var valid = ares(res, "query" in params, 'No query specified')
    if (!valid) return;

    c.search(params.query, ['SONG']).then(info => {
    // fs.promises.readFile("debug/search.json").then(info => {
    //     info = JSON.parse(info)
        fs.writeFileSync("debug/search.json", JSON.stringify(info))
        bres(res, 200, 'text/html', changeHTMLLinks(params.baseURL, loaded.search.replace('XXX', searchResultsToHTML(params, info))))
    }).catch(err => {
        bres(res, 500, 'text/plain', 'server error : ' + err.toString())
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
        bres(res, 200, 'text/html', changeHTMLLinks(params.baseURL, loaded.waiter.replace('XXX', waiterHTML(params, info))))
    }).catch(err => {
        bres(res, 500, 'text/plain', 'server error : ' + err.toString())
    });
})

app.get('/web/download/:id', (req, res) => {
    const id = req.params.id;
    var valid = ares(res, id.match(/^[a-zA-Z0-9_-]{11}$/), 'Invalid video id')
    if (!valid) return;

    c.ddb.loadState(id)
    .then(obj => {
        if (obj && obj.progress == 1000) {
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
        bres(res, 500, 'text/plain', 'server error : ' + err.toString())
    })
});

const httpServer = http.createServer(app);
httpServer.listen(PORT, "::", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
