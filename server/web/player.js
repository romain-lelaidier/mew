
class Player {
    constructor(video, next) {
        this.pimg = document.getElementById("pimg");
        this.ptitle = document.getElementById("ptitle");
        this.partist = document.getElementById("partist");
        this.palbum = document.getElementById("palbum");
        this.paudiosource = document.getElementById("paudiosource");
        this.paudio = document.getElementById("paudio");
        this.serverURL = document.URL.substring(0, document.URL.indexOf('/web/play'))
        this.queueId = video.queueId;

        this.paudio.addEventListener("ended", () => {
            this.video = this.nextVideo;
            this.nextVideo = this.next[++this.nextVideoIndex];
            this.display();
            this.loadAndPlay();
            this.loadNextVideoInfo();
        })

        this.next = next;
        this.nextVideoIndex = 0;
        this.video = video;
        this.nextVideo = this.next[this.nextVideoIndex];
        this.loadNextVideoInfo();

        this.display();
        this.loadAndPlay();
    }

    display() {
        this.pimg.src = this.video.thumbnails.sort((thb1, thb2) => thb2.width - thb1.width)[0].url;
        this.ptitle.innerText = this.video.title;
        this.partist.innerText = this.video.artist;
        this.palbum.innerText = this.video.album;
    }

    loadAndPlay() {
        paudiosource.src = this.video.stream.url;
        paudio.load();
        paudio.play();
    }

    findNextVideo() {
        if (!this.nextVideo) return this.next[0];
        for (let i = 0; i < this.next.length; i++) {
            if (this.next[i].id == this.nextVideo.id) return this.next[i+1];
        }
    }

    loadNextVideoInfo() {
        var downloadParams = [];
        for (var type of [ 'title', 'artist', 'album' ]) {
            if (this.nextVideo[type]) downloadParams.push(type + '=' + encodeURIComponent(this.nextVideo[type]));
        }

        if (this.videoIndex == this.next.length) {
            downloadParams.push("queueId=" + this.queueId);
        }

        var xml = new XMLHttpRequest();
        xml.open('GET', this.serverURL + '/api/extract_video/' + this.nextVideo.id + '?' + downloadParams.join('&'));
        xml.onload = () => {
            var { next, video } = JSON.parse(xml.responseText);
            this.nextVideo = video;
            console.log(this.nextVideo)
            if (next.length > 0) this.next = next;
        }
        xml.send();
    }
}

function routine(video, next) {

    // prepare next song
    var nextVideo = findNext(video, next);
};

window.onload = () => {
    var video = XVIDEOX;
    var next = XNEXTX;
    console.log(video);
    console.log(next);
    new Player(video, next);
};