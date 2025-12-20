import { createSignal } from "solid-js";

export function Bar(props) {
  const [ val, setVal ] = createSignal('');
  const [ error, setError ] = createSignal(null);

  const oninputchange = (event) => {
    setVal(event.target.value);
    setError(null);
  }

  const onsubmit = (e) => {
    e.preventDefault()
    if (props.istoken) {
      const uid = val();
      if (uid.length != 32) {
        setError("Your token should be of length 32.");
      } else if (!uid.match(/^[a-zA-Z0-9]{32}$/)) {
        setError("Your token should only features alphanumeric characters")
      } else {
        props.onsubmit(uid);
      }
    } else {
      props.onsubmit(val())
    }
  }

  return (
    <div class="relative">
      <form onSubmit={onsubmit} class="relative">
        <div>
          <input
            type="text"
            placeholder={props.placeholder}
            value={val()}
            onInput={oninputchange}
            class="font-mono w-full bg-white/10 border border-b/50 rounded-md pl-3 py-1 transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow"
          />
          <button type="submit" class="absolute right-0 top-0 rounded-r-md bg-b h-full px-2 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-b/80 focus:shadow-none active:bg-b/80 hover:bg-b/80 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none">{props.button}</button>
        </div>
      </form>
      <Show when={error()}>
        <span class="text-red-700 p-3 italic">{error()}</span>
      </Show>
    </div>
  )
}