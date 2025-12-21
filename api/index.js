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
    log('song', req, {
      id: req.params.id,
      title: video.video.title,
      artist: video.video.artists.map(artist => artist.name).join(', ')
    });
    res.json(video);
  } catch(error) {
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
    log('download', req, {
      id: req.params.id,
      title: video.video.title,
      artist: video.video.artists.map(artist => artist.name).join(', ')
    });
    const stream = await downloaders.youtube.fastDownloadStream(video.video);
    stream.pipe(res);
  } catch(error) {
    res.status(400).json({ error: error.message })
  }
})

const PORT = process.env.PORT_API || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
