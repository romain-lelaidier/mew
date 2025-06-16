const fs = require('fs');

var utils = require('./../utils')

class HTMLBuilder {
    constructor() {
        this.css = fs.readFileSync('./web/style.css').toString()
    }

    generatePage(params, title, html) {
        var styleRef = params.small ? "/web/css?small=true" : "/web/css"
        var realHTML = `<!DOCTYPE html><html><head><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta charset="utf-8"/><link rel="stylesheet" href="${styleRef}"/><link rel="icon" type="image/x-icon" href="/web/favicon.ico"></head><body>${html}</body>${params.small ? '' : `<script src="https://kit.fontawesome.com/670ffa8591.js" crossorigin="anonymous"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js"></script><footer><span><a href="/web">Home</a></span><span><a href="https://github.com/romain-lelaidier/mew" target="_blank">GitHub</a></span><span>MIT License · 2025</span><span><a href="mailto:romain.lelaidier@etu.minesparis.psl.eu">Contact</a></span><span><a href="/web/legal">Legal</a></span></footer>`}</html>`;
        return this.changeHTMLLinks(params, realHTML);
    }

    generateDownloadDiv(params, r) {
        const formatProgress = p => {
            if (p < 0 || p > 2000) return p.toString();
            if (p == 0) return "Info extracted";
            if (p < 1000) return `Downloading (${p/10}%)`;
            if (p < 2000) return `Converting (${(p-1000)/10}%)`;
            return "Success"
        }
        var state = r.progress == 2000
            ? `<a href="/web/download/${r.id}">Download MP3</a>`
            : `<span>State: ${formatProgress(r.progress)}</span>`;

        return params.small 
            ? `<div class="song"><img src="${r.smallThumb}"/><span><b>${r.title}</b></span><br><span>${r.artist}</span><br><span><i>${r.album}</i></span><br>${state}</div>`
            : `<a class="song" ${r.progress == 2000 ? `href="/web/download/${r.id}"` : ""}><img src="${r.smallThumb}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${utils.mds}<span><i>${r.album}</i></span>${r.progress == 2000 ? '' : state}</div></a>`
    }

    searchBar(params, defaultText='') {
        var deviceInput = params.small ? `<input type="hidden" name="small" value="true">` : ''
        return `<form action="/web/search">${deviceInput}<input type="text" name="query" value="${defaultText}" placeholder="Search"><button type="submit"><div class="fa-solid fa-magnifying-glass"></div></button></form>`
    }

    index(params) {
        return this.generatePage(params, "Mew", `<div class="center"><h1>Welcome to Mew</h1><h3>A minimalist and ad-free YouTube Music player</h3>${this.searchBar(params)}${params.small ? `<a href="/web/down">Downloaded Songs</a>` : ''}<span id="restriction">This Website is strictly restricted to its owner and to the contributors of RÉZAL.<br/>Users are aware that their usage of this tool violates YouTube's legal conditions. They accept all responsibilities.</span></div>`)
    }

    songDetailsSpan(r) {
        var songDetails = [];
        if ('year' in r) songDetails.push(r.year.toString())
        if ('duration' in r) songDetails.push(utils.durationToString(r.duration));
        if ('viewCount' in r) songDetails.push(utils.viewsToString(r.viewCount));
        return songDetails.length > 0 ? '<br><span>' + songDetails.join(utils.mds) + '</span>' : '';
    }

    generateResultDiv(params, r) {
        var classNames = [ r.type.toLowerCase() ];
        if (r.top) classNames.push('top');
        var classStr = classNames.join(' ')

        if (r.type == "SONG") {
            var downloadParams = [];
            for (var type of [ 'title', 'artist', 'album', 'queueId' ]) {
                if (r[type]) downloadParams.push(type + '=' + encodeURIComponent(r[type]));
            }

            return params.small 
                ? `<div class="${classStr}"><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/eudc/${r.id}?${downloadParams.join('&')}"><span><b>${r.title}</b></span><br><span>${r.artist}</span><br><span><i>${r.album}</i></span>${this.songDetailsSpan(r)}</a></div>`
                : `<a class="${classStr}" href="/web/play/${r.id}?${downloadParams.join('&')}"><img class="thumbnail" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${utils.mds}<span><i>${r.album}</i></span>${this.songDetailsSpan(r)}</div></a>`
        }

        if (r.type == "VIDEO") {
            var downloadParams = [];
            for (var type of [ 'title', 'artist', 'queueId' ]) {
                if (r[type]) downloadParams.push(type + '=' + encodeURIComponent(r[type]));
            }

            return params.small 
                ? `<div class="${classStr}"><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/eudc/${r.id}?${downloadParams.join('&')}"><span><b>${r.title}</b></span>${this.songDetailsSpan(r)}</a></div>`
                : `<a class="${classStr}" href="/web/play/${r.id}?${downloadParams.join('&')}"><img class="thumbnail" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info"><span><b>${r.title}</b></span>${this.songDetailsSpan(r)}</div></a>`
        }

        if (r.type == "ALBUM") {
            return params.small
                ? `<div><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/album/${r.id}" class="${classStr}"><span><b>${r.title}</b></span></a></div>`
                : `<div><a href="/web/album/${r.id}" class="${classStr}"><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info"><span><b>${r.title}</b></span></div></a></div>`
        }

        if (r.type == "ARTIST") {
            return `<div class="${classStr}">
                <img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><br>
                <div class="info"><a><span><b>${r.title}</b></span></a></div></div>`
        }
    }

