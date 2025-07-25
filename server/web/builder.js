const fs = require('fs');

var utils = require('./../utils');

const agg = (elements, separator) => elements.map(element => {
    if (!element) return null;
    if (typeof(element) == 'string') return element;
    let [balise, content, attributes={}] = element;
    if (!content) return null;
    let attributesStr = Object.entries(attributes).map(([key, val]) => ` ${key}="${val}"`).join('');
    return `<${balise}${attributesStr}>${content}</${balise}>`
}).filter(str => str != null).join(separator)

class HTMLBuilder {
    constructor() {
        this.css = fs.readFileSync('./web/style.css').toString();
        this.recentJS = fs.readFileSync("./web/recent.js").toString();
        this.resizeJS = `document.addEventListener('DOMContentLoaded', function() {
            var footer = document.querySelector('footer');
            var r = document.querySelector(':root');
            function adjustContentPadding() {
                var footerHeight = footer.offsetHeight;
                r.style.setProperty('--fh', footerHeight + 'px');
            }
            adjustContentPadding();
            window.addEventListener('resize', adjustContentPadding);
        });`;
    }

    generatePage(params, title, html, scrollable=true) {
        let fullHtml = params.small 
            ? `<!DOCTYPE html><html><head><title>${title}</title><meta charset="utf-8"/><link rel="stylesheet" href="/web/css?small=true"/></head><body>${html}</body></html>`
            : `<!DOCTYPE html><html><head><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta charset="utf-8"/><link rel="stylesheet" href="/web/css"/><link rel="icon" type="image/x-icon" href="/web/favicon.ico"></head><body><div id="b" ${scrollable ? `class="scrollable"` : ""}>${html}</div><script src="https://kit.fontawesome.com/670ffa8591.js" crossorigin="anonymous"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js"></script><footer><span><a href="/web">Home</a></span><span><a href="https://github.com/romain-lelaidier/mew" target="_blank">GitHub</a></span><span>MIT License · 2025</span><span><a href="mailto:romain.lelaidier@etu.minesparis.psl.eu">Contact</a></span><span><a href="/web/legal">Legal</a></span></footer><script>${this.resizeJS}</script></body></html>`;

        if (!params.baseURL) return fullHtml;
        return fullHtml
            .replaceAll('/web/', params.baseURL + '/web/')
            .replaceAll('/api/', params.baseURL + '/api/');
    }

    generateSearchBar(params, defaultText='') {
        var deviceInput = params.small ? `<input type="hidden" name="small" value="true">` : '';
        return `<form action="/web/search">${deviceInput}<input type="text" name="query" value="${defaultText}" placeholder="Search"><button type="submit"><div class="fa-solid fa-magnifying-glass"></div></button></form>`
    }

    index(params) {
        return this.generatePage(
            params,
            "Mew",
            `<div class="center" id="c">
                <h1>Welcome to Mew</h1>
                <h3>A minimalist YouTube Music player</h3>
                ${this.generateSearchBar(params)}
                ${params.small ? `<a href="/web/down">Downloaded Songs</a>` : ''}
                <span><a href="/web/browse">Browse Trending</a><!--${utils.mds}<a href="/web/url">Play from URL</a>--></span>
                <br/><br/>
                <span id="restriction">This website is strictly restricted to its contributors.<br/>Users acknowledge that using this tool may be subject to third-party terms of service, including those of YouTube. By proceeding, users accept full responsibility for their actions and any resulting consequences.</span>
                ${params.small ? '' : `<div class="holder" id="recent"></div><script>${this.recentJS}</script>`}
            </div>`
        )
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
            ? `<div class="song"><img loading="lazy" src="${r.smallThumb}"/><span><b>${r.title}</b></span><br><span>${r.artist}</span><br><span><i>${r.album}</i></span><br>${state}</div>`
            : `<a class="song" ${r.progress == 2000 ? `href="/web/download/${r.id}"` : ""}><img loading="lazy" src="${r.smallThumb}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${utils.mds}<span><i>${r.album}</i></span>${r.progress == 2000 ? '' : state}</div></a>`
    }

