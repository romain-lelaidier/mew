import { createSignal, Show } from "solid-js";
import { Icon } from "./icons";
import { BackButton } from "./utils";

function SearchBar(props) {
  const [query, setQuery] = createSignal(props.query || '');
  const [error, setError] = createSignal(null);

  const onsubmit = (event) => {
    event.preventDefault();
    if (query().length < 3) {
      return setError('Query length should be at least 3.');
    }
    if (typeof props.onsubmit === 'function') {
      props.onsubmit(query())
    }
    if (typeof props.navigator === 'function') {
      props.navigator('/search/' + encodeURIComponent(query()));
    }
  }

  const oninputchange = (event) => {
    setQuery(event.target.value);
    setError(null);
  }

  return (
    <div class="flex-grow">
      <form onSubmit={onsubmit}>
        <div class="relative">
          <input
            type="text"
            placeholder="Search"
            value={query()}
            onInput={oninputchange}
            class="w-full bg-white/10 border border-b/50 rounded-md pl-3 pr-9 py-1 transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow"
          />
          <Show when={query().length > 0}>
            <button type="reset" onClick={() => setQuery('')} class="absolute right-8 top-0 p-2 flex flex-col justify-center">
              <Icon type="xmark" size="1.1" />
            </button>
          </Show>
          <button type="submit" class="absolute right-0 top-0 rounded-r-md bg-b p-2 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-b/80 focus:shadow-none active:bg-b/80 hover:bg-b/80 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none">
            <Icon type="magnifying-glass" size="1" />
          </button>
        </div>
      </form>
      <Show when={error()}>
        <span class="text-red-700 p-3 italic">{error()}</span>
      </Show>
    </div>
  )
}

export function NavBar(props) {
  return (
    <div class="relative flex flex-row gap-1 items-center">
      <Show when={!props.nobackbtn}>
        <div class="mx-1">
          <BackButton><Icon type="chevron-down"/></BackButton>
        </div>
      </Show>
      <SearchBar {...props} />
    </div>
  )
}
