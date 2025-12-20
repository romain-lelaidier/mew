import { A } from "@solidjs/router";
import { For } from "solid-js";
import { url, chooseThumbnailUrl, durationToString, viewCountString, Link, listenersToString } from "./utils.jsx"
import { Icon } from "./icons.jsx";

export const mds = ' · ';

export function QueueResults(props) {
  return (
    <div class="flex flex-col leading-[1.2] max-h-full overflow-y-hidden ls:overflow-y-scroll">
      <For each={props.queue}>{(result, j) =>
        <div onClick={() => props.onClick(j())} class="flex flex-row gap-1 hover:bg-white/10 p-1 rounded-sm items-center cursor-pointer">
          <Show when={props.i == j()}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class="w-6 h-6 mx-2">
              <path d="M532 71C539.6 77.1 544 86.3 544 96L544 400C544 444.2 501 480 448 480C395 480 352 444.2 352 400C352 355.8 395 320 448 320C459.2 320 470 321.6 480 324.6L480 207.9L256 257.7L256 464C256 508.2 213 544 160 544C107 544 64 508.2 64 464C64 419.8 107 384 160 384C171.2 384 182 385.6 192 388.6L192 160C192 145 202.4 132 217.1 128.8L505.1 64.8C514.6 62.7 524.5 65 532.1 71.1z"/>
            </svg>
          </Show>
          <Show when={result.albumsjson && JSON.parse(result.albumsjson).length > 0}
            fallback=<div class="flex flex-row items-center">
              <div class="w-8 h-8 flex justify-center items-center">
                <span>{result.index}.</span>
              </div>
              <div class="flex flex-col justify-center">
                <span class="font-bold">{result.name}</span>
                <Show when={result.duration}><span>{durationToString(result.duration)}</span></Show>
              </div>
            </div>
          >
            <img loading="lazy" class="h-16 rounded-sm" src={chooseThumbnailUrl(result.img || JSON.parse(result.imgjson), 100)} />
            <div>
              <span class="font-bold">{result.name}</span>
              <AggregateSpans strs={[
                [result.artistsjson ? JSON.parse(result.artistsjson)?.map(a => a.name)?.join(', ') : null],
                [result.albumsjson ? JSON.parse(result.albumsjson).map(a => a.name)?.join(', ') : null, "italic"]
              ]} sep={mds} bf={<br/>} />
              <AggregateSpans strs={[
                [durationToString(result.duration)]
              ]} sep={mds} bf={<br/>} />
            </div>
          </Show>
        </div>
      }</For>
    </div>
  )
}

export function SearchResultsAll(props) {
  const songs = [];
  const others = [];
  const top = [];
  for (const result of props.results) {
    if (result.top == true) {
      top.push(result);
    } else if (result.type == 'VIDEO' || result.type == 'SONG') {
      songs.push(result);
    } else {
      others.push(result);
    }
  }

  return (
    <>
      <Show when={top.length > 0}>
        <SearchResultTop result={top[0]} />
      </Show>
      <SearchResults results={songs} />
      <SearchResults results={others} />
    </>
  )
}