    urlPage(params) {
        return this.generatePage(params, "Mew", fs.readFileSync("./web/url.html"));
    }

    songDetailsSpan(r) {
        var songDetails = [];
        if ('year' in r) songDetails.push(r.year.toString())
        if ('duration' in r) songDetails.push(utils.durationToString(r.duration));
        if ('viewCount' in r) songDetails.push(utils.viewsToString(r.viewCount));
        return songDetails.length > 0 ? '<span>' + songDetails.join(utils.mds) + '</span>' : '';
    }

    generateResultDiv(params, r) {
        var classNames = [ r.type.toLowerCase() ];
        if (r.top) classNames.push('top');
        var classStr = classNames.join(' ');

        if (r.type == "SONG") {
            var downloadParams = 'queueId' in r ? `?queueId=${encodeURIComponent(r.queueId)}` : '';
            var htmlInfo = agg([
                [ "span", r.title, { style: "font-weight:bold"} ],
                agg([
                    ["span", r.artist],
                    ["span", r.album, {style: "font-style: italic"}]
                ], utils.mds),
                this.songDetailsSpan(r)
            ], '<br>');

            return params.small 
                ? `<div class="${classStr}"><img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/eudc/${r.id}${downloadParams}"><span><b>${r.title}</b></span><br><span>${r.artist}</span><br><span><i>${r.album}</i></span>${this.songDetailsSpan(r)}</a></div>`
                : `<a class="${classStr}" href="/web/play/${r.id}${downloadParams}"><img loading="lazy" class="thumbnail" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info">${htmlInfo}</div></a>`
        }

        if (r.type == "VIDEO") {
            var downloadParams = 'queueId' in r ? `?queueId=${encodeURIComponent(r.queueId)}` : '';
            var htmlInfo = agg([
                [ "span", r.title, { style: "font-weight:bold"} ],
                this.songDetailsSpan(r)
            ], '<br>');

            return params.small 
                ? `<div class="${classStr}"><img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/eudc/${r.id}${downloadParams}"><span><b>${r.title}</b></span>${this.songDetailsSpan(r)}</a></div>`
                : `<a class="${classStr}" href="/web/play/${r.id}${downloadParams}"><img loading="lazy" class="thumbnail" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info">${htmlInfo}</div></a>`
        }

        if (r.type == "ALBUM") {
            var htmlInfo = agg([
                [ "span", r.title, { style: "font-weight:bold"} ],
                [ "span", r.artist ],
                agg([
                    ["span", r.year, { style: "opacity:.7" }]
                ], utils.mds)
            ], '<br>');

            return params.small
                ? `<div><img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/album/${r.id}" class="${classStr}"><span><b>${r.title}</b></span></a></div>`
                : `<div><a href="/web/album/${r.id}" class="${classStr}"><img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info">${htmlInfo}</div></a></div>`
        }

        if (r.type == "PLAYLIST") {
            return params.small
                ? `<div><img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/playlist/${r.id}" class="${classStr}"><span><b>${r.title}</b></span></a></div>`
                : `<div><a href="/web/playlist/${r.id}" class="${classStr}"><img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info"><span><b>${r.title}</b></span>${'subtitle' in r ? `<br/><span><i>${r.subtitle}</i></span>` : ''}</div></a></div>`
        }

        if (r.type == "ARTIST") {
            return `<div class="${classStr}"><a href="/web/artist/${r.id}">
                <img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><br>
                <div class="info"><a><span><b>${r.title}</b></span></a></div></a></div>`
        }
    }

