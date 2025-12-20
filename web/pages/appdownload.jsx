import { MetaProvider, Title } from "@solidjs/meta";
import { A, useNavigate } from '@solidjs/router';

import { Layout } from '../components/layout';

export default function App() {
  const navigate = useNavigate();

  return (
    <Layout center={true}>
      
      <MetaProvider>
        <Title>Mew - App Download</Title>
      </MetaProvider>

      <div class="flex flex-col font-bold">
        <h1 class="text-6xl">Mew</h1>
        <h2 class="text-2xl">App Download</h2>
      </div>

      <p>If you encounter problems while using this simple app, please contact me using the address below the page.</p>

      <p>If you know which architecture your phone runs on, please choose one the below downloads:</p>

      <div>
        <ul class="list-disc pl-8">
          <li><A href="release-armeabi-v7a.apk" target="_blank"><span class="font-mono">release-armeabi-v7a.apk</span></A></li>
          <li><A href="release-arme64-v8a.apk" target="_blank"><span class="font-mono">release-arme64-v8a.apk</span></A></li>
          <li><A href="release-x86_64.apk" target="_blank"><span class="font-mono">release-x86_64.apk</span></A></li>
        </ul>
      </div>

      <p>Otherwise, just download this heavier release:</p>


      <div>
        <ul class="list-disc pl-8">
          <li><A href="release.apk" target="_blank"><span class="font-mono">release.apk</span></A></li>
        </ul>
      </div>

    </Layout>
  );
}
