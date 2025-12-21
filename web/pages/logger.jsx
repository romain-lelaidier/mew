import { MetaProvider, Title } from "@solidjs/meta";
import { createSignal, Show } from "solid-js";
import { setU, u, uChangePassword, uDeleteAccount, uSaveParams, uTryLog, uTrySignup, uVerify } from "../components/auth"
import { BackButton, LinkButton } from "../components/utils";
import { useNavigate, useParams } from "@solidjs/router";
import { Layout } from "../components/layout";
import { FlagSelector } from "../components/flag";
import { Popper } from "../components/popper";

export function Field(props) {
  return (
    <div class="block relative">
      <input
        type={props.type} placeholder=" " value={props.sig[0]()} onInput={(e) => props.sig[1](e.target.value)}
        class="w-full border rounded-md px-3 py-2 text-xl outline-none focus:[&+span]:-top-[0.75em] focus:[&+span]:text-sm not-placeholder-shown:[&+span]:-top-[0.75em] not-placeholder-shown:[&+span]:text-sm"/>
      <span class="bg-white block absolute top-2 left-2 px-1 transition-all duration-300 ease text-xl pointer-events-none">{props.title}</span>
    </div>
  )
}

function Wrapper(props) {
  return (
    <Layout floating={true}>

      <MetaProvider>
        <Title>Mew - {props.title}</Title>
      </MetaProvider>

      <div class="flex flex-col gap-1 px-3 pb-1 text-xl">
        <div>
          <BackButton/>
          <h2 class="text-2xl font-bold">{props.title}</h2>
        </div>
        {props.children}
      </div>

    </Layout>
  );
}

export function Signup(props) {
  const navigate = useNavigate();
  const [ uemail, setUemail ] = createSignal('');
  const [ upassword, setUpassword ] = createSignal('');
  const [ uvpassword, setUvpassword ] = createSignal('');
  const [ error, setError ] = createSignal(null);
  const [ success, setSuccess ] = createSignal(false);

  uTryLog().then(logged => {
    if (logged) navigate('/');
  })

  const onsubmit = async (e) => {
    e.preventDefault();
    if (uemail().length == 0) return setError("Email is empty.");
    if (upassword().length == 0) return setError("Password is empty.");
    if (uvpassword().length == 0) return setError("Verification password is empty.");
    if (upassword() != uvpassword()) return setError("Passwords do not match.");

    uTrySignup(uemail(), upassword()).then((message) => {
      setSuccess(message)
    }).catch(setError);
  }

  return (
    <Wrapper title="Sign up">
      <Show when={success()}
        fallback={
          <>
          <form onSubmit={onsubmit} class="mt-2 flex-grow flex flex-col gap-3">
            <Field type="text" title="email" sig={[uemail, setUemail]}/>
            <Field type="password" title="password" sig={[upassword, setUpassword]}/>
            <Field type="password" title="verify password" sig={[uvpassword, setUvpassword]}/>
            <input type="submit" value="Sign up" class="block w-full bg-b text-white px-3 py-2 rounded-md text-xl font-bold"></input>
            <Show when={error()}><span class="text-red-700 text-lg italic">{error()}</span></Show>
          </form>
          <div>already registered ? <LinkButton href="/login">log in here</LinkButton></div>
          </>
        }
      >
        <span>{success()}</span>
      </Show>
    </Wrapper>
  );
}

export function Verify(props) {
  const params = useParams();
  const [ error, setError ] = createSignal(null);
  const [ success, setSuccess ] = createSignal(false);

  uVerify(params.id, params.verificationToken).then(() => {
    setSuccess("Your account was succesfully verified. You are now logged in.");
  }).catch(setError);

  return (
    <Wrapper title="Verify">
      <Show when={success()}
        fallback={<span>Verifying your adress...</span>}      >
        <span>{success()}</span>
      </Show>
      <Show when={error()}><span class="text-red-700 text-lg italic">{error()}</span></Show>
    </Wrapper>
  );
}

export function Login(props) {
  const navigate = useNavigate();
  const [ uemail, setUemail ] = createSignal('');
  const [ upassword, setUpassword ] = createSignal('');
  const [ error, setError ] = createSignal(null);

  const onsubmit = async (e) => {
    e.preventDefault();
    if (uemail().length == 0) return setError("Username is empty");
    if (upassword().length == 0) return setError("Password is empty");
    uTryLog(uemail(), upassword()).then(logged => {
      if (logged) navigate('/');
    }).catch(setError)
  }

  return (
    <Wrapper title="Log in">
      <form onSubmit={onsubmit} class="mt-2 flex-grow flex flex-col gap-3">
        <Field type="text" title="email" sig={[uemail, setUemail]}/>
        <Field type="password" title="password" sig={[upassword, setUpassword]}/>
        <input type="submit" value="Log in" class="block w-full bg-b text-white px-3 py-2 rounded-md text-xl font-bold"></input>
        <Show when={error()}><span class="text-red-700 italic">{error()}</span></Show>
      </form>
      <div>new here ? <LinkButton href="/signup">create an account</LinkButton></div>
    </Wrapper>
  );
}

