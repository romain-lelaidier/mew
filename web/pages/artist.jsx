import { useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, onMount, Show, Switch } from 'solid-js';

import { NavBar } from "../components/navigation";
import { SearchResultsArtist } from '../components/results';
import { MetaProvider, Title } from "@solidjs/meta";
import { Layout } from "../components/layout";

async function fetchArtist(id) {
  // if (!!id.match(/^[a-zA-Z0-9_-]{24}$/)) return;
  const response = await fetch(`${window.location.origin}/api/artist/${id}`);
  return response.json();
}

export default function App() {
  const params = useParams();
  const id = decodeURIComponent(params.id);

  const navigate = useNavigate();

  const [ artist ] = createResource(id, fetchArtist)

  return (
    <Layout>

      <MetaProvider>
        <Title>Mew - {artist()?.name || 'Loading...'}</Title>
      </MetaProvider>

      <NavBar navigator={navigate} />

      {/* Search Results */}
      <Show when={!artist.loading} fallback={<div>Loading results...</div>}>
        <Switch>
          <Match when={artist.error}>
            <span>Error: {artist.error}</span>
          </Match>
          <Match when={artist()}>
            <SearchResultsArtist artist={artist()} />
          </Match>
        </Switch>
      </Show>

    </Layout>
  )
}
