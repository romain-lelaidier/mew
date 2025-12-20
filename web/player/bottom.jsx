import { Show } from "solid-js";
import { player } from "./logic";
import { onImageLoad, PBarNoText, PControls, PInfos } from "./utils";
import { chooseThumbnailUrl } from "../components/utils";
import { useNavigate } from "@solidjs/router";
import { Icon } from "../components/icons";

export function BottomPlayer(props) {
  const navigate = useNavigate();
  return (
    <Show when={player.s.started && player.s.loaded && player.s.current}>
      <div class="min-h-20 flex items-center justify-end flex-wrap" style={{flexFlow: 'row wrap-reverse'}}>
        <div class="flex-3 flex flex-row gap-2 items-center mr-2">
          <div class="px-2" onClick={() => player.openSelf(navigate)}>
            <Icon type="chevron-up" size={1.5}/>
          </div>
          <div class="bg-b/20 w-18 rounded-md">
            <img class="rounded-md" onLoad={onImageLoad} onClick={() => player.openSelf(navigate)} src={window.location.origin + '/api/img?url=' + chooseThumbnailUrl(player.s.info.img || player.s.current.img)} />
          </div>
          <div class="flex flex-col leading-[1.2]">
            <PInfos bottom={true}/>
          </div>
        </div>
        <div class="flex-6 flex flex-row justify-center mb-[-0.2em] mt-[0.2em]">
          <div class="max-w-70 sm:max-w-85 md:max-w-100 flex-grow flex flex-col items-center gap-1">
            <div class="flex flex-row items-center justify-center gap-1 mt-1">
              <PControls size={0.7} />
            </div>
            <div class="w-full">
              <PBarNoText/>
            </div>
          </div>
        </div>
        <div class="flex-none sm:flex-1 md:flex-2 lg:flex-3"></div>
      </div>
    </Show>
  )
}