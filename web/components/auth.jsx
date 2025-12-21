import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { is2xx } from "./utils";
import { getPlaylists } from "./playlists";

export const [ token, setToken ] = createSignal(localStorage.getItem("token"));
createEffect(() => {
  localStorage.setItem("token", token());
})

function hash(password) {
  return password;
}

export const [ u, setU ] = createStore({
  connected: false,
  id: null,
  playlists: {},
  get name() {
    if (this.params && this.params.name) return this.params.name;
    if (this.id) return `user-${this.id}`;
  },
  get iso() {
    if (this.params && this.params.iso) return this.params.iso;
    return "wor";
  }
});

export const uLogOut = async () => {
  setToken(null);
  setU("uname", null);
  setU("connected", false);
  setU("playlists", null);
  setU("playlists", {});
}

export async function post(url, json) {
  const params = {
    method: 'POST',
    body: JSON.stringify(json),
    headers: { "Content-type": "application/json" },
  }
  if (token() != 'null') params.headers.authorization = token();
  return await fetch(url, params);
}

async function logFromRes(res) {
  if (!is2xx(res)) {
    uLogOut();
    const json = await res.json();
    throw await json.error;
  }
  const json = await res.json();
  if ('token' in json) {
    setToken(json.token);
    setU("id", json.id);
    setU("connected", true);
    setU("params", {});
    if (json.params) {
      if ('name' in json.params) setU("params", "name", json.params.name);
      if ('iso' in json.params) setU("params", "iso", json.params.iso);
    }
    getPlaylists();
  } else {
    uLogOut();
    throw await res.text();
  }
}

export const uTryLog = async (email, password) => {
  if (u.connected) return true;
  if (email && password) {
    const res = await post('/um/login', { email, password: hash(password) });
    await logFromRes(res);
    return true;
  } else if (token() && token() != 'null') {
    // try to relog (probably restarting a session)
    const res = await post('/um/relog');
    await logFromRes(res);
    return true;
  }
  return false;
}

export const uTrySignup = async (email, password) => {
  const res = await post('/um/signup', { email, password: hash(password) });
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  return json.message;
}

export const uVerify = async (id, verificationToken) => {
  const res = await post('/um/verify', { id, verificationToken });
  if (!is2xx(res)) {
    const json = await res.json();
    throw json.error;
  }
  await logFromRes(res);
}

export const uSaveParams = async (params) => {
  const res = await post('/um/setparams', { params });
  if (!is2xx(res)) {
    const json = await res.json();
    throw json.error;
  }
  await logFromRes(res);
}

export const uChangePassword = async (password, newpassword) => {
  if (!u.connected) return;
  const res = await post('/um/pwchange', { 
    password: hash(password),
    newpassword: hash(newpassword)
  });
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  return true;
}

export const uDeleteAccount = async (password) => {
  if (!u.connected) return;
  const res = await post('/um/delete', { password: hash(password) });
  const json = await res.json();
  if (!is2xx(res)) throw json.error;
  uLogOut();
  return true;
}
