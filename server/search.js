const axios = require("axios")
const fs = require('fs')

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

    search_suggestion(query) {
        console.log("Search suggestion:", query)
        return new Promise((resolve, reject) => {
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
                            const item = musicObj.musicResponsiveListItemRenderer
                            const thumbnails = item.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;
                            if ("watchEndpoint" in item.navigationEndpoint) {
                                musicResults.push({
                                    type: "VIDEO",
                                    id: item.navigationEndpoint.watchEndpoint.videoId,
                                    thumbnails,
                                })
                            } else if ("browseEndpoint" in item.navigationEndpoint) {
                                musicResults.push({
                                    type: "ALBUM",
                                    id: item.navigationEndpoint.browseEndpoint.browseId,
                                    thumbnails,
                                })
                            }
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

    extractVideoInfo(flexColumns) {
        const extractText = (i, j) => flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer.text.runs[j]?.text;
        if (flexColumns.length == 2) {
            return {
                title: extractText(0, 0),
                artist: extractText(1, 2),
                views: extractText(1, 4),
                duration: extractText(1, 6)
            }
        } else if (flexColumns.length == 3) {
            return {
                title: extractText(0, 0),
                artist: extractText(1, 0),
                album: extractText(1, 2),
                duration: extractText(1, 4),
                views: extractText(2, 0),
            }
        }
    }

    search(query) {
        console.log("Search:", query)
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
                                const item = shelf.musicCardShelfRenderer;
                                const thumbnails = item.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;
                                const endpoint = item.title.runs[0].navigationEndpoint;
                                const realType = "browseEndpoint" in endpoint 
                                    ? endpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType
                                    : ("watchEndpoint" in endpoint ? "TYPE_VIDEO" : null);
                                if (realType != null) {
                                    const type = realType.substring(realType.indexOf("TYPE_") + 5);
                                    if (type == "VIDEO") {
                                        musicResults.push({
                                            top: true,
                                            type,
                                            id: endpoint.watchEndpoint.videoId,
                                            title: item.title.runs[0].text,
                                            artist: item.subtitle.runs[2].text,
                                            views: item.subtitle.runs[4].text,
                                            duration: item.subtitle.runs[6].text,
                                            thumbnails
                                        })
                                    } else if (type == "ALBUM") {
                                        musicResults.push({
                                            top: true,
                                            type,
                                            id: endpoint.browseEndpoint.browseId,
                                            album: item.title.runs[0].text,
                                            artist: item.subtitle.runs[2].text,
                                            thumbnails
                                        })
                                    }
                                }
                            }
                            else if ("musicShelfRenderer" in shelf) {
                                shelf.musicShelfRenderer.contents.forEach(musicObj => {
                                    const item = musicObj.musicResponsiveListItemRenderer;
                                    const thumbnails = item.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;
                                    if ("playlistItemData" in item) {
                                        // video
                                        const videoInfo = this.extractVideoInfo(item.flexColumns);
                                        if (videoInfo.duration) {
                                            musicResults.push({
                                                type: "VIDEO",
                                                id: item.playlistItemData.videoId,
                                                info: videoInfo,
                                                thumbnails,
                                            })
                                        }
                                    } else if ("navigationEndpoint" in item && "browseEndpoint" in item.navigationEndpoint) {
                                        const realType = item.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType;
                                        musicResults.push({
                                            type: realType.substring(realType.indexOf("TYPE_") + 5),
                                            id: item.navigationEndpoint.browseEndpoint.browseId,
                                            thumbnails,
                                        })
                                    }
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

    downloadVideo(id) {
        console.log("Downloading video:", id)
        return new Promise((resolve, reject) => {
            axios.post(
                "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                {
                    videoId: id,
                    context: this.context
                }
            ).then(res => {
                try {

                    if (res.status == 200) {
                        // extracting useful data
                        const data = res.data
                        resolve(data)
                    } else {
                        reject(new Error("Script error: HTTPS POST status code is " + res.status))
                    }
                } catch(err) {
                    reject(err)
                }
            }).catch(reject)
        })
    }

}

const c = new YTMClient()
c.downloadVideo("ImKY6TZEyrI").then(res => {
    console.log(res)
    fs.writeFileSync("./player_video.json", JSON.stringify(res))
})