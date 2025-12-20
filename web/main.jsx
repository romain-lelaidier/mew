import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";

import Home from "./pages/index.jsx";
import Search from "./pages/search.jsx"
import Artist from "./pages/artist.jsx"
import Legal from "./pages/legal.jsx"
import Player from "./pages/player.jsx"
import Profile from "./pages/profile.jsx"
import Playlist from "./pages/playlist.jsx"
import AppDownload from "./pages/appdownload.jsx"
import { Login, Settings, Signup, Verify } from "./pages/logger.jsx";
import { Layout } from "./components/layout.jsx";
import { MetaProvider, Title } from "@solidjs/meta";
import { BackButton } from "./components/utils.jsx";

function Page404() {
  return (
    <Layout center={true}>
      <MetaProvider>
        <Title>404 - The Geographer</Title>
      </MetaProvider>

      <BackButton/>

      <div class="text-xl">
        404 - Not found
      </div>
    </Layout>
  );
}

render(
  () => (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/search" component={Home} />
      <Route path="/search/:query" component={Search} />
      <Route path="/artist/:id" component={Artist} />
      <Route path="/legal" component={Legal} />
      <Route path="/player/:id" component={Player} />
      <Route path="/signup" component={Signup} />
      <Route path="/verify/:id/:verificationToken" component={Verify} />
      <Route path="/login" component={Login} />
      <Route path="/settings" component={Settings} />
      <Route path="/profile/:id" component={Profile} />
      <Route path="/playlist/:pid" component={Playlist} />
      <Route path="/app" component={AppDownload} />
      <Route path="*paramName" component={Page404} />
    </Router>
  ),
  document.getElementById("app")
);
