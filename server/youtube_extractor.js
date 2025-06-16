const axios = require("axios")
const fs = require('fs')
const cp = require('child_process');
const mysql = require('mysql2/promise');

const PlayerDB = require('./player_db');
const DownloadsDB = require('./downloads_db');
const YTSearchParser = require('./youtube_search_parser')
const YTPlayer = require('./youtube_player')
const utils = require('./utils');

class YTMClient {
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
        this.parser = new YTSearchParser();

        this.baseContext = {
            "client": {
                "hl": "fr",
                "gl": "FR",
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
    }

    async init() {
        // Initializes the database and creates the necessary folders.

        this.mysqlConnection = await mysql.createConnection(this.dbConfig);
        this.pdb = new PlayerDB(this.mysqlConnection);
        this.ddb = new DownloadsDB(this.mysqlConnection);

        this.pdb.init();
        this.ddb.init();

        for (const folder of [
            "streams",
            "thumbs",
            "debug",
            "testing"
        ]) {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder)
            }
        }
        console.log("Connected to database.")
    }
    
    generateContext(ytcfg) {
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
            }
        };

        if (ytcfg && ytcfg.clientVersion) {
            context.client.clientVersion = ytcfg.clientVersion;
        }

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

            axios.post(
                "https://music.youtube.com/youtubei/v1/music/get_search_suggestions?prettyPrint=false",
                {
                    input: query,
                    context: this.baseContext
                }
            ).then(res => {
                if (res.status != 200) return reject("Script error: HTTPS POST status code is " + res.status);

                try {
                    // extracting useful data
                    var cts = res.data.contents;

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
            axios.post(
                "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
                {
                    query: query,
                    context: this.baseContext
                }
            ).then(res => {
                if (res.status != 200) return reject("Could not download search results: status code is " + res.status);

                var musicResults = [];
                var endpoints = this.parser.extractSearchResults(res.data, musicResults);

                // intersect endpoint types and additional list.
                var additionalTypes = Object.keys(endpoints).filter(v => additional.includes(v));

                Promise.all(
                    additionalTypes.map(type =>
                        axios.post(
                            "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
                            {
                                context: {
                                    ...this.baseContext,
                                    clickTracking: {clickTrackingParams: endpoints[type].clickTrackingParams}
                                },
                                ...endpoints[type].searchEndpoint,
                            }
                        )
                    )
                ).then(responses => {
                    for (var i = 0; i < responses.length; i++) {
                        var type = additionalTypes[i];
                        var data = responses[i].data;
                        this.parser.extractAdditionalResults(data, musicResults, type);
                    }
                    resolve(musicResults)
                }).catch(reject);
            }).catch(reject)
        })
    }

    // downloadVideo(video, outputStream, onProgress) {
    //     return new Promise((resolve, reject) => {
    //         this.extractStreamUrlYtDlp(video.id).then(url => {
    //             axios.get(url, {
    //                 responseType: "stream",
    //                 headers: { "Range": "bytes=0-" }
    //             }).then(res => {
    //                 var webmStream = res.data;
    //                 // var webmStream = fs.createReadStream("test.webm")
    //                 // var outputStream = fs.createWriteStream("test3.mp3")
    //                 // let coverImage = "./test.png"

    //                 var ffmpegArgs = [
    //                     '-i', 'pipe:0', // Lire à partir du flux d'entrée standard
    //                     // '-i', coverImage,
    //                     // '-map', '0:0', // Mapper l'audio
    //                     // '-map', '1:0', // Mapper la pochette
    //                     // '-c:v', 'copy', // Copier le flux vidéo (la pochette)
    //                     // '-id3v2_version', '3', // Utiliser ID3v2.3 pour les métadonnées
    //                     // '-metadata:s:v', 'title="Album cover"',
    //                     // '-metadata:s:v', 'comment="Cover (front)"',
    //                     '-metadata', `title=${video.title}`,
    //                     '-metadata', `artist=${video.artist}`,
    //                     '-metadata', `album=${video.album}`,
    //                     // '-map_metadata', '0:s:0',
    //                     // '-b:a', '192k', // Débit binaire audio
    //                     '-f', 'mp3', // Format de sortie
    //                     'pipe:1' // Écrire vers le flux de sortie standard
    //                 ];

    //                 var ffmpegProcess = cp.spawn('ffmpeg', ffmpegArgs);
    //                 webmStream.pipe(ffmpegProcess.stdin);
    //                 ffmpegProcess.stdout.pipe(outputStream);

    //                 let totalTime;
    //                 var parseTime = timeString => parseInt(timeString.replace(/:/g, ''))
    //                 ffmpegProcess.stderr.on('data', (data) => {
    //                     data = data.toString();
    //                     // // Vous pouvez analyser la sortie d'erreur pour obtenir la progression
    //                     if (data.includes("Duration:")) {
    //                         var durationMatch = data.match(/Duration: ([0-9]+:[0-9]+:[0-9]+.[0-9]+)/);
    //                         if (durationMatch) totalTime = parseTime(durationMatch[1]);
    //                     }
    //                     if (data.includes('time=')) {
    //                         var progressMatch = data.match(/time=([0-9]+:[0-9]+:[0-9]+.[0-9]+)/);
    //                         if (progressMatch) {
    //                             var time = parseTime(progressMatch[1])
    //                             onProgress(time / totalTime)
    //                         }
    //                     }
    //                 });

    //                 ffmpegProcess.on('close', (code) => {
    //                     if (code === 0) resolve()
    //                     else reject(code)
    //                 });
    //             });
    //         }).catch(reject)
    //     })
    // }

    // extractStreamUrlYtDlp(id) {
    //     return new Promise((resolve, reject) => {
    //         // return resolve("https://rr1---sn-n4g-ouxz.googlevideo.com/videoplayback?expire=1747707904&ei=oJMraNKzGNbf6dsPx9uM0Qo&ip=2a02%3A842a%3A3c4f%3A7d01%3Ac8e6%3Af162%3A69b6%3A41a&id=o-AIZRHZ1sfbl6EykiztzYr1u42b9He_Vx3O4utUa4ROs-&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&met=1747686304%2C&mh=Tb&mm=31%2C29&mn=sn-n4g-ouxz%2Csn-n4g-jqbe6&ms=au%2Crdu&mv=m&mvi=1&pl=47&rms=au%2Cau&gcr=fr&initcwndbps=2918750&bui=AecWEAatMmfIpanpkhsJMWO_pzRFBBP9e3KsZqyP4jzieaP_EYahR-TLP4vkgyGLl_iabHKNM0VcmoEp&spc=wk1kZofjhcny&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=4408344&dur=261.081&lmt=1714576784227977&mt=1747685815&fvip=6&keepalive=yes&c=IOS&txp=4502434&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cgcr%2Cbui%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRQIhAKSnuQqKbjle528DAbnuK6aXyknoJ9gkocvmnCe-QWnzAiAlPrp_ygOgms2WNEIMTAnwP2C9ElwpNj6ZgciEZXSzzw%3D%3D&lsparams=met%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps&lsig=ACuhMU0wRgIhAOkH-ACuxDVHIx4VtvrJubj5-SvaK9-ylW3Kqr0PpyaEAiEAzZaGVMGRg32uqXLRzOmunQzBVwn0lvek4DCFPGUE34c%3D")
    //         cp.exec("yt-dlp https://youtube.com/watch?v=" + id + " -x -g", (err, stdout, stderr) => {
    //             if (stdout) {
    //                 resolve(stdout)
    //             } else {
    //                 reject(stderr)
    //             }
    //         })
    //     })
    // }

    getYtcfg() {
        // Extracts YouTube Configuration object for later authorizations.

        return new Promise((resolve, reject) => {
            axios.get(
                "https://www.youtube.com/tv",
                {
                    headers: { 'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version' }
                }
            ).then(res => {
                var html = res.data;
                // fs.writeFileSync("testing/tv.html", html);
                var cvMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"([0-9\.]+)[^0-9\.]/);
                if (!cvMatch) return reject("Error downloading ytcfg: client version not found in html");

                var ytcfg = {
                    clientVersion: cvMatch[1]
                };

                resolve(ytcfg)
            })
        })
    }

    getPlayer(id) {
        return new Promise((resolve, reject) => {
            axios.get(
                "https://music.youtube.com/watch?v=" + id,
                {
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0" }
                }
            )
            // fs.promises.readFile("watch.html")
            .then(res => {
                if (res.status != 200)
                    return reject("Error downloading player: status code for watch.html is " + res.status);

                var html = res.data;
                // fs.writeFileSync("testing/watch.html", html)
                // var html = res.toString();
                var match = html.match(/\/s\/player\/([a-z0-9]{8})\/player_ias\.vflset\/([a-z]{2}_[A-Z]{2})\/base\.js/);
                if (!match) return reject("Error downloading player: player URL not found in html");

                var player = new YTPlayer(match[1], match[2]);
                player.downloadAndParse(this.pdb).then(() => {
                    resolve(player)
                }).catch(reject)
            })
        })
    }

    downloadQueue(videoId, queueId) {
        return new Promise((resolve, reject) => {
            if (!queueId) return resolve([]);

            axios.post(
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
            .then(res => {
                if (res.status != 200) return reject("Could not download queue : status code is " + res.status);

                try {
                    var results = [];
                    for (const entry of res.data.contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents) {
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

    downloadVideoData(id, player, ytcfg) {
        // Downloads video data as JSON object, including locked formats

        return new Promise((resolve, reject) => {
            axios.post(
                "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                {
                    "context": this.generateContext(ytcfg),
                    "videoId": id,
                    "playbackContext": {"contentPlaybackContext": {"html5Preference": "HTML5_PREF_WANTS", "signatureTimestamp": player.sts}}, 
                    "contentCheckOk": true, 
                    "racyCheckOk": true
                },
                {
                    headers: {
                        ...this.baseHeaders,
                        'X-YouTube-Client-Version': ytcfg.clientVersion
                    }
                }
            )
            // fs.promises.readFile("ytinitialplayerresponse.json")
            .then(res => {
                if (res.status != 200)
                    return reject("Error downloading video data: status code for player.json is " + res.status);

                var data = res.data;
                // fs.writeFileSync("testing/videodata.json", JSON.stringify(data))
                // var data = JSON.parse(res.toString());

                var info = {
                    id: data.videoDetails.videoId,
                    title: data.videoDetails.title,
                    artist: data.videoDetails.author,
                    views: data.videoDetails.viewCount,
                    duration: parseInt(data.videoDetails.lengthSeconds),
                    thumbnails: data.videoDetails.thumbnail.thumbnails,
                    formats: data.streamingData.formats.concat(data.streamingData.adaptiveFormats)
                        // .filter(fmt => fmt.mimeType.includes("audio/webm"))
                };

                resolve(info)
            }).catch(reject)
        })
    }

    getAlbum(info) {
        return new Promise((resolve, reject) => {
            axios.get(
                'https://music.youtube.com/browse/' + info.id,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0'
                    }
                }
            )
            // fs.promises.readFile('testing/browse.html')
            .then(res => {
                if (res.status != 200) return reject('Could not download album : status code ' + res.status);
                res = res.data;
                // fs.writeFileSync("testing/browse.html", res.data);

                var ytJSCodeMatch = res.match(/try \{(.+);ytcfg\.set/);
                if (!ytJSCodeMatch) return reject('Could not find initial data in album html');

                var initialData = eval(`(() => {${ytJSCodeMatch[1]};return initialData;})()`);
                var data = JSON.parse(initialData.filter(d => d.path == '/browse')[0].data);

                var album = this.parser.extractAlbum(data);
                album.id = info.id;

                resolve(album);
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

            Promise.all([
                this.getPlayer(info.id),
                this.getYtcfg(),
                this.downloadQueue(info.id, info.queueId),
            ]).then(res => {
                var [ player, ytcfg, queue ] = res;
                this.downloadVideoData(info.id, player, ytcfg)
                .then(extractedInfo => {
                    // unlocking stream urls
                    extractedInfo.formats.forEach(fmt => {
                        fmt.url = player.decryptFormatStreamUrl(fmt)
                    })
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
}

module.exports = YTMClient;

// var c = new YTMClient();
// c.getAlbum({ id: "MPREb_z9khROXWkDD" })
// .then(res => {
//     console.log(res)
//     // fs.writeFileSync('testing/albumdata.json', JSON.stringify(res))
// }).catch(console.error)
