import { MetaProvider, Title } from "@solidjs/meta";
import { A, useNavigate } from '@solidjs/router';

import { Layout } from '../components/layout';
import { BackButton } from "../components/utils";

export default function App() {
  const navigate = useNavigate();

  return (
    <Layout center={true}>
      
      <MetaProvider>
        <Title>Mew - App Download</Title>
      </MetaProvider>

      <div class="flex flex-col font-bold">
        <BackButton/>
        <h1 class="text-6xl">Mew</h1>
        <h2 class="text-2xl">App Download</h2>
      </div>

      <p>If you know which architecture your phone runs on, please choose one the below downloads ({'<'}20Mb):</p>

      <div>
        <ul class="list-disc pl-8">
          <li><A href="https://rlup.fr/mew-armeabi-v7a.apk" target="_blank"><span class="font-mono italic">mew-armeabi-v7a.apk</span></A></li>
          <li><A href="https://rlup.fr/mew-arme64-v8a.apk" target="_blank"><span class="font-mono italic">mew-arme64-v8a.apk</span></A></li>
          <li><A href="https://rlup.fr/mew-x86_64.apk" target="_blank"><span class="font-mono italic">mew-x86_64.apk</span></A></li>
        </ul>
      </div>

      <p>Otherwise, just download this heavier release (50Mb):</p>

      <div>
        <ul class="list-disc pl-8">
          <li><A href="https://rlup.fr/mew.apk" target="_blank"><span class="font-mono font-bold">mew.apk</span></A></li>
        </ul>
      </div>

      <p class="text-r italic">If you encounter problems while using this simple app, please contact me using the address at the bottom of the page.</p>

    </Layout>
  );
}
