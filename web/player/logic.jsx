import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { getPlaylist } from "../components/playlists";
import { useLocation, useNavigate } from "@solidjs/router";

function prepare(obj) {
  if (!obj) return null;
  return {
    ...obj,
    albums: obj.albumsjson ? JSON.parse(obj.albumsjson) : [],
    artists: obj.artistsjson ? JSON.parse(obj.artistsjson) : [],
    img: obj.imgjson ? JSON.parse(obj.imgjson) : undefined
  }
}

export class Player {

  constructor() {

    [ this.s, this.setS ] = createStore({
      started: false,
      get current() {
        return prepare(this.queue[this.i]);
      },
      get next() {
        return prepare(this.queue[this.inext]);
      },
      get url() {
        return this.queue[this.i]?.stream?.url
      },
    });

    [ this.playing, this.setPlaying ] = createSignal(false);
    this.audioDOM = document.createElement("audio");
    this.audioDOM.autoplay = true;

    [ this.audio, this.setAudio ] = createStore({
      state: null,
      currentTime: -1,
      duration: -1
    });

    [ this.requestAutoplay, this.setRequestAutoplay ] = createSignal(false);

    [ this.canSkip, this.setCanSkip ] = createSignal(true);

    this.actions = {
      play: async () => {
        try {
          await this.audioDOM.play();
        } catch(e) {
          this.setAudio("state", "error");
          const code = this.audioDOM.networkState;
          console.log("audio error", e, code);
          if (code != 3) {
            this.setPlaying(false);
            this.setRequestAutoplay(true);
            var clicked = false;
            window.addEventListener("click", () => {
              if (!clicked) {
                this.setRequestAutoplay(false);
                this.setPlaying(true);
                this.actions.play();            
              }
              clicked = true;
            })
            return;
          }
        }
      },
      playPause: () => {
        this.setPlaying(playing => !playing);
        if (this.playing()) this.actions.play();
        else this.audioDOM.pause();
      },
      next: (right = true) => {
        this.audioDOM.pause();
        this.setAudio("state", "loading");
        let delta = right ? 1 : -1;
        let newi = this.s.i + delta;
        if (newi < 0) return;
        if (newi >= this.s.queue.length) newi = 0;
        this.setS("i", newi);
        this.setS("inext", newi + delta);
        this.prepare().then(() => {
          this.tryPlay()
        });
      },
      jump: i => {
        if (i < 0 || i >= this.s.queue.length) return;
        this.audioDOM.pause();
        this.setAudio("state", "paused");
        this.setS("i", i);
        this.setS("inext", i + 1);
        this.prepare().then(() => {
          this.tryPlay()
        });
      },
      seek: time => {
        this.audioDOM.currentTime = time;
      }
    }

    this.audioDOM.addEventListener("load", (function() {
      this.setS("queue", this.s.i, "loaded", true);
      this.actions.play();
    }).bind(this));

    this.audioDOM.addEventListener("play", (function() {
      this.setAudio("state", "playing")
    }).bind(this));

    this.audioDOM.addEventListener("ended", (function() {
      if (this.canSkip()) {
        this.actions.next();
      }
    }).bind(this));

    setInterval((() => {
      if (this.audio.state != "loading") {
        this.setAudio("currentTime", this.audioDOM.currentTime)
        this.setAudio("duration", this.audioDOM.duration)
      }
    }).bind(this), 100);

    window.addEventListener("keydown", e => {
      if (e.target == document.body || e.target.id == "pslider") {
        if (e.keyCode == 32) {  // space bar
          e.preventDefault()
          this.actions.playPause();
        }
        else if (e.key == "n") this.actions.next();
        else if (e.key == "b") this.actions.next(false);
      }
    });
  }

  openSelf(navigate) {
    if (this.s.started) {
      var url = `/player/${this.s.info.id}`;
      if (this.s.info.qid) url += '?qid=' + this.s.info.qid;
      navigate(url)
    }
  }

  start(id, params={}) {

    if (this.s?.info?.id == id) return;

    this.setS({
      started: true,
      loaded: false,
      info: {
        id,
        qid: params.qid,
        type: { 11: 'SONG', 10: 'PLAYLIST' }[ id.length ] || 'ALBUM'
      },
      queue: [],
      i: -1,
      inext: -1
    });

    this.audioDOM.src = null;
    this.setPlaying(false);
    this.setCanSkip(true);

    this.firstFetch().then(() => {
      this.prepare().then(() => {
        this.tryPlay()
      });
    })
  }

