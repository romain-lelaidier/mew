import { YouTubeParser} from "../navigator/youtube.js";
import * as utils from "../utils.js";

class YouTubePlayer {
  constructor(pid, plg) {
    this.pid = pid;
    this.plg = plg;
    this.extracted = false;
    this.ww = new utils.WebWrapper();
  }

  toString() {
    if (this.extracted == true) 
      return JSON.stringify({
        pid: this.pid,
        plg: this.plg,
        sts: this.sts,
      });
    return '{}';
  }

  async dbLoad(db) {
    var r = await db.collection("players").findOne({
      $and: [
        { pid: { $eq: this.pid } },
        { plg: { $eq: this.plg }}
      ]
    })
    if (r) {
      this.pid = r.pid;
      this.plg = r.plg;
      this.sts = r.sts;
      this.extracted = true;
      return true;
    }
    return false;
  }
  
  async dbSave(db) {
    try {
      await db.collection("players").insertOne({
        pid: this.pid,
        plg: this.plg,
        sts: this.sts,
      })
    } catch(err) {
      console.error(err);
    }
  }

  async load(db) {
    // return;
    var loaded = await this.dbLoad(db);
    if (loaded) return;

    // downloading from web
    var url =  `https://music.youtube.com/s/player/${this.pid}/player_ias.vflset/${this.plg}/base.js`;
    console.log("Player not saved, downloading from Web :", url)
    
    this.js = await this.ww.get("player_ias", "js", url);

    // extracting signature timestamp from player (to indicate API which player version we're using)
    var matchSTS = this.js.match(/signatureTimestamp:([0-9]+)[,}]/)
    if (!matchSTS) throw new Error("Could not find signature timestamp from player");
    this.sts = matchSTS[1];

    this.extracted = true;

    this.dbSave(db);
  }
}

export class YouTubeExtractor {
  constructor(ww, db) {
    this.ww = ww;
    this.db = db;
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
    return new Promise(async (resolve, reject) => {
      var html = await this.ww.get(
        "watch", "html",
        "https://music.youtube.com/watch?v=" + id,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0" }
        },
      );
      var playerMatch = html.match(/\/s\/player\/([a-z0-9]{8})\/player_.{3}\.vflset\/([a-z]{2}_[A-Z]{2})\/base\.js/);
      if (!playerMatch) return reject("Error downloading player: player URL not found in html");

      var player = new YouTubePlayer(playerMatch[1], playerMatch[2]);
      await player.load(this.db);
      resolve(player);
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
          "context": {
            "client": {"clientName": "ANDROID", "clientVersion": "20.10.38", "userAgent": "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip", "osName": "Android", "osVersion": "11", "hl": "en", "timeZone": "UTC", "utcOffsetMinutes": 0}
          },
          "videoId": id,
          "playbackContext": {
            "contentPlaybackContext": {"html5Preference": "HTML5_PREF_WANTS", "signatureTimestamp": player.sts}
          }, 
          "contentCheckOk": true,
          "racyCheckOk": true,
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
      .then(([ytipr, ytins]) => {
        var info = {
          id: ytipr.videoDetails.videoId,
          title: ytipr.videoDetails.title,
          author: ytipr.videoDetails.author,
          views: parseInt(ytipr.videoDetails.viewCount),
          duration: parseInt(ytipr.videoDetails.lengthSeconds),
          formats: ytipr.streamingData.formats.concat(ytipr.streamingData.adaptiveFormats)
            // .filter(fmt => fmt.mimeType.includes("audio/webm"))
        };

        try {
          var entry = ytins.contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents[0];
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

  async saveSong(song) {
    try {
      await this.db.collection("songs").insertOne({
        id: song.id,
        name: song.name,
        artists: song.artists,
        albums: song.albums,
        year: song.year,
        duration: song.duration,
        img: song.img
      })
    } catch(err) {
      console.error(err);
    }
  }

  // ----- API FUNCTIONS -----

  getVideo(info) {
    // Extracts and unlocks video data from id.
    // The returned Promise resolves on an object containig two fields :
    //  - video : an object with the extracted data and formats
    //  - queue : a list

    if (!("id" in info)) throw new Error("No id provided.");
    if (!info.id.match(/^[a-zA-Z0-9_-]{11}$/)) throw new Error("Invalid id.");
    
    return new Promise((resolve, reject) => {

      console.log(`${new Date().toLocaleString()} EU ${info.id}`)

      Promise.all([
        this.getPlayer(info.id),
        this.downloadQueue(info.id, info.queueId),
      ]).then(res => {
        var [ player, queue ] = res;
        this.downloadVideoData(info.id, player)
        .then(extractedInfo => {
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

          this.saveSong(extractedInfo);

          if (info.withQueue && queue.length == 0) {
            this.downloadQueue(info.id, extractedInfo.queueId).then(queue => {
              resolve({ video: extractedInfo, queue })
            })
          } else {
            resolve({ video: extractedInfo, queue })
          }

        }).catch(reject);
      }).catch(reject);
    })
  }

  async getColors(id, url) {
    // attempting a load from database
    var r = await this.db.collection("palettes").findOne({
      id: { $eq: id }
    });
    if (r) return r.palette;

    // downloading from web
    var palette = await utils.downloadColorPalette(url);
    this.db.collection("palettes").insertOne({ id, palette });
    return palette;
  }
}
