const mds = ' · ';

function chooseThumbnailUrl(thumbnails, width=Infinity) {
    var sorted = thumbnails.sort((thb1, thb2) => thb2.width - thb1.width);
    var filtered = sorted.filter(thb => thb.width <= width)
    if (filtered.length > 0) return filtered[0].url;
    return sorted[0].url;
}

function songDetailsSpan(r) {
    var songDetails = [];
    if ('year' in r) songDetails.push(r.year.toString())
    if ('duration' in r) songDetails.push(durationToString(r.duration));
    if ('viewCount' in r) songDetails.push(viewsToString(r.viewCount));
    return songDetails.length > 0 ? '<br><span>' + songDetails.join(mds) + '</span>' : '';
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

class Player {
    constructor(video, queue, album) {
        this.pimg = document.getElementById("pimg");
        this.ptitle = document.getElementById("ptitle");
        this.partist = document.getElementById("partist");
        this.palbum = document.getElementById("palbum");
        this.paudio = document.getElementById("paudio");
        this.pqueue = document.getElementById("pqueue");

        this.pplaypause = document.getElementById("pplaypause")
        this.pplaypauseicon = document.getElementById("pplaypauseicon")
        this.pskip = document.getElementById("pskip")
        this.pskipleft = document.getElementById("pskipleft")
        this.pslider = document.getElementById("pslider");

        this.serverURL = document.URL.substring(0, document.URL.indexOf('/web/play'))

        if (album) {
            this.queueId = album.id
            this.queue = album.songs
            this.isalbum = true;
            this.album = album;
        } else {
            this.queueId = video.queueId;
            this.queue = queue || [ video ];
            if (video.id != this.queue[0].id) {
                this.queue.unshift(video);
            }
            this.isalbum = false;
        }
        for (let i = 0; i < this.queue.length; i++) {
            this.queue[i].queueIndex = i;
        }
        this.i = 0;    // current index in queue

        this.actions = {
            playPause: () => {
                if (this.paudio.paused) {
                    this.paudio.play();
                } else {
                    this.paudio.pause();
                }
            },
            skip: (right=true) => {
                let delta = right ? 1 : -1;
                let newi = this.i + delta;
                if (newi < 0 || newi >= this.queue.length) return;
                this.i += delta;
                this.loadVideo(this.i).then(() => {
                    this.display();
                    this.playerLoadAndStart();
                    this.loadVideo(this.i+delta);
                })
            },
            playFromClick: () => {
                this.loadVideo(this.i).then(() => {
                    this.display();
                    this.playerLoadAndStart();
                    this.loadVideo(this.i+1);
                })
            }
        }

        // event handling
        this.paudio.addEventListener("ended", () => {
            this.actions.skip();
        })

        window.addEventListener("keydown", e => {
            if (e.target == document.body || e.target == this.pslider) {
                if (e.keyCode == 32) {  // space bar
                    e.preventDefault()
                    this.actions.playPause();
                }
                else if (e.key == "n") this.actions.skip();
                else if (e.key == "b") this.actions.skip(false);
            }
        });

        this.pplaypause.addEventListener("click", () => {
            this.actions.playPause()
        })

        this.pskip.addEventListener("click", () => {
            this.actions.skip()
        })

        this.pskipleft.addEventListener("click", () => {
            this.actions.skip(false)
        })

        // beginning
        this.buildAudioPlayer();
        this.actions.playFromClick();
        this.buildQueue();

        this.paudio.addEventListener("play", () => {
            this.pplaypauseicon.className = "ppause fa-solid fa-pause fa-xl";
        })

        this.paudio.addEventListener("pause", () => {
            this.pplaypauseicon.className = "pplay fa-solid fa-play fa-xl"
        })
    }

    loadVideo(i) {
        // load video at index i
        return new Promise((resolve, reject) => {
            try {
                if (i < 0 || i >= this.queue.length) return resolve();

                var r = this.queue[i];
                if (r.stream) return resolve();

                var downloadParams = [];
                for (var type of [ 'title', 'artist', 'album' ]) {
                    if (r[type]) downloadParams.push(type + '=' + encodeURIComponent(r[type]));
                }
                if (i+1 == this.queue.length) {
                    downloadParams.push("queueId=" + this.queueId);
                }

                var xml = new XMLHttpRequest();
                xml.open('GET', this.serverURL + '/api/extract_video/' + r.id + '?' + downloadParams.join('&'));
                xml.onload = () => {
                    var { queue, video } = JSON.parse(xml.responseText);
                    for (var [ key, value ] of Object.entries(video)) {
                        this.queue[i][key] = value;
                    }
                    if (queue.length > 0) this.queue.push(...queue);
                    resolve();
                }
                xml.send();
            } catch(err) {
                reject(err);
            }
        })
    }

    buildAudioPlayer() {
        const audio = document.getElementById('paudio');
        const pbufferedbar = document.getElementById('pbufferedbar');
        const pprogressbar = document.getElementById('pprogressbar');
        const pslider = document.getElementById('pslider');

        const cssWidth = per => `calc(0.25rem + ${per / 100} * (100% - 0.5rem))`

        // Mettre à jour la barre de progression
        audio.addEventListener('timeupdate', function() {
            const value = (audio.currentTime / audio.duration) * 100;
            pprogressbar.style.width = cssWidth(value);
            pslider.value = value;
        });

        // Mettre à jour la zone grisée pour l'état de chargement
        audio.addEventListener('progress', function() {
            const buffered = audio.buffered;
            if (buffered.length > 0) {
                const bufferedEnd = buffered.end(buffered.length - 1);
                const bufferedValue = (bufferedEnd / audio.duration) * 100;
                pbufferedbar.style.width = cssWidth(bufferedValue);
            }
        });

        // Permettre à l'utilisateur de déplacer la barre de progression
        pslider.addEventListener('input', function() {
            const seekTime = (pslider.value / 100) * audio.duration;
            pprogressbar.style.width = cssWidth(pslider.value);
            audio.currentTime = seekTime;
        });
    }

    buildQueue() {
        this.queue.forEach(r => {
            r.a = document.createElement("a");
            r.a.setAttribute("class", "song");
            r.a.addEventListener("click", () => {
                if (this.i != r.queueIndex) {
                    this.i = r.queueIndex;
                    this.actions.playFromClick();
                }
            })
            r.a.innerHTML = this.isalbum
                ? `<div class="albumIndex">${r.index}.</div><div class="info"><span><b>${r.title}</b></span>${songDetailsSpan(r)}</div>`
                : `<img src="${chooseThumbnailUrl(r.thumbnails, 120)}"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${mds}<span><i>${r.album}</i></span>${songDetailsSpan(r)}</div>`;
            this.pqueue.appendChild(r.a);
        })
    }

    display() {
        var current = this.queue[this.i];
        if (this.i == 0) {
            this.pskipleft.classList.add("pbuttonoff")
        } else {
            this.pskipleft.classList.remove("pbuttonoff")
        }
        this.queue.forEach(r => {
            if (r.queueIndex == this.i) r.a.classList.add("active");
            else r.a.classList.remove("active");
        })
        this.pimg.src = chooseThumbnailUrl(this.isalbum ? this.album.thumbnails : current.thumbnails);
        this.ptitle.innerText = current.title;
        this.partist.innerText = this.isalbum ? this.album.artist : current.artist;
        this.palbum.innerText = this.isalbum ? this.album.title : current.album;
        this.pslider.value = 0;
    }
    
    playerLoadAndStart() {
        this.paudio.src = this.queue[this.i].stream.url;
        this.paudio.load();
        this.paudio.play();
    }
}

window.onload = () => {
    var video = XVIDEOX;
    var queue = XQUEUEX;
    var album = XALBUMX;
    console.log(video);
    console.log(queue);
    console.log(album);
    new Player(video, queue, album);
};