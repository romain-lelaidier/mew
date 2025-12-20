import { MetaProvider, Title } from "@solidjs/meta";
import { useNavigate } from '@solidjs/router';

import { NavBar } from '../components/navigation'
import { u, uLogOut, uTryLog } from '../components/auth';
import { Link, LinkButton, LinkIcon, mds, User } from '../components/utils';
import { Layout } from '../components/layout';
import { Flag } from "../components/flag";

export default function App() {
  const navigate = useNavigate();

  uTryLog();

  return (
    <Layout center={true}>
      
      <MetaProvider>
        <Title>Mew</Title>
      </MetaProvider>

      <div class="flex flex-col font-bold">
        <h1 class="text-6xl">Mew</h1>
        <h2 class="text-2xl">A minimalist YouTube Music player</h2>
      </div>

      <NavBar navigator={navigate} nobackbtn={true}/>

      <div class="text-xl">
        <Show
            when={u.connected}
            fallback={<div class="flex gap-2"><LinkIcon href="login" type="right-to-bracket" text="log in"/> or <LinkIcon href="signup" type="paw" text="register"/> to save your playlists</div>}
          >
            <div class="flex flex-row gap-1">
              <div>logged as <User user={u}/></div>
              <div>{mds}</div>
              <div class="font-bold flex flex-row gap-2">
                <LinkIcon href="/settings" type="gear" text="settings"/>{mds}
                <LinkIcon href="/" type="moon" text="disconnect" onClick={uLogOut}/>
              </div>
            </div>
          </Show>
      </div>

      <p class="text-red-700 font-bold max-w-150 text-base">
        This website is strictly restricted to its contributors.<br/>
        Users acknowledge that using this tool may be subject to third-party terms of service, including those of YouTube. By proceeding, users accept full responsibility for their actions and any resulting consequences.
      </p>

      <p>Download the Android app <LinkButton href="/app"/></p>
      <p class="text-md">Discover new music with <LinkButton href="https://last.fm" target="_blank" text="last.fm"/></p>

    </Layout>
  );
}
