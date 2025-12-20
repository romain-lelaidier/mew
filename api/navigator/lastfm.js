import { parse } from "node-html-parser";
import * as utils from "../utils.js"

export class LastFmNavigator {
  constructor(ww) {
    this.ww = ww;
  }

  img(url) {
    return {
      type: "lastfm",
      id: url.match(/\/(\w+)\.jpg/)[1]
    }
  }

  clean(str) {
    return str.replaceAll(" ", "").replaceAll("\n", "")
  }

  parseTracks(el) {
    return el.querySelectorAll(".chartlist-row")
    .map(tr => {

      var a = tr.querySelector(".chartlist-play-button");
      if (a == null) return;

      var result = {
        type: "SONG",
        id: a._attrs['data-youtube-id'],
        name: a._attrs['data-track-name'],
        artists: [{
          id: a._attrs['data-artist-url'].split('/music/')[1],
          name: a._attrs['data-artist-name']
        }],
      };

      if (tr.querySelector(".chartlist-duration")) {
        const str = this.clean(tr.querySelector(".chartlist-duration").textContent);
        if (str.length > 0) result.duration = utils.stringToDuration(str);
      }

      if (tr.querySelector(".chartlist-index")) {
        const str = this.clean(tr.querySelector(".chartlist-index").textContent);
        if (str.length > 0) result.rank = parseFloat(str);
      }

      var img = tr.querySelector("img")
      if (img) {
        result.img = this.img(img._attrs.src)
        var a = tr.querySelector("a.cover-art");
        if (a) {
          result.albums = [{
            id: a._attrs.href.split('/music/')[1],
            name: img._attrs.alt
          }];
        }
      }

      var span = tr.querySelector(".chartlist-count-bar-value");
      if (span) {
        result.listeners = parseFloat(this.clean(span.childNodes[0].textContent).replaceAll(",", ""))
      }

      return result;

    })
    .filter(track => track != null);
  }

  async search(query) {

    const params = {
      q: query
    };

    const html = await this.ww.get(
      "lfm_search", "html",
      "https://www.last.fm/search?" + new URLSearchParams(params).toString(),
    )

    const parsed = parse(html);
    const results = [];

    // tracks
    results.push(
      ...this.parseTracks(parsed)
    )

    // artist
    results.push(
      ...parsed.querySelectorAll(".grid-items-item")
      .filter(li => li.querySelectorAll("button").length == 0)
      .map(li => ({
        type: "ARTIST",
        id: li.querySelectorAll("a")[0]._attrs.href.split('/music/')[1],
        name: li.querySelectorAll("a")[0]._attrs.title,
        img: this.img(li.querySelector("img")._attrs.src),
      }))
    )
    
    // albums
    results.push(
      ...parsed.querySelectorAll(".grid-items-item")
      .filter(li => li.querySelectorAll("button").length > 0)
      .map(li => ({
        type: "ALBUM",
        id: li.querySelectorAll("a")[0]._attrs.href.split('/music/')[1],
        name: li.querySelectorAll("a")[0]._attrs.title,
        artists: [{
          id: li.querySelectorAll("a")[1]._attrs.href.split("/music/")[1],
          name: li.querySelectorAll("a")[1].childNodes[0].innerText,
        }],
        img: this.img(li.querySelector("img")._attrs.src),
      }))
    )

    return results.filter(r => r != undefined)

  }

