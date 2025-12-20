import { A, useLocation, useNavigate } from "@solidjs/router";
import { Icon } from "./icons";
import { Show } from "solid-js";
import { Flag } from "./flag";

export const mds = " · ";

export function chooseThumbnailUrl(img, width=Infinity) {
  if (typeof img == "object" && img.type == "lastfm") {
    var w = width == Infinity ? 400 : Math.ceil(width / 20) * 20;
    return `https://lastfm.freetls.fastly.net/i/u/${w}x${w}/${img.id}.jpg`
  }
  if (typeof img == "object" && img.type == "youtube") {
    return chooseThumbnailUrl(img.thumbnails, width);
  }
  if (!img || img.length == 0) return;
  if (typeof img == 'string') img = JSON.parse(img);
  img = JSON.parse(JSON.stringify(img))
  var sorted = img
    .sort((thb1, thb2) => thb2.width - thb1.width);
  var filtered = sorted.filter(thb => thb.width <= width)
  if (filtered.length > 0) return filtered[0].url;
  return sorted[sorted.length - 1].url;
}

export function timeAgo(date) {
  if (typeof date == 'object') date = new Date(date);
  const seconds = Math.floor((new Date() - date) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return interval === 1 ? `${interval} ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }

  return 'just now';
}

export function is2xx(res) {
  return Math.floor(res.status / 100) == 2;
}

export function url(result) {
  if (result.type == 'ARTIST') return `/artist/${result.id}`;
  if (result.type == 'SONG' || result.type == 'VIDEO' || result.type == 'ALBUM') return `/player/${result.id}`;
  return '';
}

export function viewCountString(viewCount) {
  if (!viewCount) return null;
  if (Math.floor(viewCount/1e9) > 0) return `${Math.floor(viewCount/1e8)/10}Mds`
  if (Math.floor(viewCount/1e6) > 0) return `${Math.floor(viewCount/1e5)/10}M`
  if (Math.floor(viewCount/1e3) > 0) return `${Math.floor(viewCount/1e2)/10}k`
  return viewCount.toString()
}

export function durationToString(duration) {
  if (!duration) return null;
  duration = Math.floor(duration);
  const pad = (i, w, s) => (s.length < i) ? pad(i, w, w + s) : s;
  return Math.floor(duration / 60) + ':' + pad(2, '0', (duration%60).toString())
}

export function listenersToString(listeners) {
  if (!listeners) return null;
  return viewCountString(listeners);
}


export function Link(props) {
  const location = useLocation();
  return <A state={{ previous: location.pathname }} {...props} />;
}

export function BackButton(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = () => (location.state?.previous || '/');
  return <button class="uppercase flex flex-row gap-1 items-center cursor-pointer text-base" onClick={() => navigate(backPath())}>
    <Show when={props.children} fallback={<><Icon type="arrow-left" size={1}/><span class="pt-[0.8]">back</span></>}>
      {props.children}
    </Show>
  </button>;
}

export function LinkButton(props) {
  const classes = "w-fit font-bold cursor-pointer";
  const text = props.text || props.children || 'here'
  if (props.href) {
    return <Link href={props.href} class={classes} {...props}>{text}</Link>
  }
  if (props.onclick || props.onClick) {
    return <span onclick={(props.onclick || props.onClick)} class={classes}>{text}</span>
  }
}

export function LinkIcon(props) {
  return (
    <Link {...props} class="flex flex-row items-center gap-1 font-bold"><Icon type={props.type}/>{props.text}</Link>
  )
}

export function User(props) {
  return (
    // <LinkIcon type="dna" text={props.user.name} href={"/profile/" + props.user.name}/>
    <Link class="inline flex flex-row gap-1 font-bold" href={"/profile/" + props.user.id}>
      <Show when={props.user.params?.iso}><Flag iso={props.user.params.iso} h={0.8}/>&nbsp;</Show>
      {props.user.params?.name || `user-${props.user.id}`}
      {/* <Icon type="dna"/>
      <span> </span> */}
      {/* <span class="font-bold">{props.user.name}</span> */}
    </Link>
  )
}