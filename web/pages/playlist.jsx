import { useParams } from '@solidjs/router';
import { MetaProvider, Title } from "@solidjs/meta";
import { createResource, createSignal, ErrorBoundary, For, Show } from 'solid-js';
import { AggregateSpans, mds } from '../components/results';
import { BackButton, durationToString, timeAgo, User, Link, url, chooseThumbnailUrl, listenersToString } from '../components/utils';
import { getPlaylist, removeFromPlaylist } from '../components/playlists';
import { Icon } from '../components/icons';
import { Popper } from '../components/popper';
import { Layout } from '../components/layout';
import { u } from '../components/auth';

export default function App() {

  const params = useParams();
  const pid = params.pid;
  const [ playlist, { refetch } ] = createResource(pid, getPlaylist);
  const [ trashSid, setTrashSid ] = createSignal(null);

  return (
    <Layout>
      
      <MetaProvider>
        <Title>Mew - Playlist</Title>
      </MetaProvider>

      <BackButton/>
      <ErrorBoundary fallback={<div>Error loading playlist: <b class="text-red-700">{playlist.error.message}</b></div>}>

      <div>
        <div class="text-3xl">{playlist() ? (playlist().name || "History") : "Loading playlist..."}</div>
      </div>

      <Show when={playlist()}>
        <div>
          <div>By <For each={playlist().owners}>{ owner => <User user={owner} /> }</For></div>
          <div>Created <span>{timeAgo(playlist().createdAt)} ({new Date(playlist().createdAt).toLocaleString()})</span></div>
          
          <Show when={playlist().songs.length > 0}>
            <Link href={`/player/${playlist().pid}`} class="w-fit bg-b py-1 mt-1 px-3 rounded-md text-white flex flex-row items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 640 640" class="w-4 h-4">
                <path d="M187.2 100.9C174.8 94.1 159.8 94.4 147.6 101.6C135.4 108.8 128 121.9 128 136L128 504C128 518.1 135.5 531.2 147.6 538.4C159.7 545.6 174.8 545.9 187.2 539.1L523.2 355.1C536 348.1 544 334.6 544 320C544 305.4 536 291.9 523.2 284.9L187.2 100.9z"/>
              </svg>
              Play
            </Link>
          </Show>
        </div>
        <div class="flex flex-col leading-[1.2]">

          <For each={playlist().songs}>{(song, j) =>
            <Link href={`/player/${song.id}`} class="flex flex-row gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
            {/* <Link href={url(song)} class="flex flex-row gap-1 hover:bg-white/10 p-1 rounded-sm items-center"> */}
              <img loading="lazy" class="h-16 rounded-sm" src={chooseThumbnailUrl(song.img, 100)} />
              <div class="flex-grow">
                <span class="font-bold">{song.name}</span>
                <Show when={song.artists?.length > 0 || song.albums?.length > 0}>
                  <br/>
                  <For each={song.artists}>{(artist, i) =>
                    <>
                      <Show when={i() > 0}><span>, </span></Show>
                      <Link href={"/artist/" + artist.id}>
                        <Show when={i() == 0}><span style="display: inline-block; margin-bottom: -0.15em"><Icon type="user" size={1}/></span></Show>
                        {artist.name}
                      </Link>
                    </>
                  }</For>
                  <Show when={song.artists?.length > 0 && song.albums?.length > 0}><span>{mds}</span></Show>
                  <For each={song.albums}>{(album, i) =>
                    <>
                      <Show when={i() > 0}><span>, </span></Show>
                      <Link href={"/album/" + album.id}>
                        <Show when={i() == 0}><span style="display: inline-block; margin-bottom: -0.15em"><Icon type="record-vinyl" size={1}/></span></Show>
                        <i>{album.name}</i>
                      </Link>
                    </>
                  }</For>
                </Show>
                <AggregateSpans strs={[
                  [durationToString(song.duration)]
                ]} sep={mds} bf={<br/>} />
              </div>

              <Show when={u.connected && playlist().owners.some(owner => owner.id == u.id) && playlist().history != true}>
                <div class="mr-2 flex flex-row gap-1 items-center">
                  <button onClick={(e) => { e.preventDefault(); setTrashSid(song.id); }}><Icon type="trash"/></button>
                </div>
              </Show>
            </Link>
          }</For>

          <Show when={playlist().songs.length == 0}>
            <div>This playlist is empty.</div>
          </Show>
        </div>
      </Show>

      <Popper sig={[trashSid, setTrashSid]} title="Remove song">
        <div class="pb-2">
          <div>Are you sure you want to remove <span class="font-bold">{playlist().songs.filter(song => song.id == trashSid())[0].name}</span> from this playlist ?</div>
          <div class="flex flex-row-reverse mt-1">
            <button class="flex flex-row px-3 py-1 bg-red-700 text-white rounded-md items-center gap-1" onclick={() => { removeFromPlaylist(pid, trashSid()).then(refetch); setTrashSid(null) }}><Icon type="trash" size="1.1"/>Delete</button>
          </div>
        </div>
      </Popper>

      </ErrorBoundary>

    </Layout>
  );
}
