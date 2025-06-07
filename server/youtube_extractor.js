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
        this.context = {
            "client": {
                "hl": "fr",
                "gl": "FR",
                "remoteHost": "88.166.99.84",
                "deviceMake": "",
                "deviceModel": "",
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0,gzip(gfe)",
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20250514.03.00",
                "osName": "Windows",
                "osVersion": "10.0",
                "originalUrl": "https://music.youtube.com/?cbrd=1",
                "platform": "DESKTOP",
                "clientFormFactor": "UNKNOWN_FORM_FACTOR",
                "configInfo": {
                    "appInstallData": "CMiAp8EGEMn3rwUQvZrPHBDiuLAFEPDizhwQ_fP_EhC9tq4FEOibzxwQzN-uBRCXsv8SEParsAUQgc3OHBCHrM4cEObdzhwQi4KAExDtoM8cEOvo_hIQvZmwBRDk5_8SEJybzxwQ39zOHBDT4a8FEIjjrwUQt-r-EhD8ss4cEIiHsAUQ5uPOHBD_ns8cEJr0zhwQ4OD_EhC52c4cEN2WzxwQzInPHBCZjbEFEImwzhwQndCwBRDevM4cEN-4zhwQu9nOHBCwic8cEL2KsAUQmZixBRCU_rAFEMnmsAUQuOTOHBC1jIATEPCdzxwQ8JywBRDXnM8cEOmFgBMQhZjPHCosQ0FNU0d4VVFvTDJ3RE5Ia0JwU0NFdFhTNmd2NTdBUEozQVdncEFRZEJ3PT0%3D",
                    "coldConfigData": "CMmAp8EGGjJBT2pGb3gzZWtMVE1GM1drOVZLbjZQRVdrdTExS2p5SnRDUVM4ckxUc1NQb3hBeEZ2ZyIyQU9qRm94M2VrTFRNRjNXazlWS242UEVXa3UxMUtqeUp0Q1FTOHJMVHNTUG94QXhGdmc%3D",
                    "coldHashData": "CMmAp8EGEhM4MzcyMjg4Nzg1MDY2MDg0NzkyGMmAp8EGMjJBT2pGb3gzZWtMVE1GM1drOVZLbjZQRVdrdTExS2p5SnRDUVM4ckxUc1NQb3hBeEZ2ZzoyQU9qRm94M2VrTFRNRjNXazlWS242UEVXa3UxMUtqeUp0Q1FTOHJMVHNTUG94QXhGdmc%3D",
                    "hotHashData": "CMmAp8EGEhQxMTUyOTY2ODg1NzU2NjE3NDE2MhjJgKfBBjIyQU9qRm94M2VrTFRNRjNXazlWS242UEVXa3UxMUtqeUp0Q1FTOHJMVHNTUG94QXhGdmc6MkFPakZveDNla0xUTUYzV2s5VktuNlBFV2t1MTFLanlKdENRUzhyTFRzU1BveEF4RnZn"
                },
                "browserName": "Firefox",
                "browserVersion": "138.0",
                "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "deviceExperimentId": "ChxOelV3TlRjME1UWTJPVFUxTWpBNE5qUTVOdz09EMiAp8EGGMiAp8EG",
                "rolloutToken": "CP_PxIiQ0-z0ehDTjJiS8ayNAxjTjJiS8ayNAw%3D%3D",
                "screenWidthPoints": 1485,
                "screenHeightPoints": 731,
                "screenPixelDensity": 1,
                "screenDensityFloat": 1.25,
                "utcOffsetMinutes": 120,
                "userInterfaceTheme": "USER_INTERFACE_THEME_DARK",
                "timeZone": "Europe/Paris",
                "musicAppInfo": {
                    "pwaInstallabilityStatus": "PWA_INSTALLABILITY_STATUS_UNKNOWN",
                    "webDisplayMode": "WEB_DISPLAY_MODE_BROWSER",
                    "storeDigitalGoodsApiSupportStatus": {
                        "playStoreDigitalGoodsApiSupportStatus": "DIGITAL_GOODS_API_SUPPORT_STATUS_UNSUPPORTED"
                    }
                }
            },
            "user": {
                "lockedSafetyMode": false
            },
            "request": {
                "useSsl": true,
                "internalExperimentFlags": [],
                "consistencyTokenJars": []
            }
        }

        this.dbConfig = dbConfig;
        this.parser = new YTSearchParser();

        this.headers = {
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
                "deviceMake": "", 
                "deviceModel": "", 
                "visitorData": "CgtwYWphUEtFSXV0dyjXktjBBjInCgJGUhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiBq", 
                "userAgent": "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)",
                "clientName": "TVHTML5",
                "osVersion": "",
                "originalUrl": "https://www.youtube.com/tv",
                "theme": "CLASSIC",
                "platform": "DESKTOP",
                "clientFormFactor": "UNKNOWN_FORM_FACTOR",
                "webpSupport": false,
                "configInfo": {"appInstallData": "CNeS2MEGEJmYsQUQwoO4IhDloM8cEPX-_xIQmY2xBRCUms8cEO2gzxwQuOTOHBDevM4cEJT-sAUQvZmwBRCe0LAFEL6KsAUQ6-j-EhC52c4cEMn3rwUQ9quwBRCmnc8cENqHgBMQ4p7PHBDroM8cEPmDuCIQ4YKAExDPgs8cEPDizhwQvbauBRCcm88cEImwzhwQiOOvBRDM364FEP-ezxwQ_vP_EhDro88cENr3zhwQmvTOHBCThs8cELCJzxwQpIiAExCIh7AFEIuCgBMQ8JywBRCIhLgiELfq_hIQyKXPHBDJ5rAFEPyyzhwQy5rOHBCjps8cEP6czxwQpOrOHBC9nM8cENuizxwQ_orPHBDroc8cEODg_xIQu9nOHBDT4a8FENeczxwQzInPHBCBzc4cEIeszhwQ2aLPHCokQ0FNU0ZSVVctWnEtREpTQ0V0WFM2Z3Y1N0FQSjNBVWRCdz09"},
                "tvAppInfo": {"appQuality": "TV_APP_QUALITY_FULL_ANIMATION"},
                "timeZone": "UTC",
                "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "deviceExperimentId": "ChxOelV3T1RFNU9UWTVPRFEwTVRrMU9UZzNOdz09ENeS2MEGGNeS2MEG",
                "rolloutToken": "CNfgo63soO-csAEQ3tjNv6jEjQMYmuyTwKjEjQM%3D",
                "utcOffsetMinutes": 0
            },
            "user": {"lockedSafetyMode": false},
            "request": {"useSsl": true},
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
            if (query.length <= 3) {
                return reject("Error: query length should be at least 4.")
            }

            axios.post(
                "https://music.youtube.com/youtubei/v1/music/get_search_suggestions?prettyPrint=false",
                {
                    input: query,
                    context: this.context
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
                    context: this.context
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
                                    ...this.context,
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

    downloadNextData(videoId, queueId) {
        return new Promise((resolve, reject) => {
            if (!queueId) return resolve([]);

            axios.post(
                "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
                {
                    "enablePersistentPlaylistPanel": true,
                    "tunerSettingValue": "AUTOMIX_SETTING_NORMAL",
                    "playlistId": queueId,
                    "params": "wAEB8gECeAHqBAtUTVlydkVNWnJfVQ%3D%3D",
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
                    "queueContextParams": "CAEaEVJEQU1WTVRNWXJ2RU1acl9VIKHb2Ymbvo0DMgtUTVlydkVNWnJfVUoLVE1ZcnZFTVpyX1VQAFoECAAQAXgB",
                    "context": {
                        "client": {
                            "hl": "fr",
                            "gl": "FR",
                            "remoteHost": "85.69.106.218",
                            "deviceMake": "",
                            "deviceModel": "",
                            "visitorData": "CgtHZTJVQmh1WnVFTSjyq8vBBjInCgJGUhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiBL",
                            "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0,gzip(gfe)",
                            "clientName": "WEB_REMIX",
                            "clientVersion": "1.20250519.03.01",
                            "osName": "Windows",
                            "osVersion": "10.0",
                            "originalUrl": "https://music.youtube.com/watch?v=TMYrvEMZr_U&cbrd=1",
                            "platform": "DESKTOP",
                            "clientFormFactor": "UNKNOWN_FORM_FACTOR",
                            "configInfo": {
                                "appInstallData": "CPKry8EGEMyJzxwQmY2xBRDr6P4SEOujzxwQ_vP_EhDM364FEIiHsAUQuOTOHBCI468FEP-ezxwQiJLOHBCvhs8cEIiEuCIQ5qDPHBCd0LAFEImwzhwQmvTOHBDwnc8cEJmYsQUQ0-GvBRC52c4cEMnmsAUQvYqwBRDins8cENr3zhwQ4OD_EhDroc8cEOK4sAUQ15zPHBC9mbAFELfq_hIQvbauBRCcm88cEIHNzhwQyfevBRCwic8cEJT-sAUQ7aDPHBD8ss4cEParsAUQ_pzPHBC72c4cEJOGzxwQ66DPHBCmnc8cEN68zhwQh6zOHBCKgoATEKOmzxwQ8OLOHBD_1c4cKixDQU1TR3hVUW9MMndETkhrQnBTQ0V0WFM2Z3Y1N0FQSjNBV2dwQVFkQnc9PQ%3D%3D",
                                "coldConfigData": "CPOry8EGGjJBT2pGb3gyY2dsSEhxaGh5NFNGV29ucUpVVWMzRUI5T2dFM0xoYnl6M2Fna0FlOXNYdyIyQU9qRm94MmNnbEhIcWhoeTRTRldvbnFKVVVjM0VCOU9nRTNMaGJ5ejNhZ2tBZTlzWHc%3D",
                                "coldHashData": "CPOry8EGEhM4MzcyMjg4Nzg1MDY2MDg0NzkyGPOry8EGMjJBT2pGb3gyY2dsSEhxaGh5NFNGV29ucUpVVWMzRUI5T2dFM0xoYnl6M2Fna0FlOXNYdzoyQU9qRm94MmNnbEhIcWhoeTRTRldvbnFKVVVjM0VCOU9nRTNMaGJ5ejNhZ2tBZTlzWHc%3D",
                                "hotHashData": "CPOry8EGEhQxMTIxNDYxODY0NTg2ODY2NjIyMhjzq8vBBjIyQU9qRm94MmNnbEhIcWhoeTRTRldvbnFKVVVjM0VCOU9nRTNMaGJ5ejNhZ2tBZTlzWHc6MkFPakZveDJjZ2xISHFoaHk0U0ZXb25xSlVVYzNFQjlPZ0UzTGhieXozYWdrQWU5c1h3"
                            },
                            "browserName": "Firefox",
                            "browserVersion": "138.0",
                            "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                            "deviceExperimentId": "ChxOelV3T0RJNU9EYzJOakV5TXpNek1qYzBNdz09EPKry8EGGPKry8EG",
                            "rolloutToken": "CN77_c3k1sKK2gEQmd_giJu-jQMYmd_giJu-jQM%3D",
                            "screenWidthPoints": 1485,
                            "screenHeightPoints": 731,
                            "screenPixelDensity": 1,
                            "screenDensityFloat": 1.25,
                            "utcOffsetMinutes": 120,
                            "userInterfaceTheme": "USER_INTERFACE_THEME_DARK",
                            "timeZone": "Europe/Paris",
                            "musicAppInfo": {
                                "pwaInstallabilityStatus": "PWA_INSTALLABILITY_STATUS_UNKNOWN",
                                "webDisplayMode": "WEB_DISPLAY_MODE_BROWSER",
                                "storeDigitalGoodsApiSupportStatus": {
                                    "playStoreDigitalGoodsApiSupportStatus": "DIGITAL_GOODS_API_SUPPORT_STATUS_UNSUPPORTED"
                                }
                            }
                        },
                        "user": {
                            "lockedSafetyMode": false
                        },
                        "request": {
                            "useSsl": true,
                            "internalExperimentFlags": [],
                            "consistencyTokenJars": []
                        },
                        "activePlayers": [
                            {
                                "playerContextParams": "Q0FFU0FnZ0I="
                            }
                        ]
                    }
                },
                { headers: this.headers }
            )
            .then(res => {
                if (res.status != 200) return reject("Could not download next data: status code is " + res.status);

                try {
                    var results = [];
                    for (const entry of res.data.contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents) {
                        try {
                            var renderer = entry.playlistPanelVideoRenderer;
                            results.push(this.parser.extractNextRendererInfo(renderer));
                        } catch(err) {
                            console.log(err)
                            continue;
                        }
                    }
                    resolve(results);
                } catch(err) {
                    console.log(err)
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
                        ...this.headers,
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

    chooseFormat(formats) {
        var audioSorted = formats
            .filter(fmt => fmt.mimeType.includes("audio/webm"))
            .sort((fmt1, fmt2) => fmt2.bitrate - fmt1.bitrate)
        if (audioSorted) return audioSorted[0];
        return formats[1];
    }

    chooseThumbnail(thumbnails) {
        var sorted = thumbnails
            .sort((fmt1, fmt2) => fmt2.width - fmt1.width)
        return sorted[0];
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

                resolve(album);
            })
        })
    }

    EU(info) {
        // Extracts and unlocks video data from id.
        // The returned Promise resolves on an object containig two fields :
        //  - video : an object with the extracted data and formats
        //  - next : a list

        return new Promise((resolve, reject) => {
            if (!("id" in info)) return reject("No id provided");

            Promise.all([
                this.getPlayer(info.id),
                this.getYtcfg(),
                this.downloadNextData(info.id, info.queueId),
            ]).then(res => {
                var [ player, ytcfg, next ] = res;
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

                    for (var [ key, value ] of Object.entries(info)) {
                        if (!info.key) extractedInfo[key] = value
                    }

                    resolve({
                        video: extractedInfo,
                        next
                    })
                }).catch(reject);
            }).catch(reject);
        })
    }

    DC(info, onProgress = () => {}) {
        // Downloads audio stream and thumbnail from the extractedInfo.
        // Converts it to mp3 and adds metadata.
        // The returned Promise object resolves on a string : the path to the mp3 file.

        return new Promise((resolve, reject) => {
            var fmt = this.chooseFormat(info.formats);
            var thb = this.chooseThumbnail(info.thumbnails);

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
                    var { video, next } = info;

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
