const fs = require('fs');

var utils = require('./../utils')

class HTMLBuilder {
    constructor() {
        this.css = fs.readFileSync('./web/style.css').toString()
    }

    generatePage(params, title, html) {
        var styleRef = params.small ? "/web/css?small=true" : "/web/css"
        var realHTML = `<!DOCTYPE html><html><head><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta charset="utf-8"/><link rel="stylesheet" href="${styleRef}"/></head><body>${html}</body></html>`;
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
        return `<div>
            <img width="120" src="${video.smallThumb}"/><br>
            <div class="info"><span><b>${video.title}</b></span><br>
            <span>${video.artist}</span><br>
            <span><i>${video.album}</i></span><br>
            ${state}</div>
        </div>`
    }

    index(params) {
        var deviceInput = params.small ? `<input type="hidden" name="small" value="true">` : ''
        return this.generatePage(params, "Mew", `<div class="center"><h1>Welcome to Mew</h1><h2>Search YouTube Music</h2><form action="/web/search">${deviceInput}<input type="text" name="query"><input type="submit" value="Search"></form><a href="/web/down">Downloaded Songs</a></div>`)
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
                : `<a class="${classStr}" href="/web/play/${r.id}?${downloadParams.join('&')}"><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${utils.mds}<span><i>${r.album}</i></span>${this.songDetailsSpan(r)}</div></a>`
        }

        if (r.type == "VIDEO") {
            var downloadParams = [];
            for (var type of [ 'title', 'artist', 'queueId' ]) {
                if (r[type]) downloadParams.push(type + '=' + encodeURIComponent(r[type]));
            }

            return params.small 
                ? `<div class="${classStr}"><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/eudc/${r.id}?${downloadParams.join('&')}"><span><b>${r.title}</b></span>${this.songDetailsSpan(r)}</a></div>`
                : `<a class="${classStr}" href="/web/play/${r.id}?${downloadParams.join('&')}"><img src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info"><span><b>${r.title}</b></span>${this.songDetailsSpan(r)}</div></a>`
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
        var html = `Search results for <span style="text-decoration:underline">${params.query}</span> :
            <form action="/web/search"><input type="text" name="query" value="${params.query}"><input type="submit" value="Search"></form>`;
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
        html += `<div class="holder">${rbhtml}</div>`
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
        return this.generatePage(params, "Mew - Album", `<div style="display:flex;gap:1rem;"><div><span><b><i>${album.title}</i></b></span><br><span><b>${album.artist}</b></span><br><span>${album.year}</span><br><img src="${utils.chooseThumbnail(album.thumbnails, 120).url}"/></div><div class="albumSongs">${album.songs.map(song => this.generateAlbumSongDiv(album, song)).join('<br>')}</div></div>`)
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

    player(params, info) {
        var { video, next } = info;
        var infoBlock = `<img id="pimg"/><div class="playerInfo"><span class="title" id="ptitle">${video.title}</span><span class="artist" id="partist"></span><span class="album" id="palbum"></span></div>`;
        var audioPlayer = `<audio controls autoplay id="paudio"><source src="" type="audio/webm" id="paudiosource">Your browser does not support the audio element.</audio>`;
        var queueBlock = `<div class="queueBlock holder"><h3>Playing next</h3>${next.slice(0,16).map(v => this.generateQueueResultDiv(params, v)).join('')}</div>`
        var js = fs.readFileSync("./web/player.js").toString();
        var script = `<script>${js.replace("XVIDEOX", JSON.stringify(video)).replace("XNEXTX", JSON.stringify(next))}</script>`
        return this.generatePage(params, 'Mew - Player', `<div class="player">${infoBlock}${audioPlayer}</div>${queueBlock}${script}`);
    }
}

module.exports = HTMLBuilder;