  appendToQueue(nqueue) {
    this.setS("queue", queue => [
      ...queue,
      ...nqueue.map(video => {
        return {
          id: video.id,
          type: video.type,
          queueId: video.queueId,
          name: video.name,
          artistsjson: JSON.stringify(video.artists),
          albumsjson: JSON.stringify(video.albums),
          imgjson: JSON.stringify(video.img),
          stream: video.stream,
          index: video.index,
          duration: video.duration,
        }
      })
    ]);
  }

  async firstFetch() {

    // alert("YouTube has changed its API so Mew is currently broken. A fix will be available soon :)");
    // const navigate = useNavigate();
    // navigate('/');
    // return;

    if (this.s.info.type == 'SONG') {
      var url = `${window.location.origin}/api/video/${this.s.info.id}`;
      if (this.s.info.qid) url += '?qid=' + this.s.info.qid;
      else url += '?wq=y'
      const response = await fetch(url);
      const { video, queue } = await response.json();
      if (queue.length == 0 || queue[0].id != video.id) {
        queue.unshift(video);
      }
      this.setS("i", i => 0);
      this.setS("inext", i => 1);
      this.appendToQueue(queue);
    } else if (this.s.info.type == 'ALBUM') {
      var url = `${window.location.origin}/api/album/${this.s.info.id}`;
      const response = await fetch(url);
      const result = await response.json();
      const queue = result.songs;
      for (let i = 0; i < queue.length; i++) {
        queue[i].index = i+1;
        queue[i].type = 'SONG'
      }
      this.setS("info", info => {
        return {
          ...info,
          artistsjson: JSON.stringify(result.artist),
          imgjson: JSON.stringify(result.img),
          name: result.name
        }
      })
      this.setS("i", i => 0);
      this.setS("inext", i => 1);
      this.appendToQueue(result.songs);
    } else if (this.s.info.type == 'PLAYLIST') {
      const playlist = await getPlaylist(this.s.info.id);
      this.setS("info", info => {
        return {
          ...info,
          // owners: playlist.owners,
          name: playlist.name
        }
      })
      this.setS("i", i => 0);
      this.setS("inext", i => 1);
      this.appendToQueue(playlist.songs.map(s => {
        return {
          ...s,
          // img: [ { url: s.thumbnail, width: 60, height: 60 } ]
        }
      }));
    }
    this.setS("loaded", l => true);
  }

  async prepare() {
    // recursively retries to prepare current and next songs stream urls.
    // this implies fetching more of the current queue if the end is reached.

    var i, wq = false;

    if (this.s.queue.length == 0) return;

    if (!this.s.current) {
      return alert("current is not in queue");
    }

    if (!this.s.current.stream) {
      // extract current
      i = this.s.i;
      if (i == this.s.current.length && this.s.info.type == 'SONG') {
        wq = true
      }
    }

    if (i == undefined) {
      // extract next
      if (this.s.next) {
        if (!this.s.next.stream) {
          // extract next
          i = this.s.inext;
          if (!this.s.queue[i] && this.s.info.type == 'SONG') {
            wq = true;
          }
        }
      } else if (this.s.inext > this.s.i && this.s.info.type == 'SONG') {
        // no next : extract current with queue
        i = this.s.i;
        wq = true;
      }
    }

    if (i != undefined) {
      var url = `${window.location.origin}/api/video/${this.s.queue[i].id}`
      if (wq) url += '?qid=' + (this.s.info.qid || this.s.queue[i].queueId);
      console.log('prepare', i, url)
      const response = await fetch(url);
      const { video, queue } = await response.json();
      this.setS("queue", i, "artistsjson", JSON.stringify(video.artists))
      this.setS("queue", i, "stream", video.stream);
      this.setS("queue", i, "imgjson", JSON.stringify(video.img));
      this.appendToQueue(queue);
      this.prepare();
    }
  }

  tryPlay() {
    if (this.s.current) {
      if (this.audioDOM.src != this.s.current.stream.url) {
        this.audioDOM.src = this.s.current.stream.url;
        this.setAudio("state", "loading");
        this.setPlaying(true);
        this.actions.play();
      }
    }
  }
}

export const player = new Player();