import { For, createSignal } from "solid-js";
import { u, setU, uTryLog, post, get } from "./auth";
import { is2xx, LinkButton, timeAgo, Link } from "./utils";
import { Icon } from "./icons";
import { Popper } from "./popper";
import { Bar } from "./bar";
import { playlistSaveSid, setPlaylistSaveSid } from "../player/utils";

function setPlaylist(playlist) {
  const ids = playlist.ids || playlist.songs.map(song => song.id);
  setU("playlists", playlist.pid, {
    name: playlist.name,
    ids: JSON.stringify(ids),
    history: playlist.history || false,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt
  })
}

export const getPlaylists = async () => {
  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/um/playlists');
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  json.map(setPlaylist)
}

export const getUser = async (id) => {
  const res = await fetch('/um/user/' + id);
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  // const pls = {};
  // for (const pl of json.playlists) pls[pl.id] = pl;
  return json;
  // pls.map(setPlaylist)
}

export const createPlaylist = async (name) => {
  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/pl/create', { name });
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  setPlaylist(json.playlist);
}

export const addToPlaylist = async (pid, sid) => {
  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post(`/pl/add/${pid}/${sid}`);
  if (!is2xx(res)) throw await res.text();
  const pl = await getPlaylist(pid);
  setPlaylist(pl);
}

export const addToHistory = async (id) => {
  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  for (const pid in u.playlists) {
    if (u.playlists[pid].history == true) {
      addToPlaylist(pid, id);
      break;
    }
  }
}

export const removeFromPlaylist = async (pid, sid) => {
  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post(`/pl/remove/${pid}/${sid}`);
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  const pl = await getPlaylist(pid);
  setPlaylist(pl);
}

export const togglePlaylistSong = async (pid, sid) => {
  if (JSON.parse(u.playlists[pid].ids.includes(sid))) {
    await removeFromPlaylist(pid, sid);
  } else {
    await addToPlaylist(pid, sid);
  }
}

export const renamePlaylist = async (pid, name) => {
  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/pl/rename/' + pid, { name });
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  const playlist = await getPlaylist(pid);
  setPlaylist(playlist);
}

export const getPlaylist = async (pid) => {
  const res = await get('/pl/' + pid);
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  return json;
}

export const removePlaylist = async (pid) => {
  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/pl/delete/' + pid);
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  setU("playlists", pid, null);
  return json;
}

function getArray(o) {
  if (typeof(o) == 'string') return JSON.parse(o);
  return o;
}

export function songInPlaylist(id) {
  for (const pid in u.playlists) {
    if (!u.playlists[pid].history && JSON.parse(u.playlists[pid].ids).includes(id)) return true;
  }
  return false;
}

export function PlaylistsList(props) {

  function songString(length) {
    if (length == 0) return 'Empty playlist'
    if (length == 1) return '1 song';
    return length + ' songs'
  }

  const [ editPid, setEditPid ] = createSignal(null);
  const [ trashPid, setTrashPid ] = createSignal(null);

  function PlaylistBlock(props2) {
    const pl = props2.pl;
    if (!pl || (!pl.name && !pl.history)) return (<></>)
    return (
      <div class="px-2 pb-1 rounded-md hover:bg-white/10">
        <div class="flex flex-row gap-2 items-center">
          <Show when={props.sid && props.sid()}>
            <Icon type={getArray(pl.ids).includes(props.sid()) ? 'square-check' : 'empty-square'} />
          </Show>
          <Show when={pl.history == true}>
            <Icon type="clock-rotate-left"/>
          </Show>
          <div class="flex-grow leading-[1.2] py-1">
            <div class="font-bold">{pl.name || "History"}</div>
            <div class="opacity-80">
              <div>{songString(getArray(pl.ids).length)}</div>
              <div class="italic">Edited {timeAgo(new Date(pl.updatedAt))}</div>
              {/* <div>Last modified: {new Date(pl.modified).toLocaleString()}</div> */}
            </div>
          </div>
          <Show when={props.editable && pl.history != true}>
            <div class="flex flex-row gap-2 items-center">
              <div onClick={(e) => { e.preventDefault(); setTrashPid(props2.pid) }}><Icon type="trash" /></div>
              <div onClick={(e) => { e.preventDefault(); setEditPid(props2.pid) }}><Icon type="pen" /></div>
            </div>
          </Show>
        </div>
      </div>
    )
  }

  return (
    <>
      <For each={Object.entries(props.playlists).filter(p => p[1] != null).sort((a, b) => new Date(b[1].updatedAt) - new Date(a[1].updatedAt))}>{([pid, pl], i) => 
        <Show when={!props.withouthistory || !pl.history}>
          <Show when={props.onClick} fallback={<Link href={"/playlist/" + pid}><PlaylistBlock pl={pl} pid={pid} /></Link>}>
            <div onClick={() => props.onClick(pid)} class="cursor-pointer"><PlaylistBlock pl={pl} pid={pid} /></div>
          </Show>
        </Show>
      }</For>

      <Popper sig={[editPid, setEditPid]} title="Edit playlist name">
        <Bar 
          onsubmit={(name) => { renamePlaylist(editPid(), name); setEditPid(null) }}
          placeholder={props.playlists[editPid()].name}
          value={props.playlists[editPid()].name}
          button={<div class="flex flex-row gap-1"><Icon type="pen" size="1.1"/></div>}
          />
      </Popper>

      <Popper sig={[trashPid, setTrashPid]} title="Remove playlist">
        <div>Are you sure you want to remove the playlist <span class="font-bold">{props.playlists[trashPid()].name}</span> ?</div>
        <div class="flex flex-row-reverse mt-1">
          <button class="flex flex-row px-3 py-1 bg-r text-white rounded-md items-center gap-1" onclick={() => { removePlaylist(trashPid()); setTrashPid(null) }}><Icon type="trash" size="1.1"/>Delete</button>
        </div>
      </Popper>
    </>
  )
}

export function PlaylistAdder(props) {

  const adder = (pid) => {
    const sid = playlistSaveSid();
    setPlaylistSaveSid(null);
    togglePlaylistSong(pid, sid);
  }

  return (
    <Popper sig={[playlistSaveSid, setPlaylistSaveSid]} title="Save to playlist">
      <div>Manage your playlists <span onClick={() => setPlaylistSaveSid(null)}><LinkButton href={"/profile/" + u.id}/></span></div>
      <div class="overflow-scroll flex-grow flex flex-col">
        <PlaylistsList playlists={u.playlists} onClick={adder} sid={playlistSaveSid} withouthistory={true} />
      </div>
    </Popper>
  )
}