export function Settings(props) {
  const navigate = useNavigate();
  const [ uname, setUname ] = createSignal(null);
  const [ error, setError ] = createSignal(null);
  const [ iso, setIso ] = createSignal(null);

  const [ pwcTrigger, setPwcTrigger ] = createSignal(null);
  const [ pwcPassword, setPwcPassword ] = createSignal(null);
  const [ pwcNewPassword, setPwcNewPassword ] = createSignal(null);
  const [ pwcError, setPwcError ] = createSignal(null);

  const [ deleteTrigger, setDeleteTrigger ] = createSignal(null);
  const [ password, setPassword ] = createSignal(null);
  const [ deleteError, setDeleteError ] = createSignal(null);

  uTryLog().then(() => {
    setUname(u.name);
    setIso(u.iso);
  })

  function onsubmit(e) {
    e.preventDefault();
    uSaveParams({ name: uname(), iso: iso() }).then(() => {
      setU("params", u.params);
      navigate('/');
    }).catch(setError);
  }

  function onPwc(e) {
    e.preventDefault();
    uChangePassword(pwcPassword(), pwcNewPassword()).then(() => {
      alert("Your password was succesfully changed.");
    }).catch(setPwcError);
  }

  function onDeleteAccount(e) {
    e.preventDefault();
    uDeleteAccount(password()).then(() => {
      alert("Your account was succesfully deleted.");
      navigate('/');
    }).catch(setDeleteError);
  }

  return (
    <Wrapper title="Account settings">
      <Show when={u.connected} fallback={<div><div>You are not connected.</div><div>Please <LinkButton href="/login">log in</LinkButton> or <LinkButton href="/signup">register</LinkButton>.</div></div>}>

        <form onSubmit={onsubmit} class="mt-2 flex-grow flex flex-col gap-3">
          <Field type="text" title="username" sig={[uname, setUname]}/>
          <div class="flex flex-row gap-4 items-center">
            <div class="text-xl">flag</div>
            <FlagSelector iso={iso()} setter={setIso}/>
          </div>
          <input type="submit" value="Save changes" class="block w-full bg-b text-white px-3 py-2 rounded-md text-xl font-bold"></input>
          <input
            type="submit" value="Change password"
            class="block w-full bg-d text-b px-3 py-2 rounded-md text-xl font-bold"
            onClick={event => { event.preventDefault(); setPwcTrigger(true); }}
          ></input>
          <input
            type="submit" value="Delete account"
            class="block w-full bg-red-800 text-white px-3 py-2 rounded-md text-xl font-bold"
            onClick={event => { event.preventDefault(); setDeleteTrigger(true); }}
          ></input>
          <Show when={error()}><span class="text-red-700 italic">{error()}</span></Show>
        </form>

      </Show>

      <Popper sig={[pwcTrigger, setPwcTrigger]} title="Change password">
        <div>Please enter your current and your new password.</div>
        <form onSubmit={onPwc} class="mt-2 flex-grow flex flex-col gap-3">
          <input
            type="password"
            placeholder={"current password"}
            value={pwcPassword()}
            onInput={event => setPwcPassword(event.target.value)}
            class="font-mono w-full bg-white/10 border border-b/50 px-3 py-2 rounded-md transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow"
          />
          <input
            type="password"
            placeholder={"new password"}
            value={pwcNewPassword()}
            onInput={event => setPwcNewPassword(event.target.value)}
            class="font-mono w-full bg-white/10 border border-b/50 px-3 py-2 rounded-md transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow"
          />
          <input
            type="submit" value="Confirm password change"
            class="block w-full bg-b text-white px-3 py-2 rounded-md text-xl font-bold"
          ></input>
          <Show when={pwcError()}><span class="text-red-700 italic">{pwcError()}</span></Show>
        </form>
      </Popper>

      <Popper sig={[deleteTrigger, setDeleteTrigger]} title="Delete account">
        <div>Are you sure that you want to delete your account? All your content will be lost. <b>This action is irreversible.</b></div>
        <form onSubmit={onDeleteAccount} class="mt-2 flex-grow flex flex-col gap-3">
          <input
            type="password"
            placeholder={"password"}
            value={password()}
            onInput={event => setPassword(event.target.value)}
            class="font-mono w-full bg-white/10 border border-b/50 px-3 py-2 rounded-md transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow"
          />
          <input
            type="submit" value="Confirm account deletion"
            class="block w-full bg-red-800 text-white px-3 py-2 rounded-md text-xl font-bold"
          ></input>
          <Show when={deleteError()}><span class="text-red-700 italic">{deleteError()}</span></Show>
        </form>
      </Popper>

    </Wrapper>
  )
}