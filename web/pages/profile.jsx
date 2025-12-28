import { A, useParams } from '@solidjs/router';
import { MetaProvider, Title } from "@solidjs/meta";
import { u, uTryLog } from "../components/auth"
import { createPlaylist, getUser, PlaylistsList } from '../components/playlists';
import { Bar } from '../components/bar';
import { BackButton } from '../components/utils';
import { Icon } from '../components/icons';
import { Layout } from '../components/layout';
import { createResource, createSignal, Match, Switch } from 'solid-js';
import { Flag } from '../components/flag';
import { Popper } from '../components/popper';

export default function App() {

  uTryLog();
  const id = useParams().id;
  const [ data ] = createResource(id, getUser);
  const [ cplTrigger, setCplTrigger ] = createSignal(null);

  function onCreatePlaylist(name) {
    createPlaylist(name);
    setCplTrigger(null);
  }

  return (
    <Layout>

      <MetaProvider>
        <Title>Mew</Title>
      </MetaProvider>

      <div>
        <BackButton/>
        <Show when={data()} fallback={<div class="text-3xl font-bold">user-{id}</div>}>
          <div class="text-3xl font-bold">
            <Show when={data().params?.iso}><Flag iso={data().params.iso} h={0.8}/>&nbsp;</Show>
            {data().params?.name || `user-${id}`}
          </div>
        </Show>
      </div>

      <div class="flex flex-col gap-2">
        <Show when={data()} fallback={<div>Loading data...</div>}>
          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold">Playlists</h2>

            <Switch>
              <Match when={u.connected && id == u.id}>
                <span class="bg-black px-2 py-1 text-d rounded-md cursor-pointer w-fit" onClick={(e) => { e.preventDefault(); setCplTrigger(true) }}>
                  <span class="flex flex-row gap-1 items-center w-fit mr-1 text-base"><Icon type="square-plus"/>Create a playlist</span>
                </span>
                <div><PlaylistsList playlists={u.playlists} editable={true} /></div>
              </Match>
              <Match when={data().playlists}>
                <div><PlaylistsList playlists={data().playlists} editable={false} /></div>
              </Match>
            </Switch>

          </div>
        </Show>
      </div>

      <Popper sig={[cplTrigger, setCplTrigger]} title="Create playlist">
        <Bar 
          onsubmit={onCreatePlaylist}
          placeholder={"playlist name"}
          button={<div class="flex flex-row gap-1"><Icon type="square-plus" size="1.1"/></div>}
          />
      </Popper>

    </Layout>
  );
}
