import { get } from "https";
import * as utils from "../utils.js";
import fs from "fs";

export class YouTubeDownloader {
  constructor(ww, db) {
    this.ww = ww;
    this.db = db;

    this.savepath = "./downloads/";
    if (!fs.existsSync(this.savepath)) {
      fs.mkdirSync(this.savepath)
    }
  }

  fastDownloadStream(video) {
    return new Promise((resolve, reject) => {
      // const wpath = `${this.savepath}${video.id}.webm`;
      // const wstream = fs.createWriteStream(wpath);
      get(
        video.stream.url,
        { headers: { 'Range': 'bytes=0-' } }, // magic here
        res => {
          resolve(res);
          // res.pipe(wstream);
          // res.on('data', chunk => {
          //   console.log(chunk.length)
          // })
        }
      )
    })
  }
}