const fs = require('fs');
const axios = require('axios');

function parseQueryString(qs) {
    var params = new URLSearchParams(qs);
    var object = {};
    for (var [key, value] of params.entries()) {
        object[key] = value;
    }
    return object;
}

function replaceUrlParam(url, paramName, paramValue) {
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

function extractBracketsCode(beginIndex, jsCode) {
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

function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

async function downloadFile(fileUrl, outputLocationPath, headers = {}, onProgress = () => {}) {
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


function durationToString(d) {
    const pad = (i, w, s) => (s.length < i) ? pad(i, w, w + s) : s;
    return Math.floor(d / 60) + ':' + pad(2, '0', (d%60).toString())
}

function viewsToString(v) {
    if (Math.floor(v/1e9) > 0) return `${Math.floor(v/1e8)/10}Mds`
    if (Math.floor(v/1e6) > 0) return `${Math.floor(v/1e5)/10}M`
    if (Math.floor(v/1e3) > 0) return `${Math.floor(v/1e2)/10}k`
    return v.toString()
}

function chooseFormat(formats) {
    var audioSorted = formats
        .filter(fmt => fmt.mimeType.includes("audio/webm"))
        .sort((fmt1, fmt2) => fmt2.bitrate - fmt1.bitrate)
    if (audioSorted) return audioSorted[0];
    return formats[1];
}

function chooseThumbnail(thumbnails, width=Infinity) {
    var sorted = thumbnails
        .sort((thb1, thb2) => thb2.width - thb1.width);
    var filtered = sorted.filter(thb => thb.width <= width)
    if (filtered.length > 0) return filtered[0]
    return sorted[0];
}

module.exports = {
    parseQueryString,
    replaceUrlParam,
    extractBracketsCode,
    isIterable,
    downloadFile,
    durationToString,
    viewsToString,
    chooseFormat,
    chooseThumbnail,
    mds: ' · '
}