import { get } from "https";
import fs from "fs";
import { FFMpegProgress } from "ffmpeg-progress-wrapper";

export class YouTubeDownloader {
  constructor(ww, db) {
    this.ww = ww;
    this.db = db;

    this.savepath = "./downloads/";
    this.tmppath = "./downloads/tmp/";
    if (!fs.existsSync(this.savepath)) {
      fs.mkdirSync(this.savepath)
    }
    if (!fs.existsSync(this.tmppath)) {
      fs.mkdirSync(this.tmppath)
    }

    this.progress = {};
  }

  getProgress(id) {
    if (id in this.progress) {
      if (this.progress[id].state == 4) {
        if (fs.existsSync(`${this.savepath}${id}.mp3`)) {
          return this.progress[id]
        } else {
          return null;
        }
      }
      return this.progress[id];
    }
  }

  fastDownloadStream(video) {
    return new Promise((resolve, reject) => {
      get(
        video.stream.url,
        { headers: { 'Range': 'bytes=0-' } }, // magic here
        resolve
      )
    })
  }

  fastDownload(video, wpath, onProgress) {
    return new Promise((resolve, reject) => {
      const wstream = fs.createWriteStream(wpath);
      get(
        video.stream.url,
        { headers: { 'Range': 'bytes=0-' } }, // magic here
        res => {
          res.pipe(wstream);
          var size = parseInt(res.headers['content-length']);
          var readSize = 0;
          res.on('data', chunk => {
            readSize += chunk.length;
            onProgress(readSize / size);
          });
          res.on('end', () => {
            wstream.close();
            resolve();
          })
        }
      )
    })
  }

  chooseThumbnailUrl(img, width=Infinity) {
    if (typeof img == "object" && img.type == "lastfm") {
      var w = width == Infinity ? 400 : Math.ceil(width / 20) * 20;
      return `https://lastfm.freetls.fastly.net/i/u/${w}x${w}/${img.id}.jpg`
    }
    if (typeof img == "object" && img.type == "youtube") {
      return this.chooseThumbnailUrl(img.thumbnails, width);
    }
    if (!img || img.length == 0) return;
    if (typeof img == 'string') img = JSON.parse(img);
    img = JSON.parse(JSON.stringify(img))
    var sorted = img
      .sort((thb1, thb2) => thb2.width - thb1.width);
    var filtered = sorted.filter(thb => thb.width <= width)
    if (filtered.length > 0) return filtered[0].url;
    return sorted[sorted.length - 1].url;
  }

  downloadImage(img, ipath) {
    return new Promise((resolve, reject) => {
      const url = this.chooseThumbnailUrl(img, 300);
      const wstream = fs.createWriteStream(ipath);
      get(
        url,
        { headers: { 'Range': 'bytes=0-' } },
        res => {
          res.pipe(wstream);
          res.on('end', () => {
            wstream.close();
            resolve();
          })
        }
      )
    })
  }

  convertToMp3(wpath, mpath, onProgress) {
    return new Promise(async (resolve, reject) => {
      const process = new FFMpegProgress([ '-i', wpath, mpath, '-y' ]);
      process.on('progress', progress => onProgress(progress.progress * 1000));
      await process.onDone();
      resolve();
    })
  }

  downloadAndConvert(video, db) {
    return new Promise(async (resolve, reject) => {
      const wpath = `${this.tmppath}${video.id}.webm`;
      const ipath = `${this.tmppath}${video.id}.jpeg`;
      const mpath = `${this.tmppath}${video.id}.mp3`;
      const fpath = `${this.savepath}${video.id}.mp3`;

      this.progress[video.id] = {
        state: 0,
        progress: 0
      };

      const onProgress = (state, progress) => {
        this.progress[video.id].state = state;
        this.progress[video.id].progress = Math.round(progress * 100);
      }

      if (fs.existsSync(fpath)) {
        onProgress(4, 0);
        return resolve();
      }

      // var j = 0, i = 0;
      // var interval;
      // interval = setInterval(() => {
      //   onProgress(j, i);
      //   i += 2;
      //   if (i == 100) {
      //     i = 0;
      //     j++;
      //     if (j == 4) {
      //       clearInterval(interval);
      //       onProgress(4, 0);
      //       resolve();
      //     }
      //   }
      // }, 30);

      await this.fastDownload(video, wpath, p => onProgress(1, p));
      
      Promise.all([
        this.downloadImage(video.img, ipath),
        this.convertToMp3(wpath, mpath, p => onProgress(2, p)),
      ]).then(async () => {
        const title = video.name || video.title;
        const artist = video.artists?.map(artist => artist.name)?.join(', ') || video.author;
        const album = video.albums?.map(album => album.name)?.join(', ') || video.id;
        const process = new FFMpegProgress([
          '-i', mpath, '-i', ipath,
          '-map', '0:0', '-map', '1:0', '-c', 'copy', '-id3v2_version', '3', '-metadata:s:v', 'title="Album cover"', '-metadata:s:v', 'comment="Cover (front)"',
          '-metadata', `title=${title}`,
          '-metadata', `artist=${artist}`,
          '-metadata', `album=${album}`,
          fpath, '-y' 
        ]);
        onProgress(3, 0)
        await process.onDone();
        onProgress(4, 0)
        resolve();
      })
    })
  }
}