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
    // beginIndex-1 -> {
    let index = beginIndex;
    let depth = 1;
    while (depth > 0 && index < jsCode.length) {
        if (jsCode[index] == '{') depth++;
        if (jsCode[index] == '}') depth--;
        index++;
    }
    var endIndex = index - 1;
    return jsCode.substring(beginIndex, endIndex)
}

function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

async function downloadFile(fileUrl, outputLocationPath, headers = {}) {
    const writer = fs.createWriteStream(outputLocationPath);
    const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
        headers
    });
    return await new Promise((resolve, reject) => {
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

module.exports = {
    parseQueryString,
    replaceUrlParam,
    extractBracketsCode,
    isIterable,
    downloadFile
}