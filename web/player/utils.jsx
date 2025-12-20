import ColorThief from "colorthief";
import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { durationToString, url } from "../components/utils";
import { player } from "./logic";
import { u } from "../components/auth";
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

export function PControls(props) {

  function requestPlaylistSave() {
    const sid = player.s.current.id;
    setPlaylistSaveSid(sid);
  }

  function ControlButton(props2) {
    const size = ((props.size || 1) * props2.size * 2) + "em";
    return (
      <div
        style={{width: size, height: size}}
        classList={{
          'rounded-full': true,
          'flex': true,
          'items-center': true,
          'justify-center': true,

          'bg-b': props2.filled,
          'text-d': props2.filled,
          'transition': props2.filled,
          'duration-200': props2.filled,
          'ease-in-out': props2.filled,
          'hover:scale-110': props2.filled,

          'hover:bg-b/8': !props2.filled && (props2.active === undefined || props2.active === true),
          'opacity-15': !props2.filled && !(props2.active === undefined || props2.active === true),
        }}
        onClick={props2.onclick}
      >
        <Icon type={props2.type} size={(props.size || 1) * props2.size}></Icon>
      </div>
    )
  }

  return (
    <>
      <Show when={u.connected}>
        <ControlButton type="bookmark" size={1.5} onclick={requestPlaylistSave}/>
      </Show>
      <ControlButton type="backward-step" size={1.8} active={player.s.i > 0} onclick={() => player.actions.next(false)} />
      <ControlButton type={player.playing() ? 'pause' : 'play'} size={2} filled={true} onclick={player.actions.playPause} />
      <ControlButton type="forward-step" size={1.8} active={player.s.i + 1 < player.s.queue.length} onclick={player.actions.next} />
      <Show when={u.connected}>
        <ControlButton type="heart" size={1.5} active={false} />
      </Show>
    </>
  )
}