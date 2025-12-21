import { Show } from "solid-js";
import { Portal } from "solid-js/web"
import { Icon } from "./icons";

var popperNumber = 0;

export function Popper(props) {

  const id = "popper" + (popperNumber++)

  const handleClick = (e) => {
    if (e.target.id == id) {
      props.sig[1](null)
    }
  }

  return (
    <Portal>
      <Show when={props.sig[0]()}>
        <div id={id} class="fixed top-0 left-0 w-full h-full bg-b/70 z-40 flex items-center justify-center" onClick={handleClick}>
          <div style={{'max-height': '90vh'}} class="absolute flex flex-row max-w-full w-100 m-2 bg-d px-4 pt-2 pb-4 rounded-md drop-shadow-[0_0px_10px_rgba(0,0,0,0.15)]">
            <div class="flex flex-col flex-grow gap-2">
              <div class="flex flex-row gap-1 items-center">
                <div class="text-xl flex-grow font-bold">{props.title}</div>
                <button onClick={() => props.sig[1](null)}><Icon type="xmark" size="1.2" /></button>
              </div>
              <Show when={props.top}>
                <div>{props.top}</div>
              </Show>
              <div class="flex-grow overflow-y-scroll">
                {props.children}
              </div>
            </div>
          </div>
        </div>
      </Show>
    </Portal>
  )
}