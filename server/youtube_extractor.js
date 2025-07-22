const fs = require('fs')
const cp = require('child_process');
const pg = require('pg');

const PlayerDB = require('./player_db');
const DownloadsDB = require('./downloads_db');
const YTSearchParser = require('./youtube_search_parser')
const YTPlayer = require('./youtube_player')
const utils = require('./utils');
const PaletteDB = require('./palette_db');

class YTMClient {
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
        this.ww = new utils.WebWrapper();
        this.parser = new YTSearchParser();

        this.baseContext = {
            "client": {
                "hl": "fr",
                "gl": "GB",
                "remoteHost": "88.166.99.84",
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0,gzip(gfe)",
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20250514.03.00",
                "originalUrl": "https://music.youtube.com/?cbrd=1",
                "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        }

        this.baseHeaders = {
            'X-YouTube-Client-Name': '7',
            'X-YouTube-Client-Version': '7.20250521.15.00',
            'Origin': 'https://www.youtube.com',
            'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)',
            'content-type': 'application/json',
            'X-Goog-Visitor-Id': 'CgstXzB5X3dIaS1fMCjsjtjBBjInCgJGUhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiAu'
        }

        this.INNERTUBE_CLIENT_VERSION = '';
    }

    async init() {
        // Initializes the database and creates the necessary folders.

        this.mysqlConnection = new pg.Client(this.dbConfig);
        await this.mysqlConnection.connect();
        this.pdb = new PlayerDB(this.mysqlConnection);
        this.ddb = new DownloadsDB(this.mysqlConnection);
        this.paletteDB = new PaletteDB(this.mysqlConnection);

        this.pdb.init();
        this.ddb.init();
        this.paletteDB.init();

        for (const folder of [
            "streams",
            "tmp",
            "debug",
            "testing",
            "thumbs"
        ]) {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder)
            }
        }
        console.log("Connected to database.")
    }
    
    generateContext() {
        var context = {
            "client": {
                "hl": "en", 
                "gl": "FR", 
                "userAgent": "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)",
                "clientName": "TVHTML5",
                "originalUrl": "https://www.youtube.com/tv",
                "webpSupport": false,
                "tvAppInfo": {"appQuality": "TV_APP_QUALITY_FULL_ANIMATION"},
                "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "clientVersion": this.INNERTUBE_CLIENT_VERSION
            }
        };

        return context;
    }

    searchSuggestions(query) {
        // Fetches search suggestions for the given query.
        // The returned Promise resolves on an object containing two fields :
        //  - extendedQueries : a list of pairs containing a bold text and a completion
        //  - musicResults : a list of music results

        return new Promise((resolve, reject) => {
            if (query.length < 3) {
                return reject("Error: query length should be at least 3.")
            }

            this.ww.post(
                "yti_searchsuggestions", "json",
                "https://music.youtube.com/youtubei/v1/music/get_search_suggestions?prettyPrint=false",
                {
                    input: query,
                    context: this.baseContext
                }
            ).then(data => {
                try {
                    var cts = data.contents;

                    // extended queries (query autocompletions)
                    let extendedQueries = [];
                    cts[0].searchSuggestionsSectionRenderer.contents.forEach(queryObj => {
                        extendedQueries.push(queryObj.searchSuggestionRenderer.suggestion.runs.map(run => {
                            return run.text
                        }))
                    })

                    // music results (quick video and albums results)
                    let musicResults = [];
                    cts[1].searchSuggestionsSectionRenderer.contents.forEach(musicObj => {
                        var renderer = musicObj.musicResponsiveListItemRenderer;
                        var musicResult = this.parser.extractRendererInfo(renderer);
                        if (musicResult) musicResults.push(musicResult);
                    })

                    resolve({
                        extendedQueries,
                        musicResults
                    })
                } catch(err) {
                    reject(err)
                }
            }).catch(reject)
        })
    }

    search(query, additional=[]) {
        // Fetches search results for the given query.
        // The returned Promise resolves on an object containing fields such as SONG, ARTIST, ALBUM, etc.
        // Each field value is an array of music results.
        // For each type contained in additional, more results are fetched.

        return new Promise((resolve, reject) => {
            this.ww.post(
                "yti_search", "json",
                "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
                {
                    query: query,
                    context: this.baseContext
                },
            ).then(data => {
                var results = [];
                var endpoints;
                
                try {
                    endpoints = this.parser.search(data, results);
                } catch(err) { reject(err); }

                // intersect endpoint types and additional list.
                var additionalTypes = Object.keys(endpoints).filter(v => additional.includes(v));

                Promise.all(
                    additionalTypes.map(type =>
                        this.ww.post(
                            "yti_search_add", "json",
                            "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
                            {
                                context: {
                                    ...this.baseContext,
                                    clickTracking: { clickTrackingParams: endpoints[type].clickTrackingParams }
                                },
                                ...endpoints[type].searchEndpoint,
                            }
                        )
                    )
                ).then(responses => {
                    for (var i = 0; i < responses.length; i++) {
                        var type = additionalTypes[i];
                        var data = responses[i];
                        this.parser.extractAdditionalResults(data, results, type);
                    }
                    resolve(results)
                }).catch(reject);
            }).catch(reject)
        })
    }

    getYtcfg() {
        // Extracts YouTube Configuration object for later authorizations.

        return new Promise((resolve, reject) => {
            this.ww.get(
                "tv", "html",
                "https://www.youtube.com/tv",
                {
                    headers: { 'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version' }
                }
            ).then(html => {
                var cvMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"([0-9\.]+)[^0-9\.]/);
                if (!cvMatch) return reject("Error downloading ytcfg: client version not found in html");

                this.INNERTUBE_CLIENT_VERSION = cvMatch[1];

                resolve()
            })
        })
    }

    getPlayer(id) {
        return new Promise((resolve, reject) => {
            this.ww.get(
                "watch", "html",
                "https://music.youtube.com/watch?v=" + id,
                {
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0" }
                },
            )
            .then(html => {
                var playerMatch = html.match(/\/s\/player\/([a-z0-9]{8})\/player_ias\.vflset\/([a-z]{2}_[A-Z]{2})\/base\.js/);
                if (!playerMatch) return reject("Error downloading player: player URL not found in html");

                // var ytiprIndex = html.indexOf('var ytInitialPlayerResponse = {');
                // if (ytiprIndex != -1) {
                //     obj.ytpir = utils.extractBracketsCode(ytiprIndex + 31, html);
                // }

                var player = new YTPlayer(playerMatch[1], playerMatch[2]);
                player.downloadAndParse(this.pdb).then(() => {
                    resolve(player);
                }).catch(reject)
            })
        })
    }

    downloadQueue(videoId, queueId) {
        return new Promise((resolve, reject) => {
            if (!queueId) return resolve([]);

            this.ww.post(
                "yti_next_queue", "json",
                "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
                {
                    "enablePersistentPlaylistPanel": true,
                    "tunerSettingValue": "AUTOMIX_SETTING_NORMAL",
                    "playlistId": queueId,
                    "isAudioOnly": true,
                    "responsiveSignals": {
                        "videoInteraction": [
                            {
                                "queueImpress": {},
                                "videoId": videoId,
                                "queueIndex": 0
                            }
                        ]
                    },
                    context: this.baseContext
                },
                { headers: this.baseHeaders }
            )
            .then(data => {
                try {
                    var results = [];
                    for (const entry of data.contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents) {
                        try {
                            var renderer = entry.playlistPanelVideoRenderer;
                            results.push(this.parser.extractQueueRendererInfo(renderer));
                        } catch(err) {
                            console.error(err)
                            continue;
                        }
                    }
                    resolve(results);
                } catch(err) {
                    console.error(err)
                    resolve([])
                }
            }).catch(reject)
        })
    }

    getYtipr(id, player, retry=true) {
        // try a download. If it fails, retries after downloading ytcfg

        return new Promise((resolve, reject) => {
            this.ww.post(
                "yti_player", "json",
                "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                {
                    "context": this.generateContext(),
                    "videoId": id,
                    "playbackContext": {"contentPlaybackContext": {"html5Preference": "HTML5_PREF_WANTS", "signatureTimestamp": player.sts}}, 
                },
                {
                    headers: {
                        ...this.baseHeaders,
                        'X-YouTube-Client-Version': this.INNERTUBE_CLIENT_VERSION
                    }
                }
            )
            .then(resolve)
            .catch(err => {
                if (retry) {
                    this.getYtcfg().then(() => {
                        this.getYtipr(id, player, false).then(resolve).catch(reject);
                    }).catch(reject)
                } else {
                    reject(err);
                }
            })
        })
    }

    downloadVideoData(id, player) {
        // Downloads video data as JSON object, including locked formats

        return new Promise((resolve, reject) => {
            Promise.all([
                this.getYtipr(id, player),
                this.ww.post(
                    "yti_next_single", "json",
                    "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
                    {
                        "videoId": id,
                        context: this.baseContext
                    },
                    { headers: this.baseHeaders }
                )
            ])
            .then(data => {
                var info = {
                    id: data[0].videoDetails.videoId,
                    title: data[0].videoDetails.title,
                    artist: data[0].videoDetails.author,
                    views: data[0].videoDetails.viewCount,
                    duration: parseInt(data[0].videoDetails.lengthSeconds),
                    thumbnails: data[0].videoDetails.thumbnail.thumbnails,
                    formats: data[0].streamingData.formats.concat(data[0].streamingData.adaptiveFormats)
                        // .filter(fmt => fmt.mimeType.includes("audio/webm"))
                };

                try {
                    var entry = data[1].contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents[0];
                    var renderer = entry.playlistPanelVideoRenderer;
                    var result = this.parser.extractQueueRendererInfo(renderer);
                    for (var [ key, value ] of Object.entries(result)) {
                        info[key] = value;
                    }
                } catch(err) {
                    console.error(err)
                }

                resolve(info)
            }).catch(reject)
        })
    }

    browse(continuation = {}, depth = 0) {
        return new Promise((resolve, reject) => {
            var url = 'continuation' in continuation && 'clickTrackingParams' in continuation
                ? "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&type=next&continuation=" + continuation.continuation + "&itct=" + continuation.clickTrackingParams
                : "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&type=next";

            this.ww.post(
                "yti_browse_" + depth, "json",
                url,
                { context: this.baseContext },
                { headers: this.baseHeaders },
            ).then(json => {
                var continuation;
                try {
                    continuation = depth == 0 
                        ? json.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.continuations[0].nextContinuationData
                        : json.continuationContents.sectionListContinuation.continuations[0].nextContinuationData;
                } catch(err) {
                    return reject(err);
                }

                var contents = depth == 0
                    ? json.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents
                    : json.continuationContents.sectionListContinuation.contents;

                var results = this.parser.parseBrowsingResults(contents);
                if (depth == 2) {
                    resolve(results);
                } else {
                    this.browse(continuation, depth+1)
                    .then(followingResults => {
                        resolve(results.concat(followingResults))
                    })
                    .catch(reject);
                }

            }).catch(reject)
        })
    }

    getYTInitialDataFromHtml(url, name) {
        return new Promise((resolve, reject) => {
            this.ww.get(
                name, "html",
                url,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0',
                        'Cookie': 'PREF=guide_collapsed=false&gl=FR&hl=en-GB'
                    }
                },
                // false, true
            )
            .then(html => {
                try {
                    var ytJSCodeMatch = html.match(/try \{(.+);ytcfg\.set/);
                    if (!ytJSCodeMatch) return reject('Could not find initial data in album html');

                    var initialData = eval(`(() => {${ytJSCodeMatch[1]};return initialData;})()`);
                    var data = JSON.parse(initialData.filter(d => d.path == '/browse')[0].data);

                    resolve(data);
                } catch(err) {
                    reject(err);
                }
            })
            .catch(reject)
        })
    }

    getAlbum(info) {
        return new Promise((resolve, reject) => {
            this.getYTInitialDataFromHtml('https://music.youtube.com/browse/' + info.id, "browse_album")
            .then(data => {
                var album = this.parser.extractAlbum(data);
                album.id = info.id;
                resolve(album);
            })
            .catch(reject)
        })
    }

    getArtist(info) {
        return new Promise((resolve, reject) => {
            this.getYTInitialDataFromHtml('https://music.youtube.com/channel/' + info.id, "browse_artist")
            .then(data => {
                fs.writeFileSync("./artist.json", JSON.stringify(data))
                var artist = this.parser.extractArtist(data);
                artist.id = info.id;
                resolve(artist);
            })
            .catch(reject)
        })
    }

    getPlaylist(info) {
        return new Promise((resolve, reject) => {
            this.ww.get(
                "browse_playlist", "html",
                'https://music.youtube.com/playlist?list=' + info.id,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0'
                    }
                },
            )
            .then(html => {
                try {
                    var ytJSCodeMatch = html.match(/try \{(.+);ytcfg\.set/);
                    if (!ytJSCodeMatch) return reject('Could not find initial data in playlist html');
    
                    var initialData = eval(`(() => {${ytJSCodeMatch[1]};return initialData;})()`);
                    var data = JSON.parse(initialData.filter(d => d.path == '/browse')[0].data);
                    fs.writeFileSync('./testing/ytInitialData.json', JSON.stringify(data));
    
                    var playlist = this.parser.extractPlaylist(data);
                    playlist.id = info.id;
    
                    resolve(playlist);
                } catch(err) {
                    reject(err);
                }
            })
        })
    }

    EU(info) {
        // Extracts and unlocks video data from id.
        // The returned Promise resolves on an object containig two fields :
        //  - video : an object with the extracted data and formats
        //  - queue : a list

        return new Promise((resolve, reject) => {
            if (!("id" in info)) return reject("No id provided");

            console.log(`${new Date().toLocaleString()} EU ${info.id}`)

            Promise.all([
                this.getPlayer(info.id),
                this.downloadQueue(info.id, info.queueId),
            ]).then(res => {
                var [ player, queue ] = res;
                this.downloadVideoData(info.id, player)
                .then(extractedInfo => {
                    // unlocking stream urls
                    var failedDecryptions = 0;
                    extractedInfo.formats.forEach(fmt => {
                        try {
                            fmt.url = player.decryptFormatStreamUrl(fmt)
                        } catch(err) {
                            failedDecryptions++;
                        }
                    });
                    if (failedDecryptions > 0) console.error(`Unable to decypher stream urls for ${failedDecryptions} formats`)

                    // cleaning formats
                    extractedInfo.formats = extractedInfo.formats.map(fmt => {
                        return {
                            url: fmt.url,
                            bitrate: fmt.bitrate,
                            mimeType: fmt.mimeType
                        }
                    });

                    extractedInfo.stream = utils.chooseFormat(extractedInfo.formats);
                    delete extractedInfo.formats;

                    for (var [ key, value ] of Object.entries(info)) {
                        if (!info.key) extractedInfo[key] = value
                    }

                    resolve({
                        video: extractedInfo,
                        queue
                    })
                }).catch(reject);
            }).catch(reject);
        })
    }

    DC(info, onProgress = () => {}) {
        // Downloads audio stream and thumbnail from the extractedInfo.
        // Converts it to mp3 and adds metadata.
        // The returned Promise object resolves on a string : the path to the mp3 file.

        console.log(JSON.stringify(info))

        return new Promise((resolve, reject) => {
            var fmt;
            try {
                fmt = utils.chooseFormat(info.formats);
            } catch(err) {
                fmt = info.stream;
            }
            var thb = utils.chooseThumbnail(info.thumbnails);

            var streamPath = `./streams/${info.id}.webm`;
            var outPath = `./streams/${info.id}.mp3`;
            var thumbnailPath = `./thumbs/${info.id}.png`;

            Promise.all([
                utils.downloadFile(fmt.url, streamPath, { "Range": "bytes=0-" }, progress => {
                    onProgress(Math.floor(progress*1000))
                }),
                utils.downloadFile(thb.url, thumbnailPath),
            ]).then(() => {
                onProgress(1000);

                var ffmpegArgs = [
                    '-y',
                    '-i', streamPath, // Lire à partir du flux d'entrée standard
                    '-i', thumbnailPath,
                    '-map', '0:0', // Mapper l'audio
                    '-map', '1:0', // Mapper la pochette
                    '-c:v', 'copy', // Copier le flux vidéo (la pochette)
                    '-id3v2_version', '3', // Utiliser ID3v2.3 pour les métadonnées
                    '-metadata:s:v', 'title="Album cover"',
                    '-metadata:s:v', 'comment="Cover (front)"',
                    '-metadata', `title=${info.title}`,
                    '-metadata', `artist=${info.artist}`,
                    '-metadata', `album=${info.album || info.id}`,
                    // '-map_metadata', '0:s:0',
                    // '-b:a', '192k', // Débit binaire audio
                    '-f', 'mp3', // Format de sortie
                    outPath // Écrire vers le flux de sortie standard
                ];

                var ffmpegProcess = cp.spawn('ffmpeg', ffmpegArgs);

                let totalTime;
                var parseTime = timeString => parseInt(timeString.replace(/:/g, ''))
                ffmpegProcess.stderr.on('data', (data) => {
                    data = data.toString();
                    if (data.includes("Duration:") && data.includes("webm")) {
                        var durationMatch = data.match(/Duration: ([0-9]+:[0-9]+:[0-9]+.[0-9]+)/);
                        if (durationMatch) totalTime = parseTime(durationMatch[1]);
                    }
                    if (data.includes('time=')) {
                        var progressMatch = data.match(/time=([0-9]+:[0-9]+:[0-9]+.[0-9]+)/);
                        if (progressMatch) {
                            var time = parseTime(progressMatch[1])
                            var progress = time / totalTime;
                            onProgress(1000+Math.floor(progress*1000));
                            // console.log(progress)
                        }
                    }
                });

                ffmpegProcess.on('close', (code) => {
                    if (code == 0) {
                        fs.unlinkSync(streamPath);
                        onProgress(2000);
                        resolve(outPath);
                    }
                    else reject("ffmpeg exited with code " + code);
                });

                ffmpegProcess.on('error', (err) => {
                    reject(`FFmpeg process error: ${err}`);
                });
            })
        })
    }

    EUDC(info) {
        // Extracts, unlocks, downloads and converts video to mp3 file.
        // The returned Promise resolves on a string : the path to the mp3 file.

        return new Promise((resolve, reject) => {
            this.EU(info)
            // fs.promises.readFile("testing/info.json")
            .then(info => {
                // info = JSON.parse(info.toString())
                this.DC(info.video)
                .then(resolve)
                .catch(reject);
            }).catch(reject)
        })
    }

    initiateEUDC(info) {
        // Initiates extraction, unlocking, download and conversion of video to mp3 file.
        // The returned Promise resolves with the info when the video data is extracted.

        return new Promise((resolve, reject) => {
            this.ddb.loadState(info.id)
            .then(dobj => {
                if (dobj) return resolve({ video: dobj });
                this.EU(info)
                // fs.promises.readFile("testing/info.json")
                .then(info => {
                    // info = JSON.parse(info.toString());
                    var { video, queue } = info;

                    // choose the smallest thumbnail for database
                    video.smallThumb = video.thumbnails.sort((fmt1, fmt2) => fmt1.width - fmt2.width)[0].url;
                    video.progress = 0;

                    this.ddb.addDownload(video)
                    .then(() => {
                        resolve(info);
                        this.DC(video, progress => {
                            this.ddb.updateProgress(video.id, progress)
                            .catch(console.error)
                        }).catch(console.error);
                    }).catch(reject);
                }).catch(reject);
            }).catch(reject);
        })
    }

    extractColors(id, url, forceDownload=false) {
        return new Promise((resolve, reject) => {
            this.paletteDB.loadPalette(id).then(palette => {
                resolve(palette);
            }).catch(() => {
                this.ww.thumbnail(id, url, forceDownload).then(path => {
                    utils.colorPalette(path)
                    .then(palette => {
                        this.paletteDB.savePalette(id, palette);
                        resolve(palette);
                    })
                    .catch((err) => {
                        if (!forceDownload) {
                            this.extractColors(id, url, true)
                            .then(resolve)
                            .catch(reject)
                        } else {
                            reject(err);
                        }
                    })
                    .finally(() => {
                        fs.unlink(path, err => {
                            if (err) console.error(err);
                            else console.log('  -> thumbnail deleted');
                        });
                    })
                });
            });
        })
    }
}

module.exports = YTMClient;

// const MYSQL_CONFIG = JSON.parse(fs.readFileSync("./mysql_config.json"));
// var c = new YTMClient(MYSQL_CONFIG);
// c.getArtist({ id: "UCIl91Kkscr0sc2pqg9WwYwA" })
// .then(res => {
//     console.log(res)
//     // console.log(res[res.length-2])
//     // fs.writeFileSync('testing/albumdata.json', JSON.stringify(res))
// }).catch(console.error)
