const regescape = require('regexp.escape');
const utils = require('./utils')

class YTPlayer {
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
                sfc: this.sfc,
                nfc: this.nfc,
            });
        return '{}';
    }

    buildUrl() {
        return `https://music.youtube.com/s/player/${this.pid}/player_ias.vflset/${this.plg}/base.js`;
    }

    downloadFromWeb() {
        return new Promise((resolve, reject) => {
            this.ww.get(
                "player_ias", "js",
                this.buildUrl()
            ).then(js => {
                this.js = js;
                resolve()
            }).catch(reject)
        })
    }

    extractSigFunctionCodeFromName(sigFuncName) {
        var match = this.js.match(`${regescape(sigFuncName)}=function\\((\\w+)\\)`);
        if (!match) throw `Error while extracting player: function ${sigFuncName} not found in JS player code.`
        var B = match[1];
        var coreCode = utils.extractBracketsCode(match.index + match[0].length + 1, this.js);
        var rawInstructions = coreCode.split(';')

        var matchY = rawInstructions[0].match(`${regescape(B)}=${regescape(B)}\\[([a-zA-Z]+)\\[([0-9]+)\\]\\]\\(\\1\\[([0-9]+)\\]\\)`)
        if (!matchY) throw "Error while extracting player: Y not matched in function code";
        var Y = matchY[1];
        var Yobj;
        for (const matchYReg of [
            `var ${regescape(Y)}='(.+)'\\.split\((.{3})\)`,
            `var ${regescape(Y)}="(.+)"\\.split\((.{3})\)`
        ]) {
            var matchYobj = this.js.match(matchYReg);
            if (matchYobj) {
                Yobj = matchYobj[1].split(matchYobj[2][2]);
            }
        }
        if (!Yobj) throw "Error while extracting player: could not find Y code";

        var matchH = rawInstructions[1].match(`^(.+)\\[${regescape(Y)}\\[([0-9]+)\\]\\]\\(${regescape(B)},([0-9])+\\)$`)
        if (!matchH) throw "Error while extracting player: H not matched in function code";
        var H = matchH[1];
        var Hcode = utils.extractBracketsCode(this.js.indexOf(`var ${H}=`) + 6 + H.length, this.js).replaceAll('\n', '')

        var matchYrep;
        while (matchYrep = Hcode.match(`${regescape(Y)}\\[([0-9]+)\\]`)) {
            Hcode = Hcode.replaceAll(matchYrep[0], "'" + Yobj[matchYrep[1]] + "'")
        }

        while (matchYrep = coreCode.match(`${regescape(Y)}\\[([0-9]+)\\]`)) {
            coreCode = coreCode.replaceAll(matchYrep[0], "'" + Yobj[matchYrep[1]] + "'")
        }

        this.sfc = `${B}=>{var ${H}={${Hcode}};${coreCode}}`;
        return [ Y, Yobj ];
    }

    extractNFunctionCodeFromName(nFuncName, Y, Yobj) {
        var match = this.js.match(`${regescape(nFuncName)}=function\\((\\w+)\\)`);
        if (!match) throw `N Function ${nFuncName} not found in player code`
        var B = match[1];
        var coreBegin = this.js.substring(match.index + match[0].length + 1);
        var returnMatch = coreBegin.match(/return \w[\w\[[0-9]+\]\]\(\w\[[0-9]+\]\)\};/);
        if (!returnMatch) throw `N Function ${nFuncName} not found in player code (could not match return)`;
        var coreCode = coreBegin.substring(0, returnMatch.index + returnMatch[0].length - 2);

        var undefinedIdx = Yobj.includes('undefined') ? Yobj.indexOf('undefined') : '[0-9]+';

        var match = coreCode.match(`;\\s*if\\s*\\(\\s*typeof\\s+[a-zA-Z0-9_$]+\\s*===?\\s*(?:(["\\'])undefined\\1|${regescape(Y)}\\[${undefinedIdx}\\])\\s*\\)\\s*return\\s+${regescape(B)};`)
        var fixedNFuncCode = coreCode.replace(match[0], ";")

        this.nfc = `${B}=>{var ${Y}=${JSON.stringify(Yobj)};${fixedNFuncCode}}`
    }

    dbLoad(pdb) {
        return pdb.loadPlayer(this)
    }

    downloadAndParse(pdb) {
        return new Promise((resolve, reject) => {
            this.dbLoad(pdb).then(res => {
                resolve()
            }).catch(err => {
                console.log("Player not saved, downloading from Web :", this.buildUrl())
                this.downloadFromWeb().then(() => {
                    try {
                        // extracting signature timestamp from player (to indicate API which player version we're using)
                        var matchSTS = this.js.match(/signatureTimestamp:([0-9]+)[,}]/)
                        if (!matchSTS) return reject("Could not find signature timestamp from player");
                        this.sts = matchSTS[1];
    
                        var sigregexps = [
                            // /\b(?P<var>[a-zA-Z0-9_$]+)&&\((?P=var)=(?P<sig>[a-zA-Z0-9_$]{2,})\(decodeURIComponent\((?P=var)\)\)/,
                            [ /\b([a-zA-Z0-9_$]+)&&\(\1=([a-zA-Z0-9_$]{2,})\(decodeURIComponent\(\1\)\)/, 2 ],
    
                            // /(?P<sig>[a-zA-Z0-9_$]+)\s*=\s*function\(\s*(?P<arg>[a-zA-Z0-9_$]+)\s*\)\s*{\s*(?P=arg)\s*=\s*(?P=arg)\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+(?P=arg)\.join\(\s*""\s*\)/,
                            // [ /([a-zA-Z0-9_$]+)\s*=\s*function\(\s*([a-zA-Z0-9_$]+)\s*\)\s*{\s*\2\s*=\s*\2\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+\2\.join\(\s*""\s*\)/, 1 ],
    
                            // /(?:\b|[^a-zA-Z0-9_$])(?P<sig>[a-zA-Z0-9_$]{2,})\s*=\s*function\(\s*a\s*\)\s*{\s*a\s*=\s*a\.split\(\s*""\s*\)(?:;[a-zA-Z0-9_$]{2}\.[a-zA-Z0-9_$]{2}\(a,[0-9]+\))?/,
                            // // Old patterns
                            // '\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*encodeURIComponent\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\b[a-zA-Z0-9]+\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*encodeURIComponent\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\bm=(?P<sig>[a-zA-Z0-9$]{2,})\(decodeURIComponent\(h\.s\)\)',
                            // // Obsolete patterns
                            // '("|\')signature\x01\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\.sig\|\|(?P<sig>[a-zA-Z0-9$]+)\(',
                            // 'yt\.akamaized\.net/\)\s*\|\|\s*.*?\s*[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*(?:encodeURIComponent\s*\()?\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                            // '\bc\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*\([^)]*\)\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
                        ];
                        var sigFuncName;
                        for (var sigregexp of sigregexps) {
                            var match = this.js.match(sigregexp[0]);
                            if (match) {
                                sigFuncName = match[sigregexp[1]];
                                break;
                            }
                        }
                        if (!sigFuncName) return reject("Could not extract signature cipher function name");

                        // var match = player.match(/(?xs)[;\n](?:(?P<f>function\s+)|(?:var\s+)?)(?P<funcname>[a-zA-Z0-9_$]+)\s*(?(f)|=\s*function\s*)\((?P<argname>[a-zA-Z0-9_$]+)\)\s*\{(?:(?!\}[;\n]).)+\}\s*catch\(\s*[a-zA-Z0-9_$]+\s*\)\s*\{\s*return\s+%s\[%d\]\s*\+\s*(?P=argname)\s*\}\s*return\s+[^}]+\}[;\n]/)
                        var matchNFuncName = this.js.match(/\nvar ([a-zA-Z_$][a-zA-Z0-9_$]*)=\[([a-zA-Z_$][a-zA-Z0-9_$]*)\];/)
                        if (!matchNFuncName) return reject("Could not extract n cipher function name");
                        var nFuncName = matchNFuncName[2];

                        console.log("player parsing", this.pid, sigFuncName, nFuncName)
                        
                        var [ Y, Yobj ] = this.extractSigFunctionCodeFromName(sigFuncName);
                        this.extractNFunctionCodeFromName(nFuncName, Y, Yobj);
                        
                        console.log(Y, JSON.stringify(Yobj));
                        console.log(this.sfc)
                        // console.log(this.nfc)

                        this.extracted = true;

                        pdb.savePlayer(this);

                        resolve()
                    } catch(err) {
                        reject(err)
                    }
                }).catch(reject);
            })
        })
    }

    decryptFormatStreamUrl(format) {
        if (!this.extracted) throw "Player data is not extracted"

        if (format.signatureCipher) {
            var sc = utils.parseQueryString(format.signatureCipher);
            var url = `${sc.url}&${sc.sp || "signature"}=${encodeURIComponent((eval(this.sfc))(sc.s))}`;
            var urlParams = utils.parseQueryString(url);
            if ('n' in urlParams) {
                var nDecrypted = eval(this.nfc)(urlParams.n)
                url = utils.replaceUrlParam(url, 'n', nDecrypted)
            }
            return url
        }

        // old school video
        var url = format.url;
        var sc = utils.parseQueryString(url);
        url = utils.replaceUrlParam(url, 'n', encodeURIComponent((eval(this.nfc))(sc.n)))
        return url;
    }
}

module.exports = YTPlayer;