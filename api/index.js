import express from "express";
import { rateLimit } from 'express-rate-limit';
import { MongoClient } from 'mongodb';
import * as fs from "fs";

import * as utils from "./utils.js"
import { YouTubeExtractor } from "./extractor/youtube.js"
import { LastFmNavigator } from "./navigator/lastfm.js";
import { YouTubeNavigator } from "./navigator/youtube.js";
import { addUMFunctions } from "./um/um.js";
import { YouTubeDownloader } from "./downloader/youtube.js";

// ip getter
const getip = (req) => req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

// ----- database connection -----
const mongod_client = new MongoClient(process.env.MONGODB_URI);
await mongod_client.connect();
const db = mongod_client.db("mew");

// request wrapper
const ww = new utils.WebWrapper();

// ----- navigation and extraction -----
var navigators = {
  // lastfm: new YouTubeNavigator(ww),
  lastfm: new LastFmNavigator(ww),
  youtube: new YouTubeNavigator(ww)
};

var extractors = {
  youtube: new YouTubeExtractor(ww, db)
}

var downloaders = {
  youtube: new YouTubeDownloader(ww, db)
}

// ----- logger -----
async function log(type, req, data) {
  console.log(getip(req), type, data)
  db.collection("logs").insertOne({
    ip: getip(req),
    date: new Date(),
    type, data
  })
}

async function logVideo(type, req, video) {
  log(type, req, {
    id: req.params.id,
    title: video.name || video.title,
    artist: video.artists?.map(artist => artist.name)?.join(', ') || video.author
  });
}

// ----- debugger -----
const d = process.env.MEW_DEBUG ? true : false;
if (d) console.log('DEBUG mode');

if (d && !fs.existsSync("./debug")) {
  fs.mkdirSync("./debug");
}

// debug middleware
function dmw(req, res, next) {
  const regex = /[^a-zA-Z0-9]/gi;
  const fpath = './debug/' + decodeURIComponent(req.originalUrl).replaceAll(regex, '_') + '.json'
  if (d && fs.existsSync(fpath)) {
    res.json(JSON.parse(fs.readFileSync(fpath)))
  } else {
    const originalSend = res.send;
    res.send = function(body) {
      if (d) fs.writeFileSync(fpath, body);
      originalSend.call(this, body);
    };
    next();
  }
}

// ----- web server -----
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// throttling
const limiter = rateLimit({
  windowMs: 1 * 1000, // 1 second
  limit: 4,
  keyGenerator: getip
})

// app.use(limiter);

// ----- API itself -----

app.get('/api/search_suggestions/:query', async (req, res) => {
  const results = await navigators.youtube.searchSuggestions(req.params.query);
  res.json(results);
})

app.get('/api/search/:query', dmw, async (req, res) => {
  const results = await navigators.youtube.search(req.params.query);
  log('search', req, { query: req.params.query });
  res.json(results);
});

app.get('/api/artist/:id', dmw, async (req, res) => {
  const artist = await navigators.youtube.artist(req.params.id);
  res.json(artist);
})

app.get('/api/album/:id', dmw, async (req, res) => {
  const album = await navigators.youtube.album(req.params.id);
  res.json(album);
})

app.get('/api/album/:arid/:alid', dmw, async (req, res) => {
  const album = await navigators.lastfm.album(req.params.arid + '/' + req.params.alid);
  res.json(album);
})

app.get('/api/video/:id', dmw, async (req, res) => {
  try {
    const obj = { id: req.params.id };
    var params = utils.parseQueryString(req._parsedUrl.query);
    if (params.queueId) obj.queueId = params.queueId;
    if (params.qid) obj.queueId = params.qid;
    if (params.wq) obj.withQueue = true;
    const video = await extractors.youtube.getVideo(obj);
    logVideo("video", req, video.video);
    res.json(video);
  } catch(error) {
    console.error(error);
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/img', (req, res) => {
  var params = utils.parseQueryString(req._parsedUrl.query);
  ww.get(
    "thumbnail", "png",
    params.url,
    { responseType: 'stream' }
  ).then(axres => {
      res.status(200);
      axres.pipe(res);
  }).catch(err => {
      res.status(500);
      res.json({ message: err.toString() })
  })
})

app.get('/api/colors', async (req, res) => {
  var params = utils.parseQueryString(req._parsedUrl.query);
  if (!params.id) throw new Error("No id provided.");
  if (!params.url) throw new Error("No url provided.");
  const palette = await extractors.youtube.getColors(params.id, params.url);
  res.json(palette);
})

// ----- um -----
const authenticateJWT = addUMFunctions(app, db);

app.get('/api/download/:id', authenticateJWT, async (req, res) => {
  try {
    const obj = { id: req.params.id };
    const video = await extractors.youtube.getVideo(obj);
    logVideo("download", req, video.video);
    const stream = await downloaders.youtube.fastDownloadStream(video.video);
    stream.pipe(res);
  } catch(error) {
    res.status(400).json({ error: error.message })
  }
});

app.get('/api/convert/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!downloaders.youtube.getProgress(id)) {
      const video = await extractors.youtube.getVideo({ id });
      logVideo("convert", req, video.video);
      downloaders.youtube.downloadAndConvert(video.video, db);
    }
    res.status(200).json(downloaders.youtube.getProgress(id));
  } catch(error) {
    console.error(error);
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/converted/:id', authenticateJWT, async (req, res) => {
  try {
    const path = `./downloads/${req.params.id}.mp3`;
    if (fs.existsSync(path)) {
      fs.createReadStream(path).pipe(res);
    } else {
      throw new Error('This song is not downloaded.');
    }
  } catch(error) {
    console.error(error);
    res.status(400).json({ error: error.message })
  }
})

