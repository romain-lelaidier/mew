const mds = ' · ';

function songDetailsSpan(r) {
    var songDetails = [];
    if ('year' in r) songDetails.push(r.year.toString())
    if ('duration' in r) songDetails.push(durationToString(r.duration));
    if ('viewCount' in r) songDetails.push(viewsToString(r.viewCount));
    return songDetails.length > 0 ? '<br><span>' + songDetails.join(mds) + '</span>' : '';
}

function durationToString(d) {
    const pad = (i, w, s) => (s.length < i) ? pad(i, w, w + s) : s;
    return Math.floor(d / 60) + ':' + pad(2, '0', Math.round(d%60).toString())
}

function viewsToString(v) {
    if (Math.floor(v/1e9) > 0) return `${Math.floor(v/1e8)/10}Mds`
    if (Math.floor(v/1e6) > 0) return `${Math.floor(v/1e5)/10}M`
    if (Math.floor(v/1e3) > 0) return `${Math.floor(v/1e2)/10}k`
    return v.toString()
}

function buildRecent(recents) {
    let html = '';
    recents
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 4)
    .forEach(r => {
        if (r.type == "VIDEO") {
            html += `<a href="/web/play/${r.id}" class="song"><img loading="lazy" class="thumbnail" src="${r.thumbnail}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${mds}<span><i>${r.album}</i></span>${songDetailsSpan(r)}</div></a>`
        } else if (r.type == "ALBUM") {
            html += `<a href="/web/album/${r.id}" class="song"><img loading="lazy" class="thumbnail" src="${r.thumbnail}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${mds}<span>${r.year}</span></div></a>`
        }
    });
    document.getElementById("recent").innerHTML = `<h3>Recently played</h3>${html}`;
}

window.onload = () => {
    const request = indexedDB.open("AudioDB", 2);
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        const tx = db.transaction("recent", "readonly");
        const store = tx.objectStore("recent");

        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = function() {
            const allRecent = getAllRequest.result;
            buildRecent(allRecent);
        };
    
        getAllRequest.onerror = function(e) {
            console.error("Error reading songs:", e.target.error);
        };
    };
    
    request.onerror = function(event) {
        console.error("IndexedDB error:", event.target.errorCode);
    };
}