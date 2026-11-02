"use strict";

// This function is serialized into the nonsensitive entry document. Keep it self-contained.
function bootDashboard(root, viewUrl) {
  const doc = root.document, view = doc.getElementById("dashboard-view"), status = doc.getElementById("dashboard-status"), login = doc.getElementById("dashboard-login"), signIn = doc.getElementById("dashboard-sign-in"), end = doc.getElementById("dashboard-end"), styles = doc.getElementById("dashboard-view-styles");
  let generation = 0, controller, closed = false;
  const visible = () => doc.visibilityState !== "hidden" && root.navigator.onLine !== false;
  function clear(message) {
    generation++; controller?.abort(); controller = null;
    view.replaceChildren(); view.hidden = true; login.hidden = true; end.hidden = true;
    status.textContent = message;
  }
  async function load() {
    clear(closed ? "Dashboard session closed." : "Checking private access…");
    if (closed) { login.hidden = false; return; }
    if (!visible()) { status.textContent = "Private dashboard unavailable offline or while hidden."; return; }
    const own = generation, active = new root.AbortController(); controller = active;
    const timeout = root.setTimeout(() => active.abort(), 5000);
    try {
      const response = await root.fetch(viewUrl, { credentials: "same-origin", cache: "no-store", redirect: "error", signal: active.signal, headers: { "X-NS-Dashboard-Transport": "fetch-v1", Accept: "text/html" } });
      if (own !== generation || !visible()) return;
      if (response.status === 401) { login.hidden = false; status.textContent = "Sign in with the approved Nothing Sport account."; return; }
      if (!response.ok || !/^text\/html\b/.test(response.headers.get("content-type") || "")) throw new Error();
      const html = await response.text();
      if (html.length > 2 * 1024 * 1024) throw new Error();
      if (own !== generation || !visible()) return;
      const parsed = new root.DOMParser().parseFromString(html, "text/html");
      if (parsed.querySelector("script,iframe,object,embed,form")) throw new Error();
      styles.textContent = [...parsed.querySelectorAll("head style")].map(s => s.textContent).join("\n");
      view.replaceChildren(...[...parsed.body.childNodes].map(node => doc.importNode(node, true)));
      view.hidden = false; end.hidden = false; status.textContent = "";
    } catch {
      if (own === generation) clear("Private dashboard unavailable. No offline copy is shown.");
    } finally { root.clearTimeout(timeout); if (controller === active) controller = null; }
  }
  async function closeSession() {
    closed = true; clear("Closing dashboard session…");
    let acknowledged = false;
    try { acknowledged = (await root.fetch("/api/admin/dashboard/session", { method: "DELETE", credentials: "same-origin", cache: "no-store", redirect: "error" })).status === 204; }
    catch {}
    finally { clear(acknowledged ? "Dashboard session closed." : "Private view cleared; reconnect to close the session."); login.hidden = false; }
  }
  signIn.addEventListener("click", async () => {
    signIn.disabled = true; clear("Checking Nothing Sport sign-in…"); const own = generation;
    try {
      const client = root.NOTHINGSPORTS_SERVER_SYNC.createClient(), session = await client.restoreSession(), subject = client.sessionSubject();
      if (!session?.accessToken || own !== generation || !visible()) throw new Error();
      const result = await root.fetch("/api/admin/dashboard/session", { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { Authorization: "Bearer " + session.accessToken } });
      if (!result.ok || client.sessionSubject() !== subject || own !== generation || !visible()) throw new Error();
      closed = false; await load();
    } catch { if (own === generation) { clear("Sign in to Nothing Sport with the approved account, then return here."); login.hidden = false; } }
    finally { signIn.disabled = false; }
  });
  end.addEventListener("click", () => { closeSession().catch(() => {}); });
  root.addEventListener("pagehide", () => clear("Private view cleared."));
  root.addEventListener("pageshow", () => { load().catch(() => {}); });
  root.addEventListener("offline", () => clear("Private dashboard unavailable offline."));
  root.addEventListener("online", () => { if (visible()) load().catch(() => {}); });
  doc.addEventListener("visibilitychange", () => { if (!visible()) clear("Private view cleared."); else load().catch(() => {}); });
  root.addEventListener("storage", event => {
    const api = root.NOTHINGSPORTS_SERVER_SYNC;
    if (event.key === null || event.key === api.PERSISTENT_SESSION_STORAGE_KEY || event.key === api.SESSION_STORAGE_KEY) { clear("Sign-in changed."); if (visible()) load().catch(() => {}); }
  });
  return { load, clear, closeSession };
}
module.exports = { bootDashboard };