// await downloaders.youtube.downloadAndConvert({"id":"uSDWUx7S8dw","title":"Space Song","author":"Beach House - Topic","views":43164216,"duration":321,"type":"VIDEO","img":{"type":"youtube","thumbnails":[{"url":"https://lh3.googleusercontent.com/---oylKN4YRzPeM14RDl6Ykay_3ZUiLMheCq2eUZRybP0kLTOQO8qyrBjkfknckjOKgk8YBvntXqXSk=w60-h60-l90-rj","width":60,"height":60},{"url":"https://lh3.googleusercontent.com/---oylKN4YRzPeM14RDl6Ykay_3ZUiLMheCq2eUZRybP0kLTOQO8qyrBjkfknckjOKgk8YBvntXqXSk=w120-h120-l90-rj","width":120,"height":120},{"url":"https://lh3.googleusercontent.com/---oylKN4YRzPeM14RDl6Ykay_3ZUiLMheCq2eUZRybP0kLTOQO8qyrBjkfknckjOKgk8YBvntXqXSk=w180-h180-l90-rj","width":180,"height":180},{"url":"https://lh3.googleusercontent.com/---oylKN4YRzPeM14RDl6Ykay_3ZUiLMheCq2eUZRybP0kLTOQO8qyrBjkfknckjOKgk8YBvntXqXSk=w226-h226-l90-rj","width":226,"height":226},{"url":"https://lh3.googleusercontent.com/---oylKN4YRzPeM14RDl6Ykay_3ZUiLMheCq2eUZRybP0kLTOQO8qyrBjkfknckjOKgk8YBvntXqXSk=w302-h302-l90-rj","width":302,"height":302},{"url":"https://lh3.googleusercontent.com/---oylKN4YRzPeM14RDl6Ykay_3ZUiLMheCq2eUZRybP0kLTOQO8qyrBjkfknckjOKgk8YBvntXqXSk=w544-h544-l90-rj","width":544,"height":544}]},"name":"Space Song","artists":[{"name":"Beach House","id":"UC785fnTclD2P2WQXRAt2BVg"}],"albums":[{"name":"Depression Cherry","id":"MPREb_JD8fSyZAVuz"}],"year":2015,"queueId":"RDAMVMuSDWUx7S8dw","stream":{"url":"https://rr4---sn-25ge7nz6.googlevideo.com/videoplayback?expire=1766371686&ei=BV1IadTlOufkxN8P87Xr2A8&ip=2a01%3Ae0a%3A998%3Ad520%3Ad230%3A9a73%3A54bd%3A6d55&id=o-AAHbBmSLkuSCZny7PeTBABg-yoeJXh7piKCQhqopNNIC&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&cps=247&met=1766350085%2C&mh=0l&mm=31%2C26&mn=sn-25ge7nz6%2Csn-5hnekn7l&ms=au%2Conr&mv=m&mvi=4&pl=50&rms=au%2Cau&gcr=fr&initcwndbps=3028750&bui=AYUSA3CP20pNe8pVmCFBMC0aAB4CGgLrgfmxozoast9oaNHtylZ_g8qEC2saIV4fa62C40_l8GMptJ97&spc=wH4Qq3Cnr6xE&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=5470231&dur=320.481&lmt=1714886077529257&mt=1766349697&fvip=5&keepalive=yes&fexp=51552689%2C51565115%2C51565681%2C51580968&c=ANDROID&txp=4532434&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cgcr%2Cbui%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRgIhAPTa9VEXrSeYhUfv2fXs_IOljuw7Ba1tHVLSL38NVDNVAiEAgfhtH6i3M2YYmzcI1byMMMuyQ9z1ld7viqxgRYwkprg%3D&lsparams=cps%2Cmet%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps&lsig=APaTxxMwRAIgaSmgiEEKoqTSNVGoE6raRwEjQfGKXp01-XP1AjCuzoICIFLhkxD6HpKIV4IOhvJ1_n0OZWzZS5n78TVtSLLLKDHs","bitrate":151963,"mimeType":"audio/webm; codecs=\"opus\""}}, db)

const PORT = process.env.PORT_API || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