    searchResults(params, results) {
        if (params.small) return results.slice(0, 4).map(r => this.generateResultDiv(params, r)).join('');
        let rbhtml = '';
        let typehtml = '';
        let previousType = null;
        let pushHTML = (last = false) => {
            var names = {
                SONG: "Songs",
                VIDEO: "Videos",
                ALBUM: "Albums",
                ARTIST: "Artists",
                PLAYLIST: "Playlists"
            }
            rbhtml += ['ALBUM', 'ARTIST', 'PLAYLIST'].includes(previousType)
                ? `<div class="slider">${typehtml}</div>` 
                : typehtml;
            if (!last) rbhtml += `<h3>${names[r.type]}</h3>`;
            previousType = r.type;
            typehtml = '';
        }
        for (var r of results.slice(0, 20)) {
            if (r.type != previousType) pushHTML();
            typehtml += this.generateResultDiv(params, r)
        }
        pushHTML(true);
        return rbhtml;
    }

    search(params, results) {
        var html = `<div id="c">${this.generateSearchBar(params, params.query)}<div class="holder">${this.searchResults(params, results)}</div></div>`
        return this.generatePage(params, "Mew - Search", html)
    }

    artist(params, artist) {
        let listeners = artist.viewCount ? `<span>${utils.viewsToString(artist.viewCount)} monthly listeners</span>` : ''
        let description = artist.description ? `<h2>About</h2>${artist.description.split('\n').map(t => `<p>${t}</p>`).join('')}` : '';
        let artistbuttons =
            (artist.shufflePlaySID ? `<a class="artistbtn" href="/web/play/${artist.shufflePlaySID}?queueId=${artist.shufflePlayPID}"><i class="fa-solid fa-shuffle"></i> Shuffle</a>` : '') +
            (artist.radioPlaySID ? `<a class="artistbtn" href="/web/play/${artist.radioPlaySID}?queueId=${artist.radioPlayPID}"><i class="fa-solid fa-radio"></i> Radio</a>` : '');
        let artistblock = `<img loading="lazy" src="${utils.chooseThumbnail(artist.thumbnails, 200).url || ''}"><div id="artistinfo"><h1>${artist.title}</h1><div id="artistbuttons">${artistbuttons}${listeners}</div></div>`;

        var html = `<div id="c">${this.generateSearchBar(params, artist.title)}<div class="holder"><div id="artistblock">${artistblock}</div>${this.searchResults(params, artist.results)}${description}</div></div>`
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

    generateAlbumSongDiv(album, song) {
        var songDetails = {
            title: song.title,
            artist: album.artist,
            album: album.title
        }
        var downloadParams = Object.entries(songDetails).map(([ key, value ]) => key + '=' + encodeURIComponent(value)).join('&')
        return `<div><span><a href="/web/eudc/${song.id}?${downloadParams}">${song.index}. <b>${song.title}</b></a></span><span>${this.songDetailsSpan(song)}</span></div>`
    }

    generateQueueResultDiv(params, r) {
        var downloadParams = 'queueId' in r ? `?queueId=${encodeURIComponent(r.queueId)}` : '';

        return params.small 
            ? `<div class="song"><img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><a href="/web/eudc/${r.id}${downloadParams}"><span><b>${r.title}</b></span><br><span>${r.artist}</span><br><span><i>${r.album}</i></span>${this.songDetailsSpan(r)}</a></div>`
            : `<a class="song" href="/web/play/${r.id}${downloadParams}"><img loading="lazy" src="${utils.chooseThumbnail(r.thumbnails, 120).url}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${utils.mds}<span><i>${r.album}</i></span>${this.songDetailsSpan(r)}</div></a>`
    }

    player(params, result, type=null) {
        var infoBlock = `<div id="pimgcontainer"><img loading="lazy" crossorigin="anonymous" src="" id="pimg"/></div><div id="pplayerinfo"><a class="title" id="ptitle" target="_blank"></a><a class="artist" id="partist" target="_blank"></a><a class="album" id="palbum" target="_blank"></a></div>`;
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
        var queueBlock = `<div id="queue">${this.generateSearchBar(params)}<h3>Queue</h3><div id="pqueue" class="holder"></div></div>`
        var js = fs.readFileSync("./web/player.js").toString();

        // var rinfo;
        // if (type == "ALBUM") {
        //     rinfo = { album: info, video: null, queue: null }
        // } else if (type == "PLAYLIST") {
        //     rinfo = { album: info, video: null, queue: null }
        // } else {
        //     rinfo = { album: null, video: info.video, queue: info.queue };
        // }

        var info, queue;
        if (type == "ALBUM" || type == "PLAYLIST") {
            queue = result.songs;
            delete result.songs;
            info = result;
        } else {
            queue = [ result.video ].concat(result.queue)
            info = null;
        }

        var script = `<script>${js.replace("XINFOX", JSON.stringify(info)).replace("XQUEUEX", JSON.stringify(queue))}</script>`;

        return this.generatePage(params, 'Mew - Player', `<div id="c" class="playerbody"><div id="player">${infoBlock}${audioPlayer}</div>${queueBlock}</div><div id="pautoplay">Audio autoplay is blocked.<br/>Please interact with the page to play the audio, and ideally disable autoplay restrictions.<span>Click anywhere to continue</span></div></div>${script}`, false);
    }

    legal(params) {
        var html = fs.readFileSync('./web/legal.html')
        return this.generatePage(params, 'Mew - Legal', html);
    }

    album(params, album) {
        if (params.small) return this.generatePage(params, "Mew - Album", `<div style="display:flex;gap:1rem;"><div><span><b><i>${album.title}</i></b></span><br><span><b>${album.artist}</b></span><br><span>${album.year}</span><br><img loading="lazy" src="${utils.chooseThumbnail(album.thumbnails, 120).url}"/></div><div class="albumSongs">${album.songs.map(song => this.generateAlbumSongDiv(album, song)).join('<br>')}</div></div>`);

        return this.player(params, album, "ALBUM");
    }

    playlist(params, playlist) {
        if (params.small) return this.generatePage(params, "Mew - Playlist", `<div style="display:flex;gap:1rem;"><div><span><b><i>${playlist.title}</i></b></span><br><span><b>${playlist.subtitle}</b></span><br><img loading="lazy" src="${utils.chooseThumbnail(playlist.thumbnails, 120).url}"/></div><div class="playlistSongs">${playlist.songs.map(song => this.generateAlbumSongDiv(playlist, song)).join('<br>')}</div></div>`);

        return this.player(params, playlist, "PLAYLIST");
    }

    browse(params, results) {
        var rbhtml;
        var priorities = [
            'Charts',
            'Hits',
            'Playlists de la communauté populaires',
            'Nouveautés'
        ].reverse();
        function index(t) {
            for (var [i,v] of priorities.entries()) {
                if (t.includes(v)) return i;
            }
            return -1;
        }
        function indexT(t) {
            if (['ALBUM', 'PLAYLIST', 'ARTIST'].includes(t)) return 2;
            return 1;
        }
        results = results.filter(r => r.items.length > 0);
        results = results.sort((a, b) => {
            var ia = index(a.title);
            var ib = index(b.title);
            var ta = indexT(a.items[0].type);
            var tb = indexT(b.items[0].type);
            var i = Math.sign(ib - ia);
            if (i == 0) return Math.sign(tb - ta);
            return i;
        });
        if (params.small) {
            rbhtml = results.slice(0, 4).map(r => this.generateResultDiv(params, r)).join('');
        } else {
            rbhtml = '';
            for (var r of results) {
                var type = r.items[0].type;
                var typehtml = '';
                for (var item of r.items) {
                    typehtml += this.generateResultDiv(params, item)
                }
                rbhtml += `<h3>${r.title}</h3>${['ARTIST','ALBUM','PLAYLIST'].includes(type) ? `<div class="slider">${typehtml}</div>` : typehtml}`;
            }
        }
        var html = `<div id="c">${this.generateSearchBar(params, params.query)}<div class="holder">${rbhtml}</div></div>`
        return this.generatePage(params, "Mew - Browse", html)
    }
}

module.exports = HTMLBuilder;