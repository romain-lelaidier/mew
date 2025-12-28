import { useNavigate, useParams, useSearchParams, A } from "@solidjs/router";
import { createSignal, For, Match, Show, Switch } from 'solid-js';
import { MetaProvider, Title } from "@solidjs/meta";

import { NavBar } from "../components/navigation";
import { QueueResults } from '../components/results';
import { chooseThumbnailUrl, User } from "../components/utils";
import { getPlaylists } from "../components/playlists";
import { player } from "../player/logic";
import { fastDownload, onImageLoad, PBar, PControls, PInfos, Converter } from "../player/utils";
import { Layout } from "../components/layout";
import { Icon } from "../components/icons";
import { Popper } from "../components/popper";

export default function App() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  player.start(decodeURIComponent(params.id), searchParams)
  getPlaylists();

  function HoverButton(props) {
    return (
      <div class="relative w-8 h-8 rounded-full flex items-center justify-center bg-b text-d transition duration-100 ease-in-out hover:scale-110 overflow-hidden" onClick={props.onClick}>
        <Icon type={props.type} size={1}/>
      </div>
    );
  }

  function ShareButton(props) {
    const [ shareState, setShareState ] = createSignal(false);
    var r;
    function share() {
      navigator.clipboard.writeText(props.url());
      setShareState(true);
      if (r) clearTimeout(r);
      r = setTimeout(() => setShareState(false), 1000);
    }
    return <HoverButton type={shareState() ? "clipboard-check" : "share-nodes"} onClick={share} />
  }

  const converter = new Converter();
  const [ conversionTrigger, setConversionTrigger ] = createSignal(null);

  async function startConversion(props) {
    const id = player.s.current.id;
    setConversionTrigger(id);
    converter.requestConversion(id);
    if (!converter.s[id]) setConversionTrigger(null);
  }

  return (
    <Layout isplayer={true}>

      <MetaProvider>
        <Title>Mew - {player.s.current ? player.s.current.name : 'Loading...'}</Title>
      </MetaProvider>

      <Show when={player.requestAutoplay()}>
        <div class="absolute z-2 bg-d/90 w-full h-full flex items-center justify-center">
          <div class="flex flex-col p-4 items-center [&>*]:text-center">
            <span class="text-r font-bold">Audio autoplay is blocked.</span>
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
              <div class="bg-b/20 w-full rounded-md relative group rounded-md overflow-hidden" tabindex="0">
                <img class="rounded-md" onLoad={onImageLoad} src={window.location.origin + '/api/img?url=' + chooseThumbnailUrl(player.s.current.img)} />
                <div class="w-full h-20 absolute -top-20 group-hover:top-0 group-focus:top-0 transition-[top] duration-200 ease-in-out p-2 flex flex-row gap-1">
                  <ShareButton url={() => `${window.location.origin}/player/${player.s.current.id}`} />
                  <HoverButton type="download" onClick={startConversion} />
                  <HoverButton type="bolt-lightning" onClick={fastDownload} />
                </div>
              </div>
              <div class="flex flex-col items-center leading-[1.2] text-center">
                <PInfos/>
              </div>
              <PBar />
              <div class="flex flex-row items-center justify-center gap-1 mb-1">
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

          <Switch>

            <Match when={!player.s.loaded}>
              Loading queue...
            </Match>

            <Match when={player.s.info.type == 'SONG'}>
              <h3 class="text-xl font-bold">Queue</h3>
              <div class="flex-grow max-h-full overflow-hidden">
                <QueueResults queue={player.s.queue} i={player.s.i} onClick={i => player.actions.jump(i)} album={false} />
              </div>
            </Match>

            <Match when={player.s.info.type == 'ALBUM'}>
              <div class="flex flex-row gap-2 items-center">
                <div>
                  <img class="rounded-md max-h-24" onLoad={onImageLoad} src={window.location.origin + '/api/img?url=' + chooseThumbnailUrl(JSON.parse(player.s.info.imgjson))} />
                </div>
                <div class="flex flex-col">
                  <h3 class="text-xl font-bold">{player.s.info.name}</h3>
                  <h3 class="text-lg">An album by <For each={JSON.parse(player.s.info.artistsjson)}>{(artist, i) =>
                    <>
                      <Show when={i() > 0}>,&nbsp;</Show>
                      <A class="font-bold" href={`/artist/${artist.id}`}>{artist.name}</A>
                    </>
                  }</For></h3>
                  <div class="flex flex-row gap-1">
                    <ShareButton url={() => `${window.location.origin}/player/${player.s.info.id}`} />
                    {/* <HoverButton type="download" onClick={requestDownload} /> */}
                  </div>
                </div>
              </div>
              <div class="flex-grow max-h-full overflow-hidden">
                <QueueResults queue={player.s.queue} i={player.s.i} onClick={i => player.actions.jump(i)} album={true} />
              </div>
            </Match>

            <Match when={player.s.info.type == 'MPL'}>
              <div class="flex flex-row gap-2 items-center">
                {/* <div>
                  <img class="rounded-md max-h-24" onLoad={onImageLoad} src={window.location.origin + '/api/img?url=' + chooseThumbnailUrl(JSON.parse(player.s.info.imgjson))} />
                </div> */}
                <div class="flex flex-col">
                  <h3 class="text-xl font-bold">{player.s.info.name}</h3>
                  <h3 class="text-lg">A playlist by <For each={player.s.info.owners}>{(owner, i) =>
                    <>
                      <Show when={i() > 0}>,&nbsp;</Show>
                      <User user={owner}/>
                    </>
                  }</For></h3>
                  <div class="flex flex-row gap-1">
                    <ShareButton url={() => `${window.location.origin}/player/${player.s.info.id}`} />
                  </div>
                </div>
              </div>
              <div class="flex-grow max-h-full overflow-hidden">
                <QueueResults queue={player.s.queue} i={player.s.i} onClick={i => player.actions.jump(i)} album={false} />
              </div>
            </Match>

          </Switch>

        </div>
      </div>

      <Popper sig={[ conversionTrigger, setConversionTrigger ]} title="Downloading MP3">
        <Show when={conversionTrigger() in converter.s && converter.s[conversionTrigger()] != null}>
          <div>{["Extracting video", "Downloading audio", "Converting to mp3", "Adding metadata"][converter.s[conversionTrigger()].state()]}</div>
          <div class="w-full h-1 mt-1 relative rounded-md">
            <div class="w-full h-full absolute bg-b/20"></div>
            <div style={{
              position: 'absolute',
              height: '100%',
              width: `${Math.min(100, Math.max(0, (converter.s[conversionTrigger()].state()-1+converter.s[conversionTrigger()].progress()/100)*50))}%`,
              background: 'black'
            }}></div>
          </div>
          <div class="w-full flex flex-row justify-between">
            <div>{Math.min(4, converter.s[conversionTrigger()].state()+1)}/4</div>
            <div>{converter.s[conversionTrigger()].progress()}%</div>
          </div>
        </Show>
      </Popper>

    </Layout>
  )
}
