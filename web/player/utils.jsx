import ColorThief from "colorthief";
import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { durationToString, is2xx, url } from "../components/utils";
import { player } from "./logic";
import { token, u } from "../components/auth";
import { Icon } from "../components/icons";

const colorthief = new ColorThief()

export function onImageLoad(load) {
  var img = load.srcElement
  var c = colorthief.getColor(img);
  var nc = Math.sqrt(c.map(x => x*x).reduce((a,b)=>a+b,0))
  c = c.map(x => x*310/nc);
  c = `rgb(${c.join(',')})`;
  document.querySelector(':root').style.setProperty('--color-d', c);
}

export function PBarNoText(props) {
  return (
    <div class="h-4 relative">
      {/* background */}
      <div class="block w-full h-1/5 bg-b/20 rounded-full absolute top-2/5"></div>
      {/* buffered */}
      <div class="block h-1/5 bg-b/20 rounded-full absolute top-2/5"></div>
      {/* progress */}
      <div class="block h-1/5 bg-b rounded-full absolute top-2/5" style={{width: `${100 * player.audio.currentTime / player.audio.duration}%`}}></div>
      {/* slider */}
      <input id="pslider" type="range" value={(player.audio.currentTime / player.audio.duration).toString()} min="0" max="1" step="0.0001" onInput={({ target }) => player.actions.seek((+target.value) * player.audio.duration) } class="absolute h-full" />
    </div>
  )
}

export function PBar(props) {
  return (
    <div class="w-full h-6 flex flex-col items-center">
      <Show when={player.audio.state != "loading"}>
        <Show when={player.s.current && !player.s.current.error} fallback={<div>Error playing audio (code {player.s.current.error})</div>}>
          <div class="w-full flex flex-row justify-between text-xs">
            <span>{durationToString(player.audio.currentTime)}</span>
            <span>{durationToString(player.audio.duration)}</span>
          </div>
          <div class="w-11/12 mt-[-0.2em]">
            <PBarNoText/>
          </div>
        </Show>
      </Show>
    </div>
  )
}

export function ControlButton(props) {
  const size = ((props.parentsize || 1) * props.size * 2) + "em";
  return (
    <div
      style={{width: size, height: size}}
      classList={{
        'rounded-full': true,
        'flex': true,
        'items-center': true,
        'justify-center': true,

        'bg-b': props.filled,
        'text-d': props.filled,
        'transition': props.filled,
        'duration-200': props.filled,
        'ease-in-out': props.filled,
        'hover:scale-110': props.filled,

        'hover:bg-b/8': !props.filled && (props.active === undefined || props.active === true),
        'opacity-15': !props.filled && !(props.active === undefined || props.active === true),
      }}
      onClick={props.onclick}
    >
      <Icon type={props.type} size={(props.parentsize || 1) * props.size}></Icon>
    </div>
  )
}

export function PInfos(props) {
  return (
    <>
      <A onClick={() => player.start(player.s.current.id)} href={url(player.s.current)} class="font-bold">{player.s.current.name}</A>
      <Show when={player.s.current.albums}>
        <div class="flex flex-row">
          <For each={player.s.current.albums}>{(album, i) => 
            <>
              <Show when={i() == 0}><span style="display: inline-block; margin-bottom: -0.5em"><Icon type="record-vinyl" size={1}/></span></Show>
              <Show when={i() > 0}><span class="mr-1">,</span></Show>
              <A onClick={() => player.start(album.id)} href={`/player/${album.id}`} class="italic">{album.name}</A>
            </>
          }
          </For>
        </div>
      </Show>
      <Show when={player.s.current.artists}>
        <div class="flex flex-row">
          <For each={player.s.current.artists}>{(artist, i) => 
            <>
              <Show when={i() == 0}><span style="display: inline-block; margin-bottom: -0.5em"><Icon type="user" size={1}/></span></Show>
              <Show when={i() > 0}><span class="mr-1">,</span></Show>
              <A href={`/artist/${artist.id}`}>{artist.name}</A>
            </>
          }
          </For>
        </div>
      </Show>
    </>
  )
}

export const [playlistSaveSid, setPlaylistSaveSid] = createSignal(null);

async function realDownload(url, fname) {
  const res = await fetch(url, { headers: { authorization: token() } });
  const blob = await res.blob();
  const rurl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = rurl;
  a.download = fname;
  a.click();
}

export async function requestConversion(onProgress) {
  const id = player.s.current.id;
  onProgress(0, 0);
  if (u.connected && token() && token() != 'null') {
    while (true) {
      const res = await fetch('/api/convert/' + id, { headers: { authorization: token() } });
      const json = await res.json();
      if (!is2xx(res)) throw json.error;
      onProgress(json.state, json.progress);
      if (json.state == 4) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    realDownload('/api/converted/' + id, `${id}.mp3`);
  } else {
    alert("This feature is available only if you have an account. Please login first.")
  }
}

export async function fastDownload() {
  const id = player.s.current.id;
  if (u.connected && token() && token() != 'null') {
    realDownload('/api/download/' + id, `${id}.webm`);
  } else {
    alert("This feature is available only if you have an account. Please login first.")
  }
}

export function PControls(props) {

  function requestPlaylistSave() {
    const sid = player.s.current.id;
    setPlaylistSaveSid(sid);
  }

  return (
    <>
      <Show when={u.connected}>
        <ControlButton type="heart" parentsize={props.size} size={1.5} onclick={requestPlaylistSave}/>
      </Show>
      <ControlButton type="backward-step" parentsize={props.size} size={1.8} active={player.s.i > 0} onclick={() => player.actions.next(false)} />
      <ControlButton type={player.playing() ? 'pause' : 'play'} parentsize={props.size} size={2} filled={true} onclick={player.actions.playPause} />
      <ControlButton type="forward-step" parentsize={props.size} size={1.8} active={player.s.i + 1 < player.s.queue.length} onclick={player.actions.next} />
      <Show when={u.connected}>
        <ControlButton type="download" parentsize={props.size} size={1.5} active={false} onclick={requestConversion}/>
      </Show>
    </>
  )
}