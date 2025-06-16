const mds = ' · ';

function chooseThumbnailUrl(thumbnails, width=Infinity) {
    var sorted = thumbnails.sort((thb1, thb2) => thb2.width - thb1.width);
    var filtered = sorted.filter(thb => thb.width <= width)
    if (filtered.length > 0) return filtered[0].url;
    return sorted[sorted.length-1].url;
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
    return Math.floor(d / 60) + ':' + pad(2, '0', Math.round(d%60).toString())
}

function viewsToString(v) {
    if (Math.floor(v/1e9) > 0) return `${Math.floor(v/1e8)/10}Mds`
    if (Math.floor(v/1e6) > 0) return `${Math.floor(v/1e5)/10}M`
    if (Math.floor(v/1e3) > 0) return `${Math.floor(v/1e2)/10}k`
    return v.toString()
}

function getDominantColor(colorthief, img) {
    var c = colorthief.getColor(img);
    var nc = Math.sqrt(c.map(x => x*x).reduce((a,b)=>a+b,0))
    c = c.map(x => x*310/nc);
    return `rgb(${c.join(',')})`
}

class Thumbnail {
    constructor(img, thumbnails, crossOrigin=false, width=Infinity) {
        this.img = img;
        this.thumbnails = thumbnails;
        this.width = width;
        this.crossOrigin = crossOrigin;

        this.img.classList.add("thumbnail")

        this.load();
    }

    choose(retry = false) {
        var w = retry ? 120 : this.width;
        var sorted = this.thumbnails.sort((thb1, thb2) => thb2.width - thb1.width);
        var filtered = sorted.filter(thb => thb.width <= w)
        if (filtered.length > 0) return filtered[0];
        return sorted[sorted.length - 1];
    }

    loadFromThumbnail(thb) {
        var url = this.crossOrigin
            ? `/web/img?url=${encodeURI(thb.url)}`
            : thb.url;
        this.img.src = url;
        this.img.height = thb.height;
        this.img.width = thb.width;
    }

    load() {
        var thb = this.choose();
        this.loadFromThumbnail(thb);

        var retried = false;
        this.img.addEventListener("error", () => {
            if (!retried) {
                console.log("retrying")
                this.loadFromThumbnail(this.choose(true))
                retried = true;
            }
        })
    }
}

class Player {
    constructor(video, queue, album) {
        this.pimg = document.getElementById("pimg");
        this.ptitle = document.getElementById("ptitle");
        this.partist = document.getElementById("partist");
        this.palbum = document.getElementById("palbum");
        this.paudio = document.getElementById("paudio");
        this.pqueue = document.getElementById("pqueue");

        this.pcurrenttime = document.getElementById("pcurrenttime");
        this.ptotaltime = document.getElementById("ptotaltime");

        this.pslider = document.getElementById("pslider");
        this.pbufferedbar = document.getElementById('pbufferedbar');
        this.pprogressbar = document.getElementById('pprogressbar');

        this.pplaypause = document.getElementById("pplaypause");
        this.pplaypauseicon = document.getElementById("pplaypauseicon");
        this.pskip = document.getElementById("pskip");
        this.pskipleft = document.getElementById("pskipleft");

        this.pautoplay = document.getElementById("pautoplay")

        this.colorthief = new ColorThief();
        this.root = document.querySelector(':root');

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

        this.pimg.addEventListener("load", () => {
            var c = getDominantColor(this.colorthief, this.pimg);
            this.root.style.setProperty('--c-background', c);
        })

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
            this.pautoplay.classList.remove("on")
        })

        this.paudio.addEventListener("pause", () => {
            this.pplaypauseicon.className = "pplay fa-solid fa-play fa-xl"
        })

        this.paudio.addEventListener('error', function() {
            alert("Error loading audio file. Mew could not extract the stream URL.");
            history.back()
        });
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
                        if (key == "thumbnails") {
                            if (this.queue[i].thumbnails) {
                                this.queue[i].thumbnails.push(...value);
                            }
                        } else {
                            this.queue[i][key] = value;
                        }
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

    updateTime() {
        const cssWidth = per => `calc(0.25rem + ${per / 100} * (100% - 0.5rem))`
        const value = (this.paudio.currentTime / this.paudio.duration) * 100;
        this.pprogressbar.style.width = cssWidth(value);
        this.pcurrenttime.textContent = durationToString(this.paudio.currentTime);
        this.pslider.value = value;
    }

    buildAudioPlayer() {
        const cssWidth = per => `calc(0.25rem + ${per / 100} * (100% - 0.5rem))`
        this.updateTime(0)

        setInterval(this.updateTime.bind(this), 50);
        // this.paudio.addEventListener('timeupdate', this.updateTime.bind(this));

        // Mettre à jour la zone grisée pour l'état de chargement
        this.paudio.addEventListener('progress', function() {
            const buffered = this.paudio.buffered;
            if (buffered.length > 0) {
                const bufferedEnd = buffered.end(buffered.length - 1);
                const bufferedValue = (bufferedEnd / this.paudio.duration) * 100;
                this.pbufferedbar.style.width = cssWidth(bufferedValue);
            }
        }.bind(this));

        // Permettre à l'utilisateur de déplacer la barre de progression
        this.pslider.addEventListener('input', function() {
            const seekTime = (pslider.value / 100) * this.paudio.duration;
            this.pprogressbar.style.width = cssWidth(pslider.value);
            this.paudio.currentTime = seekTime;
        }.bind(this));
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
                : `<img loading="lazy"/><div class="info"><span><b>${r.title}</b></span><br><span>${r.artist}</span>${mds}<span><i>${r.album}</i></span>${songDetailsSpan(r)}</div>`;
            if (!this.isalbum) {
                var img = r.a.getElementsByTagName("img")[0];
                new Thumbnail(img, r.thumbnails, false, 120)
            }
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
        new Thumbnail(
            this.pimg,
            this.isalbum ? this.album.thumbnails : current.thumbnails,
            true    // crossOrigin
        );
        this.ptitle.innerText = current.title;
        this.partist.innerText = this.isalbum ? this.album.artist : current.artist;
        this.palbum.innerText = this.isalbum ? this.album.title : current.album;
        this.pslider.value = 0;
        this.pcurrenttime.textContent = durationToString(0);
        this.ptotaltime.textContent = durationToString(current.duration);
    }
    
    playerLoadAndStart() {
        this.paudio.src = this.queue[this.i].stream.url;
        this.paudio.load();
        console.log(this.paudio, this.paudio.networkState)

        var playPromise = this.paudio.play();

        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Autoplay was prevented, show an error message or a button to let the user start playback
                console.log("Autoplay prevented:", error);
                this.pautoplay.classList.add("on");
                var clicked = false;
                this.pautoplay.addEventListener("click", () => {
                    if (!clicked) {
                        this.paudio.play();
                    }
                    clicked = true;
                })
            });
        }
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