  async artist(id) {

    const [ html, toptracksHtml, topalbumsHtml ] = await Promise.all([
      this.ww.get(
        "lfm_artist", "html",
        "https://www.last.fm/music/" + id,
      ),
      this.ww.get(
        "lfm_artist_tracks", "html",
        `https://www.last.fm/music/${id}/+partial/tracks?top_tracks_date_preset=ALL`,
      ),
      this.ww.get(
        "lfm_artist_albums", "html",
        `https://www.last.fm/music/${id}/+partial/albums?album_order=most_popular`,
      ),
    ])

    const parsed = parse(html);

    const artist = {
      id,
      name: parsed.querySelector(".header-new-title").textContent,
      results: []
    };

    // image
    var div = parsed.querySelector(".header-new-background-image");
    if (div) {
      var url = div._attrs.style;
      url = url.substring(url.indexOf('http'), url.indexOf('.jpg')+4);
      artist.img = this.img(url)
    }

    // listeners
    var li = parsed.querySelectorAll(".header-metadata-tnew-item")
    .find(li => li
      .querySelectorAll(".header-metadata-tnew-title")
      .some(h4 => this.clean(h4.textContent) == "Listeners")
    );
    if (li) {
      artist.listeners = parseFloat(li.querySelector("abbr")._attrs.title.replaceAll(',', ''))
    }

    // tags
    var ul = parsed.querySelector(".tags-list--global");
    if (ul) {
      artist.tags = ul.querySelectorAll("a").map(a => a.textContent);
    }

    // similar artists
    artist.similar = parsed.querySelectorAll(".artist-similar-artists-sidebar-item")
    .map(div => ({
      id: div.querySelector("a")._attrs.href.split('/music/')[1],
      name: div.querySelector("a").textContent,
      img: this.img(div.querySelector("img")._attrs.src)
    }));

    // top tracks
    const toptracksParsed = parse(toptracksHtml);
    artist.results.push(
      ...this.parseTracks(toptracksParsed)
    )

    // top albums
    const topalbumsParsed = parse(topalbumsHtml);
    artist.results.push(
      ...topalbumsParsed.querySelectorAll(".artist-top-albums-item-wrap")
      .map(li => {
        var result = {
          type: "ALBUM",
          id: li.querySelectorAll("a")[0]._attrs.href.split('/music/')[1],
          name: li.querySelectorAll("a")[0].textContent,
          img: this.img(li.querySelector("img")._attrs.src),
        };

        for (const aux of li.querySelectorAll(".artist-top-albums-item-aux-text").map(li => li.textContent).join('·').split('·').map(this.clean)) {
          if (aux.includes('listeners')) {
            result.listeners = parseFloat(aux.replaceAll(',', ''))
          } else if (aux.includes('tracks')) {
            result.tracks = parseFloat(aux.replaceAll(',', ''))
          } else {
            // possible date (10May2012)
          }
        }

        return result;
      })
    )

    return artist;

  }

  async album(id) {

    const html = await this.ww.get(
      "lfm_album", "html",
      `https://www.last.fm/music/${id}`
    )

    const parsed = parse(html);

    const album = {
      id,
      name: parsed.querySelector(".header-new-title").textContent,
      results: []
    };

    var div = parsed.querySelector(".album-overview-cover-art");
    if (div) {
      var img = div.querySelector("img");
      if (img) {
        var url = img.rawAttrs;
        url = url.substring(url.indexOf("http"), url.indexOf(".jpg") + 4);
        album.img = this.img(url)
      }
    }

    // listeners
    var li = parsed.querySelectorAll(".header-metadata-tnew-item")
    .find(li => li
      .querySelectorAll(".header-metadata-tnew-title")
      .some(h4 => this.clean(h4.textContent) == "Listeners")
    );
    if (li) {
      album.listeners = parseFloat(li.querySelector("abbr")._attrs.title.replaceAll(',', ''))
    }

    // tags
    var ul = parsed.querySelector(".tags-list--global");
    if (ul) {
      album.tags = ul.querySelectorAll("a").map(a => a.textContent);
    }

    album.songs = this.parseTracks(parsed);

    // similar albums
    album.similar = parsed.querySelectorAll(".similar-albums-item-wrap")
    .map(li => {
      var result = {
        type: "ALBUM",
        id: li.querySelectorAll("a")[0]._attrs.href.split('/music/')[1],
        name: li.querySelectorAll("a")[0].textContent,
        img: this.img(li.querySelector("img")._attrs.src),
      };

      var p = li.querySelector(".similar-albums-item-artist")
      if (p) {
        result.artists = [{
          id: p.querySelector("a")._attrs.href.split('/music/')[1],
          name: p.querySelector("a").textContent
        }]
      }

      for (const aux of li.querySelectorAll(".similar-albums-item-aux-text").map(li => li.textContent).join('·').split('·').map(this.clean)) {
        if (aux.includes('listeners')) {
          result.listeners = parseFloat(aux.replaceAll(',', ''))
        } else if (aux.includes('tracks')) {
          result.tracks = parseFloat(aux.replaceAll(',', ''))
        } else {
          // possible date (10May2012)
        }
      }

      return result;
    })

    return album;

  }

}

// const ww = new utils.WebWrapper();
// const nav = new LastFmNavigator(ww);
// console.log(await nav.artist('Fleetwood+Mac'))