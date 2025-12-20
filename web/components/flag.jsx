import { createSignal, For } from "solid-js"
import { info } from "./flaginfo.jsx"
import { Popper } from "./popper.jsx"

export function Flag(props) {
  return (
    <Show when={props.iso}>
      <img style={{height: `${props.h || 1}em`}} class="inline rounded-sm mb-[0.2em]" src={`data:image/webp;base64,${info[props.iso].flag}`}></img>
    </Show>
  )
}

export function FlagSelector(props) {
  const [trigger, setTrigger] = createSignal(null);
  const [query, setQuery] = createSignal('');

  const isos = [];

  const names = {};
  for (const iso of Object.keys(info)) {
    var selected = false;
    if (props.isos != null) {
      if (props.isos.includes(iso)) selected = true;
    } else {
      if (info[iso].flag) selected = true;
    }
    if (selected) {
      isos.push(iso);
      names[iso] = [ iso ];
      for (const [_, val] of Object.entries(info[iso].name)) names[iso].push(val.toLowerCase());
    }
  }

  function isSelected(iso) {
    if (query().length == 0) return true;
    for (const name of names[iso]) {
      if (name.includes(query())) return true;
    }
    return false;
  }

  return (
    <Show when={props.iso}>
      <div>
        <div onClick={() => setTrigger(true)}>
          <Show
            when={props.children}
            fallback={<img class="h-9 inline rounded-sm shadow-md transition-all duration-100 hover:rotate-10" src={`data:image/webp;base64,${info[props.iso].flag}`}></img>}>
            {props.children}
          </Show>
        </div>
        <Popper
          title={props.title || "Select a flag"} sig={[trigger, setTrigger]}
          top={<input type="text" value={query()} onInput={(e) => setQuery(e.target.value.toLowerCase())} placeholder="search a flag" class="w-full rounded-sm py-1 px-2 bg-white/20 outline-none"/>}
        >
          <div class="flex flex-col flex-grow cursor-pointer">
            <For each={Object.keys(info)}>{(iso, i) => 
              <Show when={isos.includes(iso)}>
                <div class="flex-row hover:bg-white/10 items-center p-1" style={{display: isSelected(iso) ? 'flex' : 'none'}} onClick={() => { setTrigger(null); props.setter(iso) }}>
                  <div class="w-16 flex flex-col items-center">
                    <img class="h-7 inline rounded-sm shadow-md" loading="lazy" src={`data:image/webp;base64,${info[iso].flag}`}></img>
                  </div>
                  <div class="w-12 text-sm text-center">{iso}</div>
                  <div class="lowercase font-bold text-lg">{info[iso].name.en}</div>
                </div>
              </Show>
            }</For>
          </div>
        </Popper>
      </div>
    </Show>
  )
}