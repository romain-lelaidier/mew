const axios = require("axios")
const fs = require('fs')
const cp = require('child_process');
const PlayerDB = require('./player_db')

function parseQueryString(qs) {
    var params = new URLSearchParams(qs);
    var object = {};
    for (var [key, value] of params.entries()) {
        object[key] = value;
    }
    return object;
}

function replaceUrlParam(url, paramName, paramValue) {
    if (paramValue == null) {
        paramValue = '';
    }
    var pattern = new RegExp('\\b('+paramName+'=).*?(&|#|$)');
    if (url.search(pattern)>=0) {
        return url.replace(pattern,'$1' + paramValue + '$2');
    }
    url = url.replace(/[?#]$/,'');
    return url + (url.indexOf('?')>0 ? '&' : '?') + paramName + '=' + paramValue;
}

function extractBracketsCode(beginIndex, jsCode) {
    // beginIndex-1 -> {
    let index = beginIndex;
    let depth = 1;
    while (depth > 0 && index < jsCode.length) {
        if (jsCode[index] == '{') depth++;
        if (jsCode[index] == '}') depth--;
        index++;
    }
    var endIndex = index - 1;
    return jsCode.substring(beginIndex, endIndex)
}

class YTPlayer {
    constructor(pid, plg) {
        this.pid = pid;
        this.plg = plg;
        this.extracted = false;
    }

    toString() {
        if (this.extracted == true) 
            return JSON.stringify({
                pid: this.pid,
                plg: this.plg,
                sts: this.sts,
                sfc: this.sfc,
                nfc: this.nfc,
            });
        return '{}';
    }

    buildUrl() {
        return `https://music.youtube.com/s/player/${this.pid}/player_ias.vflset/${this.plg}/base.js`;
    }

    downloadFromWeb() {
        return new Promise((resolve, reject) => {
            axios.get(this.buildUrl())
            .then(res => {
                if (res.status != 200) return reject(`Could not download player: status code is ${res.status}`);
                this.js = res.data;
                resolve()
            }).catch(reject)
        })
    }

    extractSigFunctionCodeFromName(sigFuncName) {
        var match = this.js.match(`${sigFuncName}=function\\((\\w+)\\)`);
        if (!match) throw `Error while extracting player: function ${sigFuncName} not found in JS player code.`
        var B = match[1];
        var coreCode = extractBracketsCode(match.index + match[0].length + 1, this.js);
        var rawInstructions = coreCode.split(';')

        var matchY = rawInstructions[0].match(`${B}=${B}\\[([a-zA-Z]+)\\[([0-9]+)\\]\\]\\(\\1\\[([0-9]+)\\]\\)`)
        if (!matchY) throw "Error while extracting player: Y not matched in function code";
        var Y = matchY[1];
        var matchYobj = this.js.match(`var ${Y}='(.+)'`)
        if (!matchYobj) throw "Error while extracting player: could not find Y code";
        var Yobj = matchYobj[1].split(';')

        var matchH = rawInstructions[1].match(`([a-zA-Z]+)\\[${Y}\\[([0-9]+)\\]\\]\\(${B},([0-9])+\\)`)
        if (!matchH) throw "Error while extracting player: H not matched in function code";
        var H = matchH[1];
        var Hcode = extractBracketsCode(this.js.indexOf(`var ${H}=`) + 6 + H.length, this.js).replaceAll('\n', '')

        var matchYrep;
        while (matchYrep = Hcode.match(`${Y}\\[([0-9]+)\\]`)) {
            Hcode = Hcode.replaceAll(matchYrep[0], "'" + Yobj[matchYrep[1]] + "'")
        }

        while (matchYrep = coreCode.match(`${Y}\\[([0-9]+)\\]`)) {
            coreCode = coreCode.replaceAll(matchYrep[0], "'" + Yobj[matchYrep[1]] + "'")
        }

        this.sfc = `B=>{var ${H}={${Hcode}};${coreCode}}`
    }

    extractNFunctionCodeFromName(nFuncName) {
        var match = this.js.match(`${nFuncName}=function\\((\\w+)\\)`);
        if (!match) throw `N Function ${nFuncName} not found in player code`
        var B = match[1];
        var coreCode = extractBracketsCode(match.index + match[0].length + 1, this.js);

        var matchY = coreCode.match(`var [a-zA-Z0-9]+=${B}\\[([a-zA-Z0-9]+)\\[`)
        if (!matchY) throw `N Function is a different form`
        var Y = matchY[1];
        var matchYobj = this.js.match(`var ${Y}='(.+)'`)
        if (!matchYobj) throw "N function Y code was not found in player";
        var Yobj = matchYobj[1].split(';')

        var undefinedIdx = Yobj.includes('undefined') ? Yobj.indexOf('undefined') : '[0-9]+';

        var match = coreCode.match(`;\\s*if\\s*\\(\\s*typeof\\s+[a-zA-Z0-9_$]+\\s*===?\\s*(?:(["\\'])undefined\\1|${Y}\\[${undefinedIdx}\\])\\s*\\)\\s*return\\s+${B};`)
        var fixedNFuncCode = coreCode.replace(match[0], ";")

        this.nfc = `B=>{var Y='${matchYobj[1]}'.split(';');${fixedNFuncCode}}`
    }

    dbLoad(pdb) {
        return pdb.loadPlayer(this)
    }

    downloadAndParse(pdb) {
        return new Promise((resolve, reject) => {
            this.dbLoad(pdb).then(res => {
                resolve()
            }).catch(err => {
                console.log("Player not saved, downloading from Web")
                this.downloadFromWeb().then(() => {
                    try {
                        // extracting signature timestamp from player (to indicate API which player version we're using)
                        var matchSTS = this.js.match(/signatureTimestamp:([0-9]+)[,}]/)
                        if (!matchSTS) return reject("Could not find signature timestamp from player");
                        this.sts = matchSTS[1];
    
                        var sigregexps = [
                            // /\b(?P<var>[a-zA-Z0-9_$]+)&&\((?P=var)=(?P<sig>[a-zA-Z0-9_$]{2,})\(decodeURIComponent\((?P=var)\)\)/,
                            [ /\b([a-zA-Z0-9_$]+)&&\(\1=([a-zA-Z0-9_$]{2,})\(decodeURIComponent\(\1\)\)/, 2 ],
    
                            // /(?P<sig>[a-zA-Z0-9_$]+)\s*=\s*function\(\s*(?P<arg>[a-zA-Z0-9_$]+)\s*\)\s*{\s*(?P=arg)\s*=\s*(?P=arg)\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+(?P=arg)\.join\(\s*""\s*\)/,
                            // [ /([a-zA-Z0-9_$]+)\s*=\s*function\(\s*([a-zA-Z0-9_$]+)\s*\)\s*{\s*\2\s*=\s*\2\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+\2\.join\(\s*""\s*\)/, 1 ],
    
                            // /(?:\b|[^a-zA-Z0-9_$])(?P<sig>[a-zA-Z0-9_$]{2,})\s*=\s*function\(\s*a\s*\)\s*{\s*a\s*=\s*a\.split\(\s*""\s*\)(?:;[a-zA-Z0-9_$]{2}\.[a-zA-Z0-9_$]{2}\(a,[0-9]+\))?/,
                            // // Old patterns
                            // '\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*encodeURIComponent\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\b[a-zA-Z0-9]+\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*encodeURIComponent\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\bm=(?P<sig>[a-zA-Z0-9$]{2,})\(decodeURIComponent\(h\.s\)\)',
                            // // Obsolete patterns
                            // '("|\')signature\x01\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\.sig\|\|(?P<sig>[a-zA-Z0-9$]+)\(',
                            // 'yt\.akamaized\.net/\)\s*\|\|\s*.*?\s*[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*(?:encodeURIComponent\s*\()?\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\bc\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*\([^)]*\)\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                        ];
                        var sigFuncName;
                        for (var sigregexp of sigregexps) {
                            var match = this.js.match(sigregexp[0]);
                            if (match) {
                                sigFuncName = match[sigregexp[1]];
                                break;
                            }
                        }
                        if (!sigFuncName) return reject("Could not extract signature cipher function name");

                        // var match = player.match(/(?xs)[;\n](?:(?P<f>function\s+)|(?:var\s+)?)(?P<funcname>[a-zA-Z0-9_$]+)\s*(?(f)|=\s*function\s*)\((?P<argname>[a-zA-Z0-9_$]+)\)\s*\{(?:(?!\}[;\n]).)+\}\s*catch\(\s*[a-zA-Z0-9_$]+\s*\)\s*\{\s*return\s+%s\[%d\]\s*\+\s*(?P=argname)\s*\}\s*return\s+[^}]+\}[;\n]/)
                        var matchNFuncName = this.js.match(/\nvar ([a-zA-Z][a-zA-Z0-9]+)=\[([a-zA-Z][a-zA-Z0-9]+)\];/)
                        if (!matchNFuncName) return reject("Could not extract n cipher function name");
                        var nFuncName = matchNFuncName[2];
    
                        this.extractSigFunctionCodeFromName(sigFuncName);
                        this.extractNFunctionCodeFromName(nFuncName)
    
                        this.extracted = true;

                        pdb.savePlayer(this);

                        resolve()
                    } catch(err) {
                        reject(err)
                    }
                }).catch(reject);
            })
        })
    }

    decryptFormatStreamUrl(format) {
        if (!this.extracted) throw "Player data is not extracted"

        var sc = parseQueryString(format.signatureCipher);
        var url = `${sc.url}&${sc.sp || "signature"}=${encodeURIComponent((eval(this.sfc))(sc.s))}`;
        var urlParams = parseQueryString(url);

        if ('n' in urlParams) {
            var nDecrypted = eval(this.nfc)(urlParams.n)
            url = replaceUrlParam(url, 'n', nDecrypted)
        }
        return url
    }

}

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
        this.pdb = new PlayerDB(dbConfig)

        this.headers = {'X-YouTube-Client-Name': '7', 'X-YouTube-Client-Version': '7.20250521.15.00', 'Origin': 'https://www.youtube.com', 'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)', 'content-type': 'application/json', 'X-Goog-Visitor-Id': 'CgstXzB5X3dIaS1fMCjsjtjBBjInCgJGUhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiAu'}
    }

    async init() {
        this.pdb.init()
        console.log("Connected to database.")
    }

    extractRendererTypeAndId(renderer) {
        if ("navigationEndpoint" in renderer || "onTap" in renderer) {
            var endpoint = "navigationEndpoint" in renderer ? renderer.navigationEndpoint : renderer.onTap;
            if ("watchEndpoint" in endpoint)
                return ["VIDEO", endpoint.watchEndpoint.videoId];
            else if ("browseEndpoint" in endpoint) {
                if (endpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_ARTIST")
                    return ["ARTIST", endpoint.browseEndpoint.browseId];
                if (endpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_ALBUM")
                    return ["ALBUM", endpoint.browseEndpoint.browseId];
            }
        } else {
            if ("playlistItemData" in renderer && "videoId" in renderer.playlistItemData)
                return ["VIDEO",  renderer.playlistItemData.videoId];
        }
        return [null, null]
    }

    parseRuns(runs, musicResult) {
        runs.forEach(run => {
            if ("navigationEndpoint" in run && "browseEndpoint" in run.navigationEndpoint) {
                var ytType = run.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType;
                var type = {
                    "MUSIC_PAGE_TYPE_ARTIST": "artist",
                    "MUSIC_PAGE_TYPE_ALBUM": "album"
                }[ytType];
                if (type) {
                    musicResult[type] = run.text;
                }
            }
            if (Object.keys(run).length == 1) {
                var yearMatch = run.text.match(/^(1|2)[0-9]{3}$/);
                if (yearMatch) musicResult.year = parseInt(yearMatch[0]);

                var durationMatch = run.text.match(/(\d{1,2}):(\d{1,2})/);
                if (durationMatch) musicResult.duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);

                if (run.text.includes("vues") || run.text.includes("lectures")) {
                    var viewsMatch = run.text.match(/(\d+|\d+,\d+)( (k|M))?/);
                    const multiplier = {
                        undefined: 1,
                        k: 1000,
                        M: 1000000
                    }
                    musicResult.views = parseFloat(viewsMatch[1]) * multiplier[viewsMatch[3]]
                }
            }
        })
    }

    parsePid(renderer, musicResult) {
        for (const item of renderer.menu.menuRenderer.items) {
            try {
                musicResult.pid = item.menuNavigationItemRenderer.navigationEndpoint.watchEndpoint.playlistId;
                return;
            } catch(err) {
                continue
            }
        }
    }

    extractRendererInfo(renderer) {
        let [type, id] = this.extractRendererTypeAndId(renderer);
        if (type) {
            var extractText = (i, j) => renderer.flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer.text.runs[j]?.text;
            var musicResult = { 
                type, id,
                thumbnails: renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails,
                title: extractText(0, 0)
            };
            
            for (let i = 1; i < renderer.flexColumns.length; i++) {
                if ("runs" in renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text) {
                    this.parseRuns(renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text.runs, musicResult)
                }
            }

            this.parsePid(renderer, musicResult)

            return musicResult;
        }
    }

    extractTopRendererInfo(renderer) {
        let [type, id] = this.extractRendererTypeAndId(renderer);
        if (type) {
            var musicResult = { 
                type, id,
                thumbnails: renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails,
                title: renderer.title.runs[0].text
            };

            this.parseRuns(renderer.subtitle.runs, musicResult);
            this.parsePid(renderer, musicResult)

            return musicResult;
        }
    }

    extractNextRendererInfo(renderer) {
        let [type, id] = this.extractRendererTypeAndId(renderer);
        if (type) {
            var musicResult = { 
                type, id,
                thumbnails: renderer.thumbnail.thumbnails,
                title: renderer.title.runs[0].text
            };
            
            this.parseRuns(renderer.longBylineText.runs, musicResult)
            this.parseRuns(renderer.lengthText.runs, musicResult)
            this.parsePid(renderer, musicResult)

            return musicResult;
        }
    }

    searchSuggestions(query) {
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
                try {

                    if (res.status == 200) {
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
                            var musicResult = this.extractRendererInfo(renderer);
                            if (musicResult) musicResults.push(musicResult);
                        })
    
                        resolve({
                            extendedQueries,
                            musicResults
                        })
                    } else {
                        reject(new Error("Script error: HTTPS POST status code is " + res.status))
                    }
                } catch(err) {
                    reject(err)
                }
            }).catch(reject)
        })
    }

    search(query) {
        return new Promise((resolve, reject) => {
            axios.post(
                "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
                {
                    query: query,
                    context: this.context
                }
            ).then(res => {
                try {
                    if (res.status != 200) return reject("Could not download search results: status code is " + res.status);

                    // extracting useful data
                    var cts = res.data.contents
                    var cts2 = cts.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents;
                    // fs.writeFileSync("testing/cts2.json", JSON.stringify(cts2))
                    // extracting videos
                    let musicResults = [];
                    cts2.forEach(shelf => {
                        if ("musicCardShelfRenderer" in shelf) {
                            var renderer = shelf.musicCardShelfRenderer;
                            var musicResult = this.extractTopRendererInfo(renderer);
                            if (musicResult) {
                                musicResult.top = true;
                                musicResults.push(musicResult);
                            }
                        }
                        if ("musicShelfRenderer" in shelf) {
                            shelf.musicShelfRenderer.contents.forEach(musicObj => {
                                var renderer = musicObj.musicResponsiveListItemRenderer;
                                var musicResult = this.extractRendererInfo(renderer);
                                if (musicResult) musicResults.push(musicResult);
                            })
                        }
                    })

                    resolve(musicResults)
                } catch(err) {
                    reject(err)
                }
            }).catch(reject)
        })
    }

    downloadVideo(video, outputStream, onProgress) {
        return new Promise((resolve, reject) => {
            this.extractStreamUrlYtDlp(video.id).then(url => {
                axios.get(url, {
                    responseType: "stream",
                    headers: { "Range": "bytes=0-" }
                }).then(res => {
                    var webmStream = res.data;
                    // var webmStream = fs.createReadStream("test.webm")
                    // var outputStream = fs.createWriteStream("test3.mp3")
                    // let coverImage = "./test.png"

                    var ffmpegArgs = [
                        '-i', 'pipe:0', // Lire à partir du flux d'entrée standard
                        // '-i', coverImage,
                        // '-map', '0:0', // Mapper l'audio
                        // '-map', '1:0', // Mapper la pochette
                        // '-c:v', 'copy', // Copier le flux vidéo (la pochette)
                        // '-id3v2_version', '3', // Utiliser ID3v2.3 pour les métadonnées
                        // '-metadata:s:v', 'title="Album cover"',
                        // '-metadata:s:v', 'comment="Cover (front)"',
                        '-metadata', `title=${video.title}`,
                        '-metadata', `artist=${video.artist}`,
                        '-metadata', `album=${video.album}`,
                        // '-map_metadata', '0:s:0',
                        // '-b:a', '192k', // Débit binaire audio
                        '-f', 'mp3', // Format de sortie
                        'pipe:1' // Écrire vers le flux de sortie standard
                    ];

                    var ffmpegProcess = cp.spawn('ffmpeg', ffmpegArgs);
                    webmStream.pipe(ffmpegProcess.stdin);
                    ffmpegProcess.stdout.pipe(outputStream);

                    let totalTime;
                    var parseTime = timeString => parseInt(timeString.replace(/:/g, ''))
                    ffmpegProcess.stderr.on('data', (data) => {
                        data = data.toString();
                        // // Vous pouvez analyser la sortie d'erreur pour obtenir la progression
                        if (data.includes("Duration:")) {
                            var durationMatch = data.match(/Duration: ([0-9]+:[0-9]+:[0-9]+.[0-9]+)/);
                            if (durationMatch) totalTime = parseTime(durationMatch[1]);
                        }
                        if (data.includes('time=')) {
                            var progressMatch = data.match(/time=([0-9]+:[0-9]+:[0-9]+.[0-9]+)/);
                            if (progressMatch) {
                                var time = parseTime(progressMatch[1])
                                onProgress(time / totalTime)
                            }
                        }
                    });

                    ffmpegProcess.on('close', (code) => {
                        if (code === 0) resolve()
                        else reject(code)
                    });
                });
            }).catch(reject)
        })
    }

    extractStreamUrlYtDlp(id) {
        return new Promise((resolve, reject) => {
            // return resolve("https://rr1---sn-n4g-ouxz.googlevideo.com/videoplayback?expire=1747707904&ei=oJMraNKzGNbf6dsPx9uM0Qo&ip=2a02%3A842a%3A3c4f%3A7d01%3Ac8e6%3Af162%3A69b6%3A41a&id=o-AIZRHZ1sfbl6EykiztzYr1u42b9He_Vx3O4utUa4ROs-&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&met=1747686304%2C&mh=Tb&mm=31%2C29&mn=sn-n4g-ouxz%2Csn-n4g-jqbe6&ms=au%2Crdu&mv=m&mvi=1&pl=47&rms=au%2Cau&gcr=fr&initcwndbps=2918750&bui=AecWEAatMmfIpanpkhsJMWO_pzRFBBP9e3KsZqyP4jzieaP_EYahR-TLP4vkgyGLl_iabHKNM0VcmoEp&spc=wk1kZofjhcny&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=4408344&dur=261.081&lmt=1714576784227977&mt=1747685815&fvip=6&keepalive=yes&c=IOS&txp=4502434&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cgcr%2Cbui%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRQIhAKSnuQqKbjle528DAbnuK6aXyknoJ9gkocvmnCe-QWnzAiAlPrp_ygOgms2WNEIMTAnwP2C9ElwpNj6ZgciEZXSzzw%3D%3D&lsparams=met%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps&lsig=ACuhMU0wRgIhAOkH-ACuxDVHIx4VtvrJubj5-SvaK9-ylW3Kqr0PpyaEAiEAzZaGVMGRg32uqXLRzOmunQzBVwn0lvek4DCFPGUE34c%3D")
            cp.exec("yt-dlp https://youtube.com/watch?v=" + id + " -x -g", (err, stdout, stderr) => {
                if (stdout) {
                    resolve(stdout)
                } else {
                    reject(stderr)
                }
            })
        })
    }

    getYtcfg() {
        return new Promise((resolve, reject) => {
            axios.get(
                "https://www.youtube.com/tv",
                {
                    headers: {'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version'}
                }
            ).then(res => {
                var html = res.data;
                // fs.writeFileSync("testing/tv.html", html);
                var cvMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"([0-9\.]+)[^0-9\.]/);
                if (!cvMatch) return reject("Error downloading ytcfg: client version not found in html");

                var ytcfg = {
                    clientVersion: cvMatch[1]
                };

                this.headers['X-YouTube-Client-Version'] = ytcfg.clientVersion;
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

    downloadNextData(videoId, playlistId) {
        return new Promise((resolve, reject) => {
            if (!playlistId) return resolve([])
            axios.post(
                "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
                {
                    "enablePersistentPlaylistPanel": true,
                    "tunerSettingValue": "AUTOMIX_SETTING_NORMAL",
                    "playlistId": playlistId,
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
                        "clickTracking": {
                        "clickTrackingParams": "CBoQ_20iEwjn_NiJm76NAxW-RE8EHRCUCiU="
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
                            results.push(this.extractNextRendererInfo(renderer));
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
        // downloads video data as JSON object, including formats' encrypted ciphers

        return new Promise((resolve, reject) => {
            axios.post(
                "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                {
                    "context": {
                        "client": {"hl": "en", "gl": "FR", "deviceMake": "", "deviceModel": "", "visitorData": "CgtwYWphUEtFSXV0dyjXktjBBjInCgJGUhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiBq", "userAgent": "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)", "clientName": "TVHTML5", "clientVersion": ytcfg.clientVersion, "osVersion": "", "originalUrl": "https://www.youtube.com/tv", "theme": "CLASSIC", "platform": "DESKTOP", "clientFormFactor": "UNKNOWN_FORM_FACTOR", "webpSupport": false, "configInfo": {"appInstallData": "CNeS2MEGEJmYsQUQwoO4IhDloM8cEPX-_xIQmY2xBRCUms8cEO2gzxwQuOTOHBDevM4cEJT-sAUQvZmwBRCe0LAFEL6KsAUQ6-j-EhC52c4cEMn3rwUQ9quwBRCmnc8cENqHgBMQ4p7PHBDroM8cEPmDuCIQ4YKAExDPgs8cEPDizhwQvbauBRCcm88cEImwzhwQiOOvBRDM364FEP-ezxwQ_vP_EhDro88cENr3zhwQmvTOHBCThs8cELCJzxwQpIiAExCIh7AFEIuCgBMQ8JywBRCIhLgiELfq_hIQyKXPHBDJ5rAFEPyyzhwQy5rOHBCjps8cEP6czxwQpOrOHBC9nM8cENuizxwQ_orPHBDroc8cEODg_xIQu9nOHBDT4a8FENeczxwQzInPHBCBzc4cEIeszhwQ2aLPHCokQ0FNU0ZSVVctWnEtREpTQ0V0WFM2Z3Y1N0FQSjNBVWRCdz09"}, "tvAppInfo": {"appQuality": "TV_APP_QUALITY_FULL_ANIMATION"}, "timeZone": "UTC", "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "deviceExperimentId": "ChxOelV3T1RFNU9UWTVPRFEwTVRrMU9UZzNOdz09ENeS2MEGGNeS2MEG", "rolloutToken": "CNfgo63soO-csAEQ3tjNv6jEjQMYmuyTwKjEjQM%3D", "utcOffsetMinutes": 0},
                        "user": {"lockedSafetyMode": false},
                        "request": {"useSsl": true},
                        "clickTracking": {"clickTrackingParams": "IhMIg9aTwKjEjQMVLuhJBx3LIxe8"}
                    }, 
                    "videoId": id, 
                    "playbackContext": {"contentPlaybackContext": {"html5Preference": "HTML5_PREF_WANTS", "signatureTimestamp": player.sts}}, 
                    "contentCheckOk": true, 
                    "racyCheckOk": true
                },
                {
                    headers: this.headers
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

    extractVideo(info) {
        return new Promise((resolve, reject) => {
            if (!("id" in info)) return reject("No id provided");

            Promise.all([
                this.getPlayer(info.id),
                this.getYtcfg(),
                this.downloadNextData(info.id, info.pid),
            ])
            .then(res => {
                var [ player, ytcfg, next ] = res;
                this.downloadVideoData(info.id, player, ytcfg)
                .then(extractedInfo => {
                    for (var format of extractedInfo.formats) {
                        format.url = player.decryptFormatStreamUrl(format)
                        delete format.signatureCipher
                    }
                    for (var [ key, value ] of Object.entries(info)) {
                        extractedInfo[key] = value
                    }
                    resolve({
                        video: extractedInfo,
                        next
                    })
                }).catch(reject);
            }).catch(reject);

        })
    }

}

module.exports = YTMClient;