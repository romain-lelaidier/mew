const axios = require("axios")
const fs = require('fs')
const cp = require('child_process')

class YTMClient {

    constructor() {
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
    }

    extractRendererTypeAndId(renderer) {
        if ("navigationEndpoint" in renderer || "onTap" in renderer) {
            const endpoint = "navigationEndpoint" in renderer ? renderer.navigationEndpoint : renderer.onTap;
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

    extractRendererInfo(renderer) {
        let [type, id] = this.extractRendererTypeAndId(renderer);
        if (type) {
            const extractText = (i, j) => renderer.flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer.text.runs[j]?.text;
            const musicResult = { 
                type, id,
                thumbnails: renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails,
                title: extractText(0, 0)
            };
            
            for (let i = 1; i < renderer.flexColumns.length; i++) {
                if ("runs" in renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text) {
                    for (const run of renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text.runs) {
                        if ("navigationEndpoint" in run && "browseEndpoint" in run.navigationEndpoint && run.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_ARTIST") {
                            musicResult.artist = run.text;
                        }
                        if (Object.keys(run).length == 1) {
                            const yearMatch = run.text.match(/^(1|2)[0-9]{3}$/);
                            if (yearMatch) musicResult.year = parseInt(yearMatch[0])
                        }
                    }
                }
            }

            return musicResult;
        }
    }

    extractTopRendererInfo(renderer) {
let [type, id] = this.extractRendererTypeAndId(renderer);
        if (type) {
            const musicResult = { 
                type, id,
                thumbnails: renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails
            };
            
            // for (let i = 1; i < renderer.flexColumns.length; i++) {
            //     if ("runs" in renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text) {
            //         for (const run of renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text.runs) {
            //             if ("navigationEndpoint" in run && "browseEndpoint" in run.navigationEndpoint && run.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_ARTIST") {
            //                 musicResult.artist = run.text;
            //             }
            //             if (Object.keys(run).length == 1) {
            //                 const yearMatch = run.text.match(/^(1|2)[0-9]{3}$/);
            //                 if (yearMatch) musicResult.year = parseInt(yearMatch[0])
            //             }
            //         }
            //     }
            // }

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
                        const cts = res.data.contents;
    
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
                            const renderer = musicObj.musicResponsiveListItemRenderer;
                            const musicResult = this.extractRendererInfo(renderer);
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

                    if (res.status == 200) {
                        // extracting useful data
                        const cts = res.data.contents
                        const cts2 = cts.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents;
                        // extracting videos
                        let musicResults = [];
                        cts2.forEach(shelf => {
                            if ("musicCardShelfRenderer" in shelf) {
                                const renderer = shelf.musicCardShelfRenderer;
                                const musicResult = this.extractTopRendererInfo(renderer);
                                if (musicResult) {
                                    musicResult.top = true;
                                    musicResults.push(musicResult);
                                }
                            }
                            if ("musicShelfRenderer" in shelf) {
                                shelf.musicShelfRenderer.contents.forEach(musicObj => {
                                    const renderer = musicObj.musicResponsiveListItemRenderer;
                                    const musicResult = this.extractRendererInfo(renderer);
                                    if (musicResult) musicResults.push(musicResult);
                                })
                            }
                        })
    
                        resolve(musicResults)
                    } else {
                        reject(new Error("Script error: HTTPS POST status code is " + res.status))
                    }
                } catch(err) {
                    reject(err)
                }
            }).catch(reject)
        })
    }

    downloadVideo(video, outputStream, onProgress) {
        console.log("Downloading video:", video.id)
        return new Promise((resolve, reject) => {
            this.extractStreamUrl(video.id).then(url => {
                axios.get(url, {
                    responseType: "stream",
                    headers: { "Range": "bytes=0-" }
                }).then(res => {
                    const webmStream = res.data;
                    // const webmStream = fs.createReadStream("test.webm")
                    // const outputStream = fs.createWriteStream("test3.mp3")
                    // let coverImage = "./test.png"

                    const ffmpegArgs = [
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

                    const ffmpegProcess = cp.spawn('ffmpeg', ffmpegArgs);
                    webmStream.pipe(ffmpegProcess.stdin);
                    ffmpegProcess.stdout.pipe(outputStream);

                    let totalTime;
                    const parseTime = timeString => parseInt(timeString.replace(/:/g, ''))
                    ffmpegProcess.stderr.on('data', (data) => {
                        data = data.toString();
                        // // Vous pouvez analyser la sortie d'erreur pour obtenir la progression
                        if (data.includes("Duration:")) {
                            const durationMatch = data.match(/Duration: (\d+:\d+:\d+.\d+)/);
                            if (durationMatch) totalTime = parseTime(durationMatch[1]);
                        }
                        if (data.includes('time=')) {
                            const progressMatch = data.match(/time=(\d+:\d+:\d+.\d+)/);
                            if (progressMatch) {
                                const time = parseTime(progressMatch[1])
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
            // Promise.all([
            //     axios.post(
            //         "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
            //         {
            //             videoId: id,
            //             context: this.context
            //         }
            //     ),
            //     axios.get(
            //         "https://music.youtube.com/s/player/b2858d36/player_ias.vflset/fr_FR/base.js",
            //     ),
            // ]).then(res => {
            //     try {
            //         if (res[0].status == 200 && res[1].status == 200) {
            //             // extracting useful data
            //             const player = res[0].data;
            //             const base = res[1].data;
            //             resolve(base)
            //         } else {
            //             reject(new Error("Script error: HTTPS POST status code is " + res.status))
            //         }
            //     } catch(err) {
            //         reject(err)
            //     }
            // }).catch(reject)
        })
    }

    extractStreamUrl(id) {
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

}

module.exports = YTMClient;
