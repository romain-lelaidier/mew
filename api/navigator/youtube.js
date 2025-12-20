import * as utils from "../utils.js";

export class YouTubeParser {
  parseRun(run, musicResult) {
    if ("navigationEndpoint" in run) {
      if ("browseEndpoint" in run.navigationEndpoint) {
        var ytType = run.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType;
        var type = {
          "MUSIC_PAGE_TYPE_ARTIST": "artist",
          "MUSIC_PAGE_TYPE_ALBUM": "album"
        } [ ytType ];
        if (type) {

          // musicResult[type] = {
          //   name: run.text,
          //   id: run.navigationEndpoint.browseEndpoint.browseId
          // }

          const listname = type + 's';
          if (!musicResult[listname]) musicResult[listname] = [];
          musicResult[listname].push({
            name: run.text,
            id: run.navigationEndpoint.browseEndpoint.browseId
          });
          // musicResult[type] = run.text;
          // musicResult[type + "Id"] = run.navigationEndpoint.browseEndpoint.browseId
        }
      } else if ("watchEndpoint" in run.navigationEndpoint) {
        // AlbumSongResult
        musicResult.name = run.text;
        musicResult.id = run.navigationEndpoint.watchEndpoint.videoId;
      }
    }

    if (Object.keys(run).length == 1) {
      var yearMatch = run.text.match(/^(1|2)[0-9]{3}$/);
      if (yearMatch) musicResult.year = parseInt(yearMatch[0]);

      var durationMatch = run.text.match(/(\d{1,2}):(\d{1,2})/);
      if (durationMatch) musicResult.duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);

      if (run.text.includes("vues") || run.text.includes("lectures")) {
        musicResult.listeners = utils.parseViewCount(run.text);
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
        continue;
      }
    }
  }
  
  playlistId(id) {
    id = id.substring(id.length - 43);
    if (id.indexOf('VL') == 0) {
      id = id.substring(2);
    }
    return id;
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
        if (endpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_PLAYLIST")
          return ["PLAYLIST", this.playlistId(endpoint.browseEndpoint.browseId) ];
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

  img(thumbnail) {
    return {
      type: "youtube",
      thumbnails: thumbnail.thumbnails
    }
  }

  extractRendererInfo(renderer) {
    let [type, id] = this.extractRendererTypeAndId(renderer);
    if (type && ['VIDEO', 'ALBUM', 'ARTIST', 'PLAYLIST'].includes(type)) {
      var extractText = (i, j) => renderer.flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer.text.runs[j]?.text;
      var musicResult = { 
        type, id,
        name: extractText(0, 0)
      };
      
      if ('thumbnail' in renderer) musicResult.img = this.img(renderer.thumbnail.musicThumbnailRenderer.thumbnail);

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
        img: this.img(renderer.thumbnail.musicThumbnailRenderer.thumbnail),
        name: renderer.title.runs[0].text
      };

      this.parseRuns(renderer.subtitle.runs, musicResult);
      this.extractQueueId(renderer, musicResult)

      return musicResult;
    }
  }

  extractQueueRendererInfo(renderer) {
    let [type, id] = this.extractRendererTypeAndId(renderer);
    if (type) {
      var musicResult = { 
        type, id,
        img: this.img(renderer.thumbnail),
        name: renderer.title.runs[0].text
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

  search(data, musicResults) {
    // Extracts search results videos from the YouTube JSON object.
    // Adds the results to the musicResults object.
    // Returns a map of the music result types to the endpoints for additional info.

    var contents = data.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents;
    var endpoints = {};

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
        // var forcedType;
        // if (shelf.musicShelfRenderer.title.runs[0].text == 'Titres') {
        //   forcedType = 'SONG';
        //   endpoints.SONG = shelf.musicShelfRenderer.bottomEndpoint;
        // }
        shelf.musicShelfRenderer.contents.forEach(musicObj => {
          var renderer = musicObj.musicResponsiveListItemRenderer;
          var musicResult = this.extractRendererInfo(renderer);
          if (musicResult) {
            // if (forcedType) musicResult.type = forcedType;
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
      console.error(err);
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
        console.error(err)
      }
    });

    return endpoints;
  }

  parseAlbumSongResult(renderer) {
    var result = {};
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
    album.name = albumRenderer.title.runs[0].text;
    album.img = this.img(albumRenderer.thumbnail.musicThumbnailRenderer.thumbnail);

    this.parseRuns(albumRenderer.subtitle.runs, album);
    this.parseRuns(albumRenderer.straplineTextOne.runs, album);

    if (!utils.isIterable(contents)) return album;

    var index = 1;
    contents.forEach(musicObj => {
      try {
        var renderer = musicObj.musicResponsiveListItemRenderer;
        var musicResult = this.parseAlbumSongResult(renderer);
        if (musicResult) {
          if (!musicResult.index) musicResult.rank = index++;
          album.songs.push(musicResult)
        }
      } catch(err) {
        console.error(err)
      }
    });

    return album
  }

  extractArtist(data) {
    var artist = {
      results: [],
    };

    try {
      let header = data.header.musicImmersiveHeaderRenderer

      artist.name = header.title.runs[0].text;
      artist.description = header.description.runs.map(run => run.text).join('\n');
      artist.img = this.img(header.thumbnail.musicThumbnailRenderer.thumbnail);

      artist.shufflePlaySID = header.playButton.buttonRenderer.navigationEndpoint.watchEndpoint.videoId;
      artist.shufflePlayPID = header.playButton.buttonRenderer.navigationEndpoint.watchEndpoint.playlistId;
      artist.radioPlaySID = header.startRadioButton.buttonRenderer.navigationEndpoint.watchEndpoint.videoId;
      artist.radioPlayPID = header.startRadioButton.buttonRenderer.navigationEndpoint.watchEndpoint.playlistId;

      artist.listeners = utils.parseViewCount(header.monthlyListenerCount.runs[0].text)
    } catch(err) {}

    let contents = data.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents;

    contents.forEach(c => {
      if ('musicShelfRenderer' in c) {
        c.musicShelfRenderer.contents.forEach(rc => {
          let song = this.extractRendererInfo(rc.musicResponsiveListItemRenderer);
          song.type = 'SONG';
          // delete song.artist;
          artist.results.push(song);
        })
      }
      if ('musicCarouselShelfRenderer' in c) {
        c.musicCarouselShelfRenderer.contents.forEach(rc => {
          try {
            if (rc.musicTwoRowItemRenderer.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_ALBUM" && rc.musicTwoRowItemRenderer.subtitle.runs.length == 1) {
              let album = {
                type: "ALBUM"
              };
              album.img = this.img(rc.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer.thumbnail);
              album.name = rc.musicTwoRowItemRenderer.title.runs[0].text;
              album.id = rc.musicTwoRowItemRenderer.title.runs[0].navigationEndpoint.browseEndpoint.browseId;
              this.parseRuns(rc.musicTwoRowItemRenderer.subtitle.runs, album)
              artist.results.push(album)
            }
          } catch(err) {}
        })
      }
    })

    return artist;
  }

  parsePlaylistSongResult(renderer) {
    var result = {
      img: this.img(renderer.thumbnail.musicThumbnailRenderer.thumbnail)
    };
    for (var flexColumn of renderer.flexColumns) {
      this.parseRuns(flexColumn.musicResponsiveListItemFlexColumnRenderer.text.runs, result);
    }
    for (var fixedColumn of renderer.fixedColumns) {
      this.parseRuns(fixedColumn.musicResponsiveListItemFixedColumnRenderer.text.runs, result);
    }
    return result;
  }

  extractPlaylist(data) {
    var playlist = {
      songs: []
    };

    var playlistRenderer, contents;

    try {
      playlistRenderer = data.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicResponsiveHeaderRenderer;
      contents = data.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicPlaylistShelfRenderer.contents;
    } catch(err) {
      console.error(err);
      return playlist;
    }

    // parsing album info
    playlist.name = playlistRenderer.title.runs[0].text;
    playlist.img = this.img(playlistRenderer.thumbnail.musicThumbnailRenderer.thumbnail);

    this.parseRuns(playlistRenderer.subtitle.runs, playlist);

    if (!utils.isIterable(contents)) return playlist;

    var index = 1;
    contents.forEach(musicObj => {
      try {
        var renderer = musicObj.musicResponsiveListItemRenderer;
        var musicResult = this.parsePlaylistSongResult(renderer);
        if (musicResult) {
          if (!musicResult.index) musicResult.rank = index++;
          playlist.songs.push(musicResult)
        }
      } catch(err) {
        console.error(err)
      }
    });

    return playlist
  }

  parseContent(content) {
    // console.log(content)
    try {
      var item = {};
      var renderer;
      if ('musicTwoRowItemRenderer' in content) {
        renderer = content.musicTwoRowItemRenderer;
        item.img = this.img(renderer.thumbnailRenderer.musicThumbnailRenderer.thumbnail)
      } else if ('musicResponsiveListItemRenderer' in content) {
        renderer = content.musicResponsiveListItemRenderer;
        item.thumbnails = this.img(renderer.thumbnail.musicThumbnailRenderer.thumbnail)
      }
      var [ type, id ] = this.extractRendererTypeAndId(renderer);
      item.type = type;
      item.id = id;
      if ('title' in renderer) {
        item.name = renderer.title.runs[0].text;
      }
      if ('subtitle' in renderer) {
        item.subtitle = renderer.subtitle.runs[0].text;
      }
      if (!('title' in item) && 'flexColumns' in renderer) {
        var runs = [].concat(...renderer.flexColumns.map(fc => fc.musicResponsiveListItemFlexColumnRenderer.text.runs));
        this.parseRuns(runs, item);
      }
      if ('artist' in item) item.type = "SONG";
      return item;
    } catch(err) {
      console.error(err);
      return null;
    }
  }

  parseBrowsingResults(contents) {
    var results = [];
    for (var content of contents) {
      try {
        var renderer = content.musicCarouselShelfRenderer;
        var name = renderer.header.musicCarouselShelfBasicHeaderRenderer.title.runs[0].text;
        var items = [];
        for (var icontent of renderer.contents) {
          var item = this.parseContent(icontent);
          if (item) items.push(item);
        }
        if (items.length > 0) {
          results.push({ name, items })
        }
      } catch(err) {
        console.error(err);
      }
    }
    return results;
  }
}

export class YouTubeNavigator {
  constructor(ww) {
    this.ww = ww;
    this.parser = new YouTubeParser();

    this.baseContext = {
      "client": {
        "hl": "en",
        "gl": "FR",
        "remoteHost": "88.166.99.84",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0,gzip(gfe)",
        "clientName": "WEB_REMIX",
        "clientVersion": "1.20250514.03.00",
        "originalUrl": "https://music.youtube.com/?cbrd=1",
        "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    }
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
          },
          // save: true, load: true
        }
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

  // ----- API FUNCTIONS -----

  async searchSuggestions(query) {
    // Fetches search suggestions for the given query.
    // The returned Promise resolves on an object containing two fields :
    //  - extendedQueries : a list of pairs containing a bold text and a completion
    //  - musicResults : a list of music results

    if (query.length < 3) throw new Error("Query length should be at least 3.");

    var data = await this.ww.post(
      "yti_searchsuggestions", "json",
      "https://music.youtube.com/youtubei/v1/music/get_search_suggestions?prettyPrint=false",
      {
        input: query,
        context: this.baseContext
      }
    );

    // extended queries (query autocompletions)
    let extendedQueries = [];
    data.contents[0].searchSuggestionsSectionRenderer.contents.forEach(queryObj => {
      extendedQueries.push(queryObj.searchSuggestionRenderer.suggestion.runs.map(run => run.text))
    })

    // music results (quick video and albums results)
    let musicResults = [];
    data.contents[1].searchSuggestionsSectionRenderer.contents.forEach(musicObj => {
      var renderer = musicObj.musicResponsiveListItemRenderer;
      var musicResult = this.parser.extractRendererInfo(renderer);
      if (musicResult) musicResults.push(musicResult);
    })

    return {
      extendedQueries,
      musicResults
    };
  }

  async search(query, additional=[]) {
    // Fetches search results for the given query.
    // The returned Promise resolves on an object containing fields such as SONG, ARTIST, ALBUM, etc.
    // Each field value is an array of music results.
    // For each type contained in additional, more results are fetched.

    var data = await this.ww.post(
      "yti_search", "json",
      "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
      {
        query: query,
        context: this.baseContext
      },
      // { save: true, load: true }
    )

    var results = [];
    this.parser.search(data, results);

    return results;

    // Promise.all(
    //   additionalTypes.map(type =>
    //     this.ww.post(
    //       "yti_search_add", "json",
    //       "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
    //       {
    //         context: {
    //           ...this.baseContext,
    //           clickTracking: { clickTrackingParams: endpoints[type].clickTrackingParams }
    //         },
    //         ...endpoints[type].searchEndpoint,
    //       }
    //     )
    //   )
    // ).then(responses => {
    //   for (var i = 0; i < responses.length; i++) {
    //     var type = additionalTypes[i];
    //     var data = responses[i];
    //     this.parser.extractAdditionalResults(data, results, type);
    //   }
    //   resolve(results)
    // })
  }

  async album(id) {
    if (!id.match(/^[a-zA-Z0-9_-]{17}$/)) throw new Error("Invalid id.");
    var data = await this.getYTInitialDataFromHtml('https://music.youtube.com/browse/' + id, "browse_album");
    var album = this.parser.extractAlbum(data);
    album.id = id;
    return album;
  }

  async artist(id) {
    if (!id.match(/^[a-zA-Z0-9_-]{24}$/)) throw new Error("Invalid id.");
    var data = await this.getYTInitialDataFromHtml('https://music.youtube.com/channel/' + id, "browse_artist")
    var artist = this.parser.extractArtist(data);
    artist.id = id;
    return artist;
  }

  async playlist(info) {
    var html = await this.ww.get(
      "browse_playlist", "html",
      'https://music.youtube.com/playlist?list=' + info.id,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0'
        }
      },
    );

    var ytJSCodeMatch = html.match(/try \{(.+);ytcfg\.set/);
    if (!ytJSCodeMatch) throw new Error('Could not find initial data in playlist html');

    var initialData = eval(`(() => {${ytJSCodeMatch[1]};return initialData;})()`);
    var data = JSON.parse(initialData.filter(d => d.path == '/browse')[0].data);

    var playlist = this.parser.extractPlaylist(data);
    playlist.id = info.id;

    return playlist;
  }

  // browse(continuation = {}, depth = 0) {
  //   return new Promise((resolve, reject) => {
  //     var url = 'continuation' in continuation && 'clickTrackingParams' in continuation
  //       ? "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&type=next&continuation=" + continuation.continuation + "&itct=" + continuation.clickTrackingParams
  //       : "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&type=next";

  //     this.ww.post(
  //       "yti_browse_" + depth, "json",
  //       url,
  //       { context: this.baseContext },
  //       { headers: this.baseHeaders },
  //     ).then(json => {
  //       var continuation;
  //       try {
  //         continuation = depth == 0 
  //           ? json.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.continuations[0].nextContinuationData
  //           : json.continuationContents.sectionListContinuation.continuations[0].nextContinuationData;
  //       } catch(err) {
  //         return reject(err);
  //       }

  //       var contents = depth == 0
  //         ? json.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents
  //         : json.continuationContents.sectionListContinuation.contents;

  //       var results = this.parser.parseBrowsingResults(contents);
  //       if (depth == 2) {
  //         resolve(results);
  //       } else {
  //         this.browse(continuation, depth+1)
  //         .then(followingResults => {
  //           resolve(results.concat(followingResults))
  //         })
  //         .catch(reject);
  //       }

  //     }).catch(reject)
  //   })
  // }

}