    searchResults(params, results) {
        var rbhtml;
        if (params.small) {
            rbhtml = results.slice(0, 4).map(r => this.generateResultDiv(params, r)).join('');
        } else {
            rbhtml = '';
            let typehtml = '';
            let previousType = results[0].type;
            let pushHTML = (last = false) => {
                var names = {
                    SONG: "Songs",
                    VIDEO: "Videos",
                    ALBUM: "Albums",
                    ARTIST: "Artists"
                }
                rbhtml += previousType == "ALBUM" || previousType == "ARTIST"
                    ? `<div class="slider">${typehtml}</div>` : typehtml;
                if (!last) rbhtml += `<h3>${names[r.type]}</h3>`;
                previousType = r.type;
                typehtml = '';
            }
            for (var r of results.slice(0, 20)) {
                if (r.type != previousType) pushHTML();
                typehtml += this.generateResultDiv(params, r)
            }
            pushHTML(true);
        }
        var html = `${this.searchBar(params, params.query)}<div class="holder">${rbhtml}</div>`
        return this.generatePage(params, "Mew - Search", html)
    }

    waiter(params, info) {
        var { video } = info;
        var rbhtml = this.generateDownloadDiv(params, video)
        return this.generatePage(params, "Mew - Download", `<a href="/web/down">See other downloads</a><br><a href="/web">Home</a><h1>Downloading</h1>${rbhtml}`)
    }

    downloads(params, videos) {
        var rbhtml = videos.map(v => this.generateDownloadDiv(params, v)).join('')
        return this.generatePage(params, "Mew - Downloads", `<h1>Downloaded Songs</h1><a href="/web">Home</a><div class="holder">${rbhtml}</div>`)
    }

    changeHTMLLinks(params, html) {
        if (!params.baseURL) return html;
        return html.replaceAll('/web/', params.baseURL + '/web/').replaceAll('/api/', params.baseURL + '/api/')
    }

    generateAlbumSongDiv(album, song) {
        var songDetails = {
            title: song.title,
            artist: album.artist,
            album: album.title
        }
        var downloadParams = Object.entries(songDetails).map(([ key, value ]) => key + '=' + encodeURIComponent(value)).join('&')
        return `<div><span><a href="/web/eudc/${song.id}?${downloadParams}">${song.index}. <b>${song.title}</b></a></span><span>${this.songDetailsSpan(song)}</span></div>`
    }

    album(params, album) {
        if (params.small) return this.generatePage(params, "Mew - Album", `<div style="display:flex;gap:1rem;"><div><span><b><i>${album.title}</i></b></span><br><span><b>${album.artist}</b></span><br><span>${album.year}</span><br><img src="${utils.chooseThumbnail(album.thumbnails, 120).url}"/></div><div class="albumSongs">${album.songs.map(song => this.generateAlbumSongDiv(album, song)).join('<br>')}</div></div>`);

        return this.player(params, album, true);
    }

    generateQueueResultDiv(params, r) {
        var downloadParams = [];
        for (var type of [ 'title', 'artist', 'album', 'queueId' ]) {
            if (r[type]) downloadParams.push(type + '=' + encodeURIComponent(r[type]));
        }

        return params.small 
            ? `<div class="song"><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/eudc/${r.id}?${downloadParams.join('&')}"><span><b>${r.title}</b></span><br><span>${r.artist}</span><br><span><i>${r.album}</i></span>${this.songDetailsSpan(r)}</a></div>`
            : `<a class="song" href="/web/play/${r.id}?${downloadParams.join('&')}"><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${utils.mds}<span><i>${r.album}</i></span>${this.songDetailsSpan(r)}</div></a>`
    }

    player(params, info, album=false) {
        var infoBlock = `<div id="pimgcontainer"><img crossorigin="anonymous" src="" id="pimg"/></div><div id="pplayerinfo"><span class="title" id="ptitle"></span><span class="artist" id="partist"></span><span class="album" id="palbum"></span></div>`;
        var audioPlayer = `<div id="playerControls">
        <div id="audioPlayer">
            <audio controls autoplay id="paudio" src="" type="audio/webm"></audio>
            <div id="ptimes"><span id="pcurrenttime">0:00</span><span id="ptotaltime">3:00</span></div>
            <div id="progressContainer"><div id="pbackgroundbar"></div><div id="pbufferedbar"></div><div id="pprogressbar"></div><input type="range" id="pslider" value="0"></div>
        </div>
        <div id="pbuttons">
            <div id="pskipleft" class="pbutton"><div id="pskiplefticon" class="fa-solid fa-backward-step fa-xl"></div></div>
            <div id="pplaypause" class="pbutton"><div id="pplaypauseicon"></div></div>
            <div id="pskip" class="pbutton"><div id="pskipicon" class="fa-solid fa-forward-step fa-xl"></div></div></div>
        </div>`;
        var queueBlock = `<div id="queue">${this.searchBar(params)}<h3>Queue</h3><div id="pqueue" class="holder"></div></div>`
        var js = fs.readFileSync("./web/player.js").toString();

        var rinfo = album
            ? { album: info, video: null, queue: null }
            : { album: null, video: info.video, queue: info.queue };

        var script = `<script>${js.replace("XVIDEOX", JSON.stringify(rinfo.video)).replace("XQUEUEX", JSON.stringify(rinfo.queue)).replace("XALBUMX", JSON.stringify(rinfo.album))}</script>`
        return this.generatePage(params, 'Mew - Player', `<div id="playerbody"><div id="player">${infoBlock}${audioPlayer}</div>${queueBlock}</div>${script}`);
    }

    legal(params) {
        var html = fs.readFileSync('./web/legal.html')
        return this.generatePage(params, 'Mew - Legal', html);
    }
}

module.exports = HTMLBuilder;