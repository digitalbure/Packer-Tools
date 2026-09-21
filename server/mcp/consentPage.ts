import fs from "fs";
import path from "path";

function firebaseWebConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
    return { apiKey: c.apiKey, authDomain: c.authDomain, projectId: c.projectId, appId: c.appId };
  } catch {
    return {};
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));
const jsonForScript = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export const consentCsp =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; " +
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com; " +
  "style-src 'unsafe-inline'; img-src data: https:; " +
  "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com; " +
  "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com";

export function renderErrorPage(message: string) {
  return `<!doctype html><meta charset="utf-8"><title>Packer Tools</title><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;background:#0a0a0a;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0"><div style="max-width:420px;padding:24px"><h2>Can't continue</h2><p>${esc(message)}</p></div></body>`;
}

export function renderConsentPage(params: { clientName: string; clientId: string; redirectUri: string; codeChallenge: string; state: string; scope: string }) {
  const cfg = jsonForScript(firebaseWebConfig());
  const p = jsonForScript(params);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Packer Tools</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#eee;margin:0;min-height:100vh;display:grid;place-items:center}
.card{width:min(420px,92vw);background:#161616;border:1px solid #2a2a2a;border-radius:20px;padding:28px}
h1{font-size:20px;margin:0 0 6px}p{color:#aaa;font-size:14px;line-height:1.5}
button{width:100%;padding:12px;border-radius:12px;border:0;font-size:15px;font-weight:600;cursor:pointer;margin-top:10px}
.pri{background:#f27d26;color:#fff}.sec{background:#262626;color:#eee}
input{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #333;background:#0f0f0f;color:#eee;margin-top:8px;font-size:15px}
.err{color:#ff7b6b;font-size:13px;min-height:18px;margin-top:8px}ul{color:#bbb;font-size:13px;padding-left:18px}
</style></head><body><div class="card">
<h1>Connect Packer Tools</h1>
<p><strong id="cname"></strong> is asking to access your Packer Tools account.</p>
<div id="signin">
  <button class="sec" id="google">Continue with Google</button>
  <input id="email" type="email" placeholder="Email" autocomplete="username">
  <input id="pass" type="password" placeholder="Password" autocomplete="current-password">
  <button class="pri" id="emailBtn">Sign in with email</button>
</div>
<div id="consent" hidden>
  <p>Signed in as <strong id="who"></strong></p>
  <p>This will let it, on your behalf:</p>
  <ul><li>View and manage your gear library</li><li>View your packing lists and inventory sheets</li><li>See your plan and usage</li></ul>
  <p>It cannot see your password or payment details. You can revoke access any time.</p>
  <button class="pri" id="allow">Allow</button><button class="sec" id="deny">Cancel</button>
</div>
<div class="err" id="err"></div>
</div>
<script type="application/json" id="cfg">${cfg}</script>
<script type="application/json" id="params">${p}</script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script>
(function(){
  var cfg=JSON.parse(document.getElementById('cfg').textContent), P=JSON.parse(document.getElementById('params').textContent);
  var $=function(i){return document.getElementById(i)}, err=function(m){$('err').textContent=m||''};
  $('cname').textContent=P.clientName;
  firebase.initializeApp(cfg); var auth=firebase.auth(); auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
  function show(u){$('signin').hidden=true;$('consent').hidden=false;$('who').textContent=u.email||u.displayName||u.uid;}
  $('google').onclick=function(){err();auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(function(r){show(r.user)}).catch(function(e){err(e.message)})};
  $('emailBtn').onclick=function(){err();auth.signInWithEmailAndPassword($('email').value,$('pass').value).then(function(r){show(r.user)}).catch(function(e){err('Sign-in failed: '+e.message)})};
  function back(q){var u=new URL(P.redirectUri);for(var k in q){u.searchParams.set(k,q[k])}if(P.state)u.searchParams.set('state',P.state);location.href=u.toString();}
  $('deny').onclick=function(){back({error:'access_denied'})};
  $('allow').onclick=function(){
    err();$('allow').disabled=true;
    auth.currentUser.getIdToken(true).then(function(t){
      return fetch('/oauth/authorize/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:t,client_id:P.clientId,redirect_uri:P.redirectUri,code_challenge:P.codeChallenge,state:P.state,scope:P.scope})});
    }).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error_description||j.error||'Request failed');return j})})
    .then(function(j){location.href=j.redirect}).catch(function(e){$('allow').disabled=false;err(e.message)});
  };
})();
</script></body></html>`;
}
