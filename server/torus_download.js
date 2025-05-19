const https = require("https");

const youtube_stream = (playerurl, format) => {

    const get_obj = (plain, objname) => {
        const obj_match = plain.indexOf(`var ${objname}={`)
        var object = ""
        var state = 0
        for (const c of plain.substring(obj_match + 7)) {
            object += c
            if (c == '{') state += 1
            else if (c == '}') state += -1
            if (state == 0) break
        }
        return object
    }

    const function_roles = object => {
        var funs = [];
        var last = "";
        var parstate = 0;
        for (const c of object.substring(1, object.length - 1)) {
            if (c == "\n") continue
            last += c
            if (c == '(') parstate += 1
            else if (c == ')') parstate += -1
            else if (c == ',') if (parstate == 0) { funs.push(last); last = ""; }
        }
        funs.push(last)
        var rfuns = {}
        const fun_name = fun => fun.match("[a-zA-Z0-9]{2}")[0]
        for (const f of funs) {
            if (f.includes("length")) rfuns.percent = fun_name(f)
            else if (f.includes("reverse")) rfuns.reverse = fun_name(f)
            else if (f.includes("splice")) rfuns.splice = fun_name(f)
        }
        return rfuns
    }

    const function_calls = (plain, i, roles) => {
        var last = "";
        var calls = [];
        const get_role = f => {
            for (const k of Object.keys(roles)) if (roles[k] == f) return k
        }
        for (const c of plain.substring(i + 1)) {
            last += c;
            if (c == '}') return calls
            else if (c == ';') {
                calls.push([
                    get_role(last.substring(3, 5)), 
                    parseInt(last.substring(last.indexOf(',') + 1, last.length - 2))
                ])
                last = "";
            }
        }
    }

    const decrypt_key = (ekey, calls) => {
        const obj = {
            percent: (a, b) => { var c = a[0]; a[0] = a[b % a.length]; a[b % a.length] = c },
            reverse: (a, b) => a.reverse(),
            splice:  (a, b) => a.splice(0, b)
        }
        var a = ekey.split("");
        for (const call of calls) obj[call[0]](a, call[1]);
        return a.join("");
    }

    return new Promise((resolve, reject) => {
        if (format.url) resolve(format.url)
        else https.get(playerurl, res => {
            var plain = "";
            res.on("data", d => plain += d);
            res.on("end", () => {
                const reg = /[a-zA-Z0-9]{2}=function\(a\)\{a=a\.split\(""\);/;
                const fi = plain.search(reg) + 28;
                const objname = plain.substring(fi + 1, fi + 3);
                const object = get_obj(plain, objname);
                const roles = function_roles(object);
                const calls = function_calls(plain, fi, roles);

                const cipher = format.signatureCipher.split("&").map(a => a.split("=")[1]);
                const encrypted_key = decodeURIComponent(cipher[0]);
                const clear_key = decodeURIComponent(decrypt_key(encrypted_key, calls, roles));
                resolve(`${decodeURIComponent(cipher[2])}&${cipher[1]}=${clear_key}`);
            })
        }).on("err", () => reject("oups") )
    })
}

const treat_title = (title, artist) => {
    return [ title, artist ];
}

const youtube_meta_and_stream = id => {
    const best_format = formats => {
        var optii = 0
        var optiv = 0
        for (const i in formats) {
            const f = formats[i];
            if (f.mimeType.indexOf("audio") != -1) {
                bitrate = f.bitrate
                if (bitrate > optiv) {
                    optii = i
                    optiv = bitrate
                }
            }
        }
        return formats[optii]
    }

    const url = `https://www.youtube.com/watch?v=${id}`

    return new Promise((resolve, reject) => {
        https.get(url, res => {
            var plain = "";
            if (res.statusCode != 200) return reject(res.statusCode);
            res.on("data", d => { plain += d });
            res.on("end", () => {
                var playerurl = plain.substring(plain.indexOf("jsUrl") + 8);
                playerurl = "https://www.youtube.com" + playerurl.substring(0, playerurl.indexOf('"'));
                
                var body = plain.substring(plain.indexOf("<body"), plain.indexOf("</body"));
                body = body.substring(body.indexOf('>') + 1)
            
                var script = body.substring(body.indexOf("<script"), body.indexOf("</script"))
                script = script.substring(script.indexOf('>') + 1)
            
                var ytd = script.substring(script.indexOf("ytInitialPlayerResponse"))
                ytd = ytd.substring(ytd.indexOf('{'), ytd.lastIndexOf('}') + 1)
                ytd = JSON.parse(ytd)

                const formats = ytd.streamingData.adaptiveFormats
                const bformat = best_format(formats)

                
                var vdata = ytd.videoDetails
                var [ title, artist ] = treat_title(vdata.title, vdata.author)
                
                meta = {
                    id, title, artist,
                    album: title,
                    duration: parseInt(vdata.lengthSeconds),
                    viewcount: parseInt(vdata.viewCount),
                    rating: parseFloat(vdata.averageRating),
                    miniature: vdata.thumbnail.thumbnails.pop().url,
                    length: parseInt(bformat.contentLength)
                }
                
                youtube_stream(playerurl, bformat).then(stream => {
                    meta.stream = stream
                    resolve(meta)
                })
            })
        }).on("error", err => reject(err));
    })
}

youtube_meta_and_stream("ImKY6TZEyrI").then(meta => {
    console.log(meta)
}).catch(err => {
    console.log(err)
})