import fs from "fs";
import axios from "axios";
import { extractColors } from "extract-colors"
import getPixels from "get-pixels";

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function parseQueryString(qs) {
  var params = new URLSearchParams(qs);
  var object = {};
  for (var [key, value] of params.entries()) {
    object[key] = value;
  }
  return object;
}

export function replaceUrlParam(url, paramName, paramValue) {
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

export function extractBracketsCode(beginIndex, jsCode) {
  let index = beginIndex;
  let depth = 1;
  let stringIn = null;
  let escape = false;

  while (depth > 0 && index < jsCode.length) {
    const char = jsCode[index];

    if (stringIn === null) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
      } else if (char === '"' || char === "'") {
        stringIn = char;
      } else if (char === '/') {
        // Check if the '/' is likely a regex or a division
        const prevChar = jsCode[index - 1];
        if (prevChar === '(' || prevChar === '=' || prevChar === ':' || prevChar === ',' || /\s/.test(prevChar)) {
          stringIn = '/'; // Treat as regex
        }
      }
    } else {
      if (char === stringIn && !escape) {
        stringIn = null;
      }
      escape = (char === '\\') && !escape;
    }

    index++;
  }

  const endIndex = index - 1;
  return jsCode.substring(beginIndex, endIndex);
}

export const isIterable = object => object != null && typeof object[Symbol.iterator] === 'function';

export async function downloadFile(fileUrl, outputLocationPath, headers = {}, onProgress = () => {}) {
  var writer = fs.createWriteStream(outputLocationPath);
  var response = await axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
    headers
  });
  var totalLength = parseInt(response.headers['content-length']);
  var downloadedLength = 0;

  return await new Promise((resolve, reject) => {
    response.data.on('data', chunk => {
      downloadedLength += chunk.length
      onProgress(downloadedLength / totalLength);
    })
    response.data.pipe(writer);
    let error = null;
    writer.on('error', err => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) {
        resolve(true);
      }
    });
  });
}


export function durationToString(d) {
  const pad = (i, w, s) => (s.length < i) ? pad(i, w, w + s) : s;
  return Math.floor(d / 60) + ':' + pad(2, '0', (d%60).toString())
}

export function stringToDuration(str) {
  var d = 0;
  for (const i of str.split(':').map(parseFloat)) {
    d = d * 60 + i;
  }
  return d;
}

export function viewsToString(v) {
  if (Math.floor(v/1e9) > 0) return `${Math.floor(v/1e8)/10}Mds`
  if (Math.floor(v/1e6) > 0) return `${Math.floor(v/1e5)/10}M`
  if (Math.floor(v/1e3) > 0) return `${Math.floor(v/1e2)/10}k`
  return v.toString()
}

export function parseViewCount(str) {
  var viewsMatch = str.match(/(\d+,\d+|\d+)( (k|M))?/);
  const multiplier = {
    undefined: 1,
    k: 1e3,
    M: 1e6
  }
  return parseFloat(viewsMatch[1].replaceAll(',', '.')) * multiplier[viewsMatch[3]]
}

export function chooseFormat(formats) {
  var audioSorted = formats
    .filter(fmt => fmt.mimeType.includes("audio/webm"))
    .sort((fmt1, fmt2) => fmt2.bitrate - fmt1.bitrate)
  if (audioSorted) return audioSorted[0];
  return formats[1];
}

export function chooseThumbnail(thumbnails, width=Infinity) {
  if (!isIterable(thumbnails)) return {}
  var sorted = thumbnails
    .sort((thb1, thb2) => thb2.width - thb1.width);
  var filtered = sorted.filter(thb => thb.width <= width)
  if (filtered.length > 0) return filtered[0]
  return sorted[sorted.length - 1];
}

export function chooseThumbnailUrl(thumbnails, width=Infinity) {
  if (!thumbnails || thumbnails.length == 0) return;
  if (typeof thumbnails == 'string') thumbnails = JSON.parse(thumbnails)
  var sorted = thumbnails
    .sort((thb1, thb2) => thb2.width - thb1.width);
  var filtered = sorted.filter(thb => thb.width <= width)
  if (filtered.length > 0) return filtered[0].url;
  return sorted[sorted.length - 1].url;
}

export function formatBytes(a,b=2){if(!+a)return"0 Bytes";const c=0>b?0:b,d=Math.floor(Math.log(a)/Math.log(1024));return`${parseFloat((a/Math.pow(1024,d)).toFixed(c))} ${["Bytes","KiB","MiB","GiB","TiB","PiB","EiB","ZiB","YiB"][d]}`}

export function fillstr(str, length, c = ' ') {
  if (str.length < length) return fillstr(str + c, length, c);
  return str;
}

export class WebWrapper {
  // simplifies methods for scraping from web / save (for debug mode)

  constructor() {
    this.savepath = "./api_requests";
    if (!fs.existsSync(this.savepath)) {
      fs.mkdirSync(this.savepath)
    }
  }

  path(name, type) {
    return `${this.savepath}/${name}.${type}`;
  }

  objToString(type, data) {
    if (type == "json") return JSON.stringify(data);
    return data.toString();
  }

  stringToObj(type, data) {
    if (type == "json") return JSON.parse(data);
    return data.toString();
  }

  request(method, name, type, url, data, options={}) {
    return new Promise((resolve, reject) => {

      var path = this.path(name, type);
      if (options.load && fs.existsSync(path)) {
        resolve(this.stringToObj(type, fs.readFileSync(path)));
        return;
      }

      var request = method == 'GET'
        ? axios.get(url, options)
        : axios.post(url, data, options);

      request.then(res => {
        if (Math.floor(res.status / 100) != 2) {
          reject(`${method} request (${name}) failed : status ${res.status} (url : ${url})`);
          return;
        }

        var size = res.headers['content-length']
          ? parseInt(res.headers['content-length'])
          : (type == 'json' ? JSON.stringify(res.data) : res.data).length;
        console.log(`  ${fillstr(method, 4)} ${res.status} [ ${fillstr(formatBytes(size), 11)} ] ${name}`);

        if (options.save) {
          fs.writeFileSync(path, this.objToString(type, res.data));
        }

        resolve(res.data);
      }).catch(reject);
    })
  }

  get(name, type, url, options={}) {
    return this.request('GET', name, type, url, null, options);
  }

  post(name, type, url, data, options={}) {
    return this.request('POST', name, type, url, data, options);
  }
}

export function downloadColorPalette(url) {
  return new Promise((resolve, reject) => {
    getPixels(url, (err, pixels) => {
      if (err) return reject(err);
      extractColors(pixels)
      .then(colors => {
        resolve(colors.slice(0,3).map(color => {
          return { r: color.red, g: color.green, b: color.blue }
        }));
      })
      .catch(reject);
    });
  })
}

export const mds = ' · ';
