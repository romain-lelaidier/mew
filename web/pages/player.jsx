import { useNavigate, useParams, useSearchParams, A } from "@solidjs/router";
import { Show } from 'solid-js';
import { MetaProvider, Title } from "@solidjs/meta";

import { NavBar } from "../components/navigation";
import { QueueResults } from '../components/results';
import { chooseThumbnailUrl } from "../components/utils";
import { getPlaylists, PlaylistAdder } from "../components/playlists";
import { player } from "../player/logic";
import { onImageLoad, PBar, PControls, PInfos } from "../player/utils";
import { Layout } from "../components/layout";

export default function App() {
  const params = useParams();

  const [searchParams, setSearchParams] = useSearchParams();

  player.start(decodeURIComponent(params.id), searchParams)

  getPlaylists();

  const navigate = useNavigate();

  return (
    <Layout isplayer={true}>

      <MetaProvider>
        <Title>Mew - {player.s.current ? player.s.current.name : 'Loading...'}</Title>
      </MetaProvider>

      <Show when={player.requestAutoplay()}>
        <div class="absolute z-2 bg-d/90 w-full h-full flex items-center justify-center">
          <div class="flex flex-col p-4 items-center [&>*]:text-center">
            <span class="text-red-700 font-bold">Audio autoplay is blocked.</span>
            <span>Please interact with the page to play the audio, and ideally disable autoplay restrictions.</span>
            <span class="italic">Click anywhere to continue.</span>
          </div>
        </div>
      </Show>

      {/* Current song details */}
      <div class="flex-1 flex m-2 items-center justify-center">
        <Show when={player.s.started && player.s.loaded && player.s.current}>
          <div class="p-2 bg-d rounded-md drop-shadow-[0_0px_10px_rgba(0,0,0,0.15)]">
            <div style="width: min(min(90vw, 90vh),20rem)" class="flex flex-col items-center justify-center gap-3">
              <Show when={player.s.info.artist}>
                <div class="flex flex-col items-center leading-[1.2] mt-1">
                  <span class="text-center">Playing <span class="font-bold">{player.s.info.name}</span> (album) by <A href={`/artist/${player.s.info.artistId}`} class="italic">{player.s.info.artist}</A></span>
                </div>
              </Show>
              <div class="bg-b/20 w-full rounded-md">
                <img class="rounded-md" onLoad={onImageLoad} src={window.location.origin + '/api/img?url=' + chooseThumbnailUrl(player.s.info.img || player.s.current.img)} />
              </div>
              <div class="flex flex-col items-center leading-[1.2] text-center">
                <PInfos/>
              </div>
              <PBar />
              <div class="flex flex-row items-center justify-center gap-2 mb-1">
                <PControls/>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Queue */}
      <div style="min-width:50vw" class="bg-d flex flex-row flex-1 w-full justify-center ls:max-h-full ls:overflow-hidden">
        <div class="flex flex-col gap-2 py-4 px-4 w-130 max-h-full ls:overflow-hidden">
          <NavBar navigator={navigate} />
          <h3 class="text-xl font-bold">Queue</h3>
          <div class="flex-grow max-h-full overflow-hidden">
            <Show when={player.s.loaded} fallback="Loading queue...">
              <Show when={player.s.queue.length > 0} fallback="Queue is empty.">
                <QueueResults queue={player.s.queue} i={player.s.i} onClick={i => player.actions.jump(i)} album={player.s.info.type != 'SONG'} />
              </Show>
            </Show>
          </div>
        </div>
      </div>

    </Layout>
  )
}
