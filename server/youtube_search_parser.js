const utils = require('./utils')

class YTSearchParser {
    parseRun(run, musicResult) {
        if ("navigationEndpoint" in run) {
            if ("browseEndpoint" in run.navigationEndpoint) {
                var ytType = run.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType;
                var type = {
                    "MUSIC_PAGE_TYPE_ARTIST": "artist",
                    "MUSIC_PAGE_TYPE_ALBUM": "album"
                } [ ytType ];
                if (type) {
                    musicResult[type] = run.text;
                }
            } else if ("watchEndpoint" in run.navigationEndpoint) {
                // AlbumSongResult
                musicResult.title = run.text;
                musicResult.id = run.navigationEndpoint.watchEndpoint.videoId;
            }
        }

        if (Object.keys(run).length == 1) {
            var yearMatch = run.text.match(/^(1|2)[0-9]{3}$/);
            if (yearMatch) musicResult.year = parseInt(yearMatch[0]);

            var durationMatch = run.text.match(/(\d{1,2}):(\d{1,2})/);
            if (durationMatch) musicResult.duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);

            if (run.text.includes("vues") || run.text.includes("lectures")) {
                var viewsMatch = run.text.match(/(\d+,\d+|\d+)( (k|M))?/);
                const multiplier = {
                    undefined: 1,
                    k: 1e3,
                    M: 1e6
                }
                musicResult.viewCount = parseFloat(viewsMatch[1].replaceAll(',', '.')) * multiplier[viewsMatch[3]]
            }
        }
    }

    parseRuns(runs, musicResult) {
        if (!utils.isIterable(runs)) return;
        runs.forEach(run => this.parseRun(run, musicResult))
    }

    extractQueueId(renderer, musicResult) {
        // parses playlist id and adds it to musicResult
        for (const item of renderer.menu.menuRenderer.items) {
            try {
                musicResult.queueId = item.menuNavigationItemRenderer.navigationEndpoint.watchEndpoint.playlistId;
                return;
            } catch(err) {
                continue
            }
        }
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
            if ("playlistItemData" in renderer && "videoId" in renderer.playlistItemData) {
                var id = renderer.playlistItemData.videoId
                try {
                    if (renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType.includes('PODCAST'))
                        return ['PODCAST', id];
                    else
                        return ["VIDEO", id ];
                } catch(err) {}
            }
        }
        return [null, null]
    }

    extractRendererInfo(renderer) {
        let [type, id] = this.extractRendererTypeAndId(renderer);
        if (type && ['VIDEO', 'ALBUM', 'ARTIST'].includes(type)) {
            var extractText = (i, j) => renderer.flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer.text.runs[j]?.text;
            var musicResult = { 
                type, id,
                title: extractText(0, 0)
            };
            
            if ('thumbnail' in renderer) musicResult.thumbnails = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;
            
            for (let i = 1; i < renderer.flexColumns.length; i++) {
                if ("runs" in renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text) {
                    this.parseRuns(renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text.runs, musicResult)
                }
            }

            this.extractQueueId(renderer, musicResult)

            return musicResult;
        }
    }

    extractTopRendererInfo(renderer, forcedType) {
        let [type, id] = this.extractRendererTypeAndId(renderer);
        if (forcedType) type = forcedType;
        if (type) {
            var musicResult = {
                type, id,
                thumbnails: renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails,
                title: renderer.title.runs[0].text
            };

            this.parseRuns(renderer.subtitle.runs, musicResult);
            this.extractQueueId(renderer, musicResult)

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
            this.extractQueueId(renderer, musicResult)

            return musicResult;
        }
    }

    addResult(obj, musicResults) {
        if (musicResults.filter(mr => mr.id == obj.id).length > 0) return;
        musicResults.push(obj);
    }

    extractSearchResults(data, musicResults) {
        // Extracts search results videos from the YouTube JSON object.
        // Adds the results to the musicResults object.
        // Returns a map of the music result types to the endpoints for additional info.

        var contents;
        var endpoints = {};

        try {
            contents = data.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents;
        } catch(err) {
            console.log(err);
            return endpoints;
        }

        require('fs').writeFileSync("testing/search_contents.json", JSON.stringify(contents));

        if (!utils.isIterable(contents)) return endpoints;

        contents.forEach(shelf => {
            if ("musicCardShelfRenderer" in shelf) {
                var renderer = shelf.musicCardShelfRenderer;
                var musicResult = this.extractTopRendererInfo(renderer);
                if (musicResult) {
                    musicResult.top = true;
                    this.addResult(musicResult, musicResults);
                }
            }
            if ("musicShelfRenderer" in shelf) {
                var forcedType;
                if (shelf.musicShelfRenderer.title.runs[0].text == 'Titres') {
                    forcedType = 'SONG';
                    endpoints.SONG = shelf.musicShelfRenderer.bottomEndpoint;
                }
                shelf.musicShelfRenderer.contents.forEach(musicObj => {
                    var renderer = musicObj.musicResponsiveListItemRenderer;
                    var musicResult = this.extractRendererInfo(renderer);
                    if (musicResult) {
                        if (forcedType) musicResult.type = forcedType;
                        this.addResult(musicResult, musicResults);
                    }
                })
            }
        });

        return endpoints;
    }

    extractAdditionalResults(data, musicResults, forcedType) {
        // Extracts additional search results videos from the YouTube JSON object.
        // Adds the results to the musicResults object.
        // Returns a map of the music result types to the endpoints for additional info.

        var contents;
        var endpoints = {};

        try {
            contents = data.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[1].musicShelfRenderer.contents;
        } catch(err) {
            console.log(err);
            return endpoints;
        }

        if (!utils.isIterable(contents)) return endpoints;

        contents.forEach(musicObj => {
            try {
                var renderer = musicObj.musicResponsiveListItemRenderer;
                var musicResult = this.extractRendererInfo(renderer);
                if (musicResult) {
                    musicResult.type = forcedType;
                    this.addResult(musicResult, musicResults);
                }
            } catch(err) {
                console.log(err)
            }
        });

        return endpoints;
    }

    parseAlbumSongResult(renderer) {
        var result = {};
        // result.title = renderer.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.runs[0].text;
        for (var flexColumn of renderer.flexColumns) {
            this.parseRuns(flexColumn.musicResponsiveListItemFlexColumnRenderer.text.runs, result);
        }
        for (var fixedColumn of renderer.fixedColumns) {
            this.parseRuns(fixedColumn.musicResponsiveListItemFixedColumnRenderer.text.runs, result);
        }
        return result;
    }

    extractAlbum(data) {
        var album = {
            songs: []
        };

        var albumRenderer, contents;

        try {
            albumRenderer = data.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicResponsiveHeaderRenderer;
            contents = data.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicShelfRenderer.contents;
        } catch(err) {
            console.error(err);
            return album;
        }

        // parsing album info
        album.title = albumRenderer.title.runs[0].text;
        album.thumbnails = albumRenderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;

        this.parseRuns(albumRenderer.subtitle.runs, album);
        this.parseRuns(albumRenderer.straplineTextOne.runs, album);

        if (!utils.isIterable(contents)) return album;

        var index = 1;
        contents.forEach(musicObj => {
            try {
                var renderer = musicObj.musicResponsiveListItemRenderer;
                var musicResult = this.parseAlbumSongResult(renderer);
                if (musicResult) {
                    if (!musicResult.index) musicResult.index = index++;
                    album.songs.push(musicResult)
                }
            } catch(err) {
                console.log(err)
            }
        });

        return album
    }
}

module.exports = YTSearchParser;