export function SearchResultsArtist(props) {
  const artist = props.artist;
  var description = artist.description;
  if (description) {
    let i = description.indexOf('(\n');
    if (i != 0) description = description.substring(0, i);
  }
  return (
    <>
      <div class="bg-b/10 flex flex-row flex-wrap overflow-hidden rounded-md mt-1">
        <img src={chooseThumbnailUrl(artist.img, 200)} class="max-h-32" />
        <div class="p-2 flex flex-col gap-1 justify-center">
          <div class="text-2xl">{artist.name}</div>
          <Show when={artist.listeners}>
            <div>{viewCountString(artist.listeners)} listeners</div>
          </Show>
          <Show when={artist.shufflePlayPID || artist.radioPlayPID}>
            <div class="flex flex-row flex-wrap gap-2 items-center">
              <Show when={artist.shufflePlayPID}>
                <A href={`/player/${artist.shufflePlaySID}?qid=${artist.shufflePlayPID}`} class="bg-b py-1 px-3 rounded-md text-white flex flex-row items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 640 640" class="w-4 h-4">
                    <path d="M467.8 98.4C479.8 93.4 493.5 96.2 502.7 105.3L566.7 169.3C572.7 175.3 576.1 183.4 576.1 191.9C576.1 200.4 572.7 208.5 566.7 214.5L502.7 278.5C493.5 287.7 479.8 290.4 467.8 285.4C455.8 280.4 448 268.9 448 256L448 224L416 224C405.9 224 396.4 228.7 390.4 236.8L358 280L318 226.7L339.2 198.4C357.3 174.2 385.8 160 416 160L448 160L448 128C448 115.1 455.8 103.4 467.8 98.4zM218 360L258 413.3L236.8 441.6C218.7 465.8 190.2 480 160 480L96 480C78.3 480 64 465.7 64 448C64 430.3 78.3 416 96 416L160 416C170.1 416 179.6 411.3 185.6 403.2L218 360zM502.6 534.6C493.4 543.8 479.7 546.5 467.7 541.5C455.7 536.5 448 524.9 448 512L448 480L416 480C385.8 480 357.3 465.8 339.2 441.6L185.6 236.8C179.6 228.7 170.1 224 160 224L96 224C78.3 224 64 209.7 64 192C64 174.3 78.3 160 96 160L160 160C190.2 160 218.7 174.2 236.8 198.4L390.4 403.2C396.4 411.3 405.9 416 416 416L448 416L448 384C448 371.1 455.8 359.4 467.8 354.4C479.8 349.4 493.5 352.2 502.7 361.3L566.7 425.3C572.7 431.3 576.1 439.4 576.1 447.9C576.1 456.4 572.7 464.5 566.7 470.5L502.7 534.5z"/>
                  </svg>
                  Shuffle
                </A>
              </Show>
              <Show when={artist.radioPlayPID}>
                <A href={`/player/${artist.radioPlaySID}?qid=${artist.radioPlayPID}`} class="bg-b py-1 px-3 rounded-md text-white flex flex-row items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 640 640" class="w-4 h-4">
                    <path d="M558.8 79C571.5 75.3 578.8 61.9 575.1 49.2C571.4 36.5 558 29.2 545.3 33L115.8 158.9C106.4 161.6 97.9 166.1 90.6 172C74.5 183.7 64 202.6 64 224L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 224C576 188.7 547.3 160 512 160L282.5 160L558.8 79zM432 272C476.2 272 512 307.8 512 352C512 396.2 476.2 432 432 432C387.8 432 352 396.2 352 352C352 307.8 387.8 272 432 272zM128 312C128 298.7 138.7 288 152 288L264 288C277.3 288 288 298.7 288 312C288 325.3 277.3 336 264 336L152 336C138.7 336 128 325.3 128 312zM128 408C128 394.7 138.7 384 152 384L264 384C277.3 384 288 394.7 288 408C288 421.3 277.3 432 264 432L152 432C138.7 432 128 421.3 128 408z"/>
                  </svg>
                  Radio
                </A>
              </Show>
            </div>
          </Show>
          <Show when={artist.tags}>
            <span class="flex flex-row italic">
              {artist.tags.join(', ')}
            </span>
          </Show>
        </div>
      </div>
      <SearchResultsAll results={artist.results} />
      <Show when={artist.description}>
        <For each={artist.description.split('\n')}>{(p, i) =>
          <p>{p}</p>
        }</For>
      </Show>
      <Show when={artist.similar}>
        <div class="flex flex-col gap-1">
          <h3 class="text-xl font-bold">Similar artists</h3>
          <div class="flex flex-row gap-2 no-scrollbar leading-none overflow-scroll">
            <For each={artist.similar}>{(result, j) =>
              <Link href={url({ type: "ARTIST", ...result })} class="shrink-0 flex flex-col max-w-30 w-30 gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
                <img loading="lazy" class="h-28 rounded-full" src={chooseThumbnailUrl(result.img, 160)} />
                <div class="flex flex-col gap-1 items-center">
                  <AggregateSpans strs={[
                    [result.name, "font-bold text-center"]
                  ]} sep={''} />
                </div>
              </Link>
            }</For>
          </div>
        </div>
      </Show>
    </>
  )
}

export function SearchResults(props) {
  if (props.results.length == 0) return (
    <div>
      No results.
    </div>
  )

  const sortedResults = [];
  var latestType = props.results[0].type;
  var latestTypeResults = [];
  for (const result of props.results) {
    if (result.type == latestType) {
      latestTypeResults.push(result);
    } else {
      sortedResults.push({
        type: latestType,
        results: latestTypeResults
      });
      latestType = result.type;
      latestTypeResults = [ result ];
    }
  }
  sortedResults.push({
    type: latestType,
    results: latestTypeResults
  });

  return (
    <div class="flex flex-col gap-2">
      <For each={sortedResults}>{(resultGroup, i) => 
        <SearchResultGroup group={resultGroup} />
      }</For>
    </div>
  );
}

export function SearchResultTop(props) {
  const result = props.result;
  if (result.type == 'VIDEO' || result.type == 'SONG') {
    return (
      <A href={url(result)} class="flex flex-row gap-2 hover:bg-white/10 p-1 rounded-sm items-center leading-[1.2] text-lg">
        <img loading="lazy" class="h-24 rounded-sm" src={chooseThumbnailUrl(result.img, 200)} />
        <div>
          <span class="font-bold">{result.name}</span>
          <AggregateSpans strs={[
            [result.artists ? result.artists.map(a => a.name).join(', ') : result.artist.name],
            [result.album?.name, "italic"]
          ]} sep={mds} bf={<br/>} />
          <AggregateSpans strs={[
            [durationToString(result.duration)],
            [listenersToString(result.listeners)]
          ]} sep={mds} bf={<br/>} />
        </div>
      </A>
    )
  }
  if (result.type == 'ARTIST') {
    return (
      <A href={url(result)} class="shrink-0 flex flex-row gap-2 text-lg hover:bg-white/10 p-1 rounded-sm items-center">
        <img loading="lazy" class="h-30 rounded-full" src={chooseThumbnailUrl(result.img, 160)} />
        <div class="flex flex-col gap-1 items-center">
          <AggregateSpans strs={[
            [result.name, "text-2xl"]
          ]} sep={''} />
        </div>
      </A>
    )
  }
}

function SearchResultGroup(props) {
  const group = props.group;
  if (group.type == 'VIDEO' || group.type == 'SONG') {
    return (
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold">{props.title || "Tracks"}</h3>
        <div class="flex flex-col leading-[1.2]">
          <For each={group.results}>{(result, j) =>
            <Link href={url(result)} class="flex flex-row gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
              <img loading="lazy" class="h-16 rounded-sm" src={chooseThumbnailUrl(result.img, 100)} />
              <div>
                <span class="font-bold">{result.name}</span>
                <Show when={result.artists?.length > 0 || result.albums?.length > 0}>
                  <br/>
                  <For each={result.artists}>{(artist, i) =>
                    <>
                      <Show when={i() > 0}><span>, </span></Show>
                      <Link href={"/artist/" + artist.id}>
                        <Show when={i() == 0}><span style="display: inline-block; margin-bottom: -0.15em"><Icon type="user" size={1}/></span></Show>
                        {artist.name}
                      </Link>
                    </>
                  }</For>
                  <Show when={result.artists?.length > 0 && result.albums?.length > 0}><span>{mds}</span></Show>
                  <For each={result.albums}>{(album, i) =>
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
                  [durationToString(result.duration)],
                  [listenersToString(result.listeners)]
                ]} sep={mds} bf={<br/>} />
              </div>
            </Link>
          }</For>
        </div>
      </div>
    )
  }

  if (group.type == 'ALBUM') {
    return (
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold">{props.title || "Albums"}</h3>
        <div class="flex flex-row gap-2 no-scrollbar leading-none overflow-scroll">
          <For each={group.results}>{(result, j) =>
            <Link href={url(result)} class="shrink-0 flex flex-col max-w-42 gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
              <img loading="lazy" class="h-40 rounded-sm" src={chooseThumbnailUrl(result.img, 160)} />
              <div class="flex flex-col gap-1 items-center">
                <AggregateSpans strs={[
                  [result.name, "font-bold text-center"],
                  [result.artist?.name]
                ]} sep={''} />
              </div>
            </Link>
          }</For>
        </div>
      </div>
    )
  }

  if (group.type == 'ARTIST') {
    return (
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold">{props.title || "Artists"}</h3>
        <div class="flex flex-row gap-2 no-scrollbar leading-none overflow-scroll">
          <For each={group.results}>{(result, j) =>
            <A href={url(result)} class="shrink-0 flex flex-col max-w-42 w-42 gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
              <img loading="lazy" class="h-40 rounded-full" src={chooseThumbnailUrl(result.img, 160)} />
              <div class="flex flex-col gap-1 items-center">
                <AggregateSpans strs={[
                  [result.name, "font-bold text-center"]
                ]} sep={''} />
              </div>
            </A>
          }</For>
        </div>
      </div>
    )
  }

  if (group.type == 'PLAYLIST') {
    return (
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold">Playlists</h3>
        <div class="flex flex-row gap-2 no-scrollbar leading-none overflow-scroll">
          <For each={group.results}>{(result, j) =>
            <div class="shrink-0 flex flex-col max-w-42 gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
              <img loading="lazy" class="h-40 rounded-sm" src={chooseThumbnailUrl(result.img, 160)} />
              <div class="flex flex-col gap-1 items-center">
                <AggregateSpans strs={[
                  [result.name, "font-bold text-center"],
                  [result.artist],
                  [result.year, "opacity-80"]
                ]} sep={''} />
              </div>
            </div>
          }</For>
        </div>
      </div>
    )
  }

  return (
    <div>Not implemented ({group.type})</div>
  )
}

export function AggregateSpans(props) {
  var strs = props.strs.filter(element => element != null && element[0] != null);
  if (strs.length == 0) return (<></>);
  return (
    <>
      {props.bf}
      <For each={strs}>{([text, classes], i) =>
        <>
          <Show when={i() > 0}>{props.sep}</Show>
          <span class={classes}>{text}</span>
        </>
      }</For>
    </>
  )
}