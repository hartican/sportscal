(function(root, factory){
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_CHAT_MEDIA_UI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const GIPHY_API_ORIGIN = "https://api.giphy.com";
  const GIPHY_SEARCH_PATH = "/v1/gifs/search";
  const GIPHY_TRENDING_PATH = "/v1/gifs/trending";
  const GIPHY_REQUEST_TIMEOUT_MS = 10_000;
  const GIPHY_QUERY_MAX_CODE_POINTS = 100;
  const GIPHY_OFFSET_MAX = 4_800;

  function trustedGiphyUrl(value){
    try{
      const url = new URL(String(value || ""));
      return url.href.length <= 4096
        && url.protocol === "https:"
        && /(^|\.)giphy\.(?:com|net)$/i.test(url.hostname)
        ? url.href
        : "";
    }catch(_error){
      return "";
    }
  }

  function normalizedGifAnalytics(value){
    const analytics = {};
    for (const action of ["onload", "onclick", "onsent"]){
      const url = trustedGiphyUrl(value?.[action]?.url);
      if (url) analytics[action] = { url };
    }
    return Object.keys(analytics).length ? analytics : null;
  }

  function normalizedGiphyItem(item){
    const images = item?.images || {};
    const preview = images.fixed_width_small || images.fixed_width || images.fixed_height_small || images.fixed_height;
    const content = images.original || images.downsized || images.fixed_width || images.fixed_height;
    const gifId = String(item?.id || "").trim().slice(0, 200);
    const previewUrl = trustedGiphyUrl(preview?.url);
    const contentUrl = trustedGiphyUrl(content?.url);
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(gifId) || !previewUrl || !contentUrl) return null;
    return {
      provider:"giphy",
      gifId,
      title:String(item?.title || "GIF").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 120) || "GIF",
      previewUrl,
      contentUrl,
      width:Math.max(1, Math.min(4096, Number(preview?.width) || 240)),
      height:Math.max(1, Math.min(4096, Number(preview?.height) || 240)),
      sourcePage:trustedGiphyUrl(item?.url) || "https://giphy.com/",
      analytics:normalizedGifAnalytics(item?.analytics),
    };
  }

  function giphyRequestUrl(config, query = "", offset = 0){
    const q = String(query || "").normalize("NFC").trim();
    if (Array.from(q).length > GIPHY_QUERY_MAX_CODE_POINTS) throw new Error("GIF searches may contain at most 100 characters.");
    const requestedOffset = Number(offset);
    if (!Number.isSafeInteger(requestedOffset) || requestedOffset < 0 || requestedOffset > GIPHY_OFFSET_MAX){
      throw new Error("That GIF result page is unavailable.");
    }
    let endpoint;
    try{
      endpoint = new URL(q ? config?.searchEndpoint : config?.trendingEndpoint);
    }catch(_error){
      throw new Error("GIFs are unavailable right now.");
    }
    const expectedPath = q ? GIPHY_SEARCH_PATH : GIPHY_TRENDING_PATH;
    if (endpoint.origin !== GIPHY_API_ORIGIN || endpoint.pathname !== expectedPath){
      throw new Error("GIFs are unavailable right now.");
    }
    const apiKey = String(config?.apiKey || "").trim();
    if (!apiKey) throw new Error("GIFs are unavailable right now.");
    endpoint.search = new URLSearchParams({
      api_key:apiKey,
      limit:String(Math.max(1, Math.min(50, Number(config?.limit) || 24))),
      offset:String(requestedOffset),
      rating:String(config?.rating || "pg-13"),
      country_code:String(config?.countryCode || "AU"),
      bundle:String(config?.bundle || "messaging_non_clips"),
      remove_low_contrast:String(config?.removeLowContrast !== false),
      ...(q ? { q, lang:String(config?.language || "en") } : {}),
    }).toString();
    return endpoint;
  }

  async function searchGiphyClient(config, {
    query = "", offset = 0, signal, fetchImpl = fetch, timeoutMs = GIPHY_REQUEST_TIMEOUT_MS,
  } = {}){
    const url = giphyRequestUrl(config, query, offset);
    const timeoutController = new AbortController();
    let timedOut = false;
    const boundedTimeoutMs = Math.max(1, Math.min(GIPHY_REQUEST_TIMEOUT_MS, Number(timeoutMs) || GIPHY_REQUEST_TIMEOUT_MS));
    const timer = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, boundedTimeoutMs);
    const forwardAbort = () => timeoutController.abort();
    signal?.addEventListener?.("abort", forwardAbort, { once:true });
    try{
      const response = await fetchImpl(url, {
        method:"GET",
        credentials:"omit",
        referrerPolicy:"strict-origin-when-cross-origin",
        signal:timeoutController.signal,
      });
      if (!response.ok) throw new Error("GIFs are unavailable right now.");
      const payload = await response.json();
      const items = Array.isArray(payload?.data) ? payload.data.map(normalizedGiphyItem).filter(Boolean) : [];
      const count = Math.max(0, Number(payload?.pagination?.count) || items.length);
      const total = Math.max(0, Number(payload?.pagination?.total_count) || 0);
      const nextOffset = Number(offset) + count;
      return {
        items,
        pagination:{ nextOffset, hasMore:total ? nextOffset < total : count >= Math.max(1, Number(config?.limit) || 24) },
      };
    }catch(error){
      if (signal?.aborted) throw error;
      if (timedOut) throw new Error("GIFs are taking too long. Try again.");
      throw error?.message ? error : new Error("GIFs are unavailable right now.");
    }finally{
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", forwardAbort);
    }
  }

  function install(context){
    const media = context.media;
    const state = () => context.state();
    const stylesReady = (() => {
      const existing = document.querySelector('link[data-chat-media-styles]');
      if (existing) return Promise.resolve();
      return new Promise(resolve => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "config/chat-media-ui.css?v=223";
        link.dataset.chatMediaStyles = "true";
        link.addEventListener("load", resolve, { once:true });
        link.addEventListener("error", resolve, { once:true });
        document.head.appendChild(link);
      });
    })();
    let searchTimer = null;
    let searchController = null;
    let searchSequence = 0;
    let gifOffset = 0;
    let gifQuery = "";
    let gifProviderConfig = null;

    async function prepareStaticImage(file){
      if (!media.shouldCompress(file.type)) return file;
      const bitmap = await createImageBitmap(file);
      const dimensions = media.targetDimensions(bitmap.width, bitmap.height);
      const plan = media.outputPlan(file.type, { fileName:file.name });
      let blob;
      if (typeof OffscreenCanvas === "function"){
        const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
        canvas.getContext("2d", { alpha:plan.preserveAlpha }).drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
        blob = await canvas.convertToBlob({ type:plan.contentType, quality:plan.quality });
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        canvas.getContext("2d", { alpha:plan.preserveAlpha }).drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
        blob = await new Promise(resolve => canvas.toBlob(resolve, plan.contentType, plan.quality));
      }
      bitmap.close?.();
      if (!blob) throw new Error("That image could not be prepared.");
      const stem = String(file.name || "game-photo").replace(/\.[^.]+$/, "");
      return new File([blob], `${stem}${plan.extension}`, { type:plan.contentType, lastModified:Date.now() });
    }

    function stageText(item){
      if (item.status === "preparing") return "Preparing…";
      if (item.status === "uploading") return `Uploading ${Math.max(0, Math.min(100, Math.round(item.progress || 0)))}%`;
      if (item.status === "ready") return "Ready — tap Send";
      if (item.status === "sending") return "Sending…";
      if (item.status === "sent") return "Sent";
      if (item.status === "failed") return item.error || "Could not prepare or upload";
      return "Preparing…";
    }

    function byClientId(clientAttachmentId){
      return state().pendingAttachments.find(item => item.clientAttachmentId === clientAttachmentId) || null;
    }

    function remove(clientAttachmentId){
      const item = byClientId(clientAttachmentId);
      if (item?.url?.startsWith?.("blob:")) URL.revokeObjectURL(item.url);
      state().pendingAttachments = state().pendingAttachments.filter(entry => entry.clientAttachmentId !== clientAttachmentId);
      refreshPreviews();
    }

    function preview(item){
      const element = document.createElement("article");
      element.className = "chat-attachment-preview";
      element.dataset.clientAttachmentId = item.clientAttachmentId;
      if (item.kind === "image" || item.kind === "gif" || String(item.contentType || "").startsWith("image/")){
        const image = document.createElement("img");
        image.src = item.url || "";
        image.alt = item.fileName || "Attachment preview";
        image.width = 64;
        image.height = 58;
        element.appendChild(image);
      } else {
        const glyph = document.createElement("span");
        glyph.className = "chat-staple";
        glyph.textContent = "📎";
        element.appendChild(glyph);
      }
      const copy = document.createElement("span");
      copy.className = "chat-attachment-preview-copy";
      const name = document.createElement("strong");
      name.textContent = item.fileName || "Attachment";
      const stage = document.createElement("span");
      stage.textContent = stageText(item);
      copy.append(name, stage);
      const actions = document.createElement("span");
      actions.className = "chat-attachment-preview-actions";
      if (item.status === "failed"){
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Retry";
        retry.addEventListener("click", () => { void retry(item); });
        actions.appendChild(retry);
      }
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${item.fileName || "attachment"}`);
      removeButton.addEventListener("click", () => remove(item.clientAttachmentId));
      actions.appendChild(removeButton);
      element.append(copy, actions);
      return element;
    }

    function refreshPreviews(){
      const previews = document.querySelector("#chatRoomComposer .chat-attachment-previews");
      if (!previews) return;
      previews.replaceChildren(...state().pendingAttachments.map(preview));
      const send = document.querySelector('#chatRoomComposer [type="submit"]');
      if (send) send.disabled = state().pendingAttachments.some(item => item.status !== "ready");
    }

    function uploadWithProgress(url, file, onProgress){
      if (typeof XMLHttpRequest !== "function") return fetch(url, {
        method:"PUT", headers:{ "Content-Type":file.type }, body:file,
      }).then(response => {
        if (!response.ok) throw new Error("The attachment upload did not complete.");
        onProgress(100);
      });
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", url, true);
        request.setRequestHeader("Content-Type", file.type);
        request.upload.addEventListener("progress", event => {
          if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
        });
        request.addEventListener("load", () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("The attachment upload did not complete.")));
        request.addEventListener("error", () => reject(new Error("The attachment upload did not complete.")));
        request.addEventListener("abort", () => reject(new Error("The attachment upload was cancelled.")));
        request.send(file);
      });
    }

    async function prepareAndUpload(item){
      const room = state().currentRoom;
      if (!room?.viewer?.canPost || !item.sourceFile) return;
      try{
        Object.assign(item, { status:"preparing", progress:0, error:"" });
        refreshPreviews();
        const upload = await prepareStaticImage(item.sourceFile);
        if (!byClientId(item.clientAttachmentId)) return;
        if (upload.type === "image/gif" && !state().capabilities.canUseGifs){
          throw new Error(`Earn 25 NSC points to upload and send GIFs. You have ${state().capabilities.lifetimeNscPoints || 0}.`);
        }
        if (item.url?.startsWith?.("blob:")) URL.revokeObjectURL(item.url);
        Object.assign(item, {
          fileName:upload.name,
          contentType:upload.type,
          byteSize:upload.size,
          kind:upload.type === "image/gif" ? "gif" : upload.type.startsWith("image/") ? "image" : item.kind,
          url:URL.createObjectURL(upload),
          preparedFile:upload,
        });
        const prepared = await context.request({}, {
          action:"attachment-upload-url", roomId:room.roomId, fileName:upload.name,
          contentType:upload.type || "application/octet-stream", byteSize:upload.size,
        });
        Object.assign(item, { attachmentId:prepared.attachment.attachmentId, status:"uploading" });
        refreshPreviews();
        await uploadWithProgress(prepared.attachment.uploadUrl, upload, progress => {
          item.progress = progress;
          const stage = document.querySelector(`[data-client-attachment-id="${CSS.escape(item.clientAttachmentId)}"] .chat-attachment-preview-copy span`);
          if (stage) stage.textContent = stageText(item);
        });
        await context.request({}, { action:"attachment-complete", attachmentId:item.attachmentId });
        Object.assign(item, { status:"ready", progress:100, sourceFile:null, preparedFile:null });
      }catch(error){
        Object.assign(item, { status:"failed", error:error.message || "That attachment could not be prepared or uploaded." });
      }
      refreshPreviews();
    }

    async function upload(file, { selfie = false } = {}){
      const current = state();
      if (!current.currentRoom?.viewer?.canPost || current.pendingAttachments.length >= 4) return;
      const item = {
        clientAttachmentId:crypto.randomUUID?.() || `attachment_${Date.now()}_${Math.random()}`,
        attachmentId:null, sourceFile:file, preparedFile:null,
        kind:file.type === "image/gif" ? "gif" : file.type.startsWith("image/") ? "image" : "file",
        fileName:selfie ? `game-selfie-${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}` : file.name,
        contentType:file.type || "application/octet-stream", byteSize:file.size,
        url:URL.createObjectURL(file), own:true, status:"preparing", progress:0, selfie:Boolean(selfie),
      };
      current.pendingAttachments.push(item);
      refreshPreviews();
      await prepareAndUpload(item);
    }

    async function retry(item){
      if (item.sourceGif){
        return referenceGif(item, item.sourceGif);
      }
      return prepareAndUpload(item);
    }

    async function choose(input, options = {}){
      const files = [...(input.files || [])].slice(0, 4 - state().pendingAttachments.length);
      input.value = "";
      await Promise.allSettled(files.map(file => upload(file, options)));
    }

    function closePicker(){
      clearTimeout(searchTimer);
      searchController?.abort?.();
      searchController = null;
      const picker = document.getElementById("chatGifPicker");
      if (!picker) return;
      picker.classList.remove("show");
      picker.setAttribute("aria-hidden", "true");
      document.getElementById("chatGifResults")?.replaceChildren();
      document.getElementById("chatGifSearchInput").value = "";
      document.getElementById("chatGifPickerStatus").textContent = "Trending reactions and sports memes.";
      document.querySelector('#chatRoomComposer [data-chat-gif-trigger]')?.focus?.({ preventScroll:true });
    }

    async function openPicker(){
      if (!state().capabilities.canUseGifs){
        context.connection(`Earn 25 NSC points to use GIFs. You have ${state().capabilities.lifetimeNscPoints || 0}.`, "retrying");
        return;
      }
      const picker = document.getElementById("chatGifPicker");
      picker.classList.add("show");
      picker.setAttribute("aria-hidden", "false");
      document.getElementById("closeChatGifPickerBtn").focus({ preventScroll:true });
      await search("");
    }

    function registerGifAction(gif, action){
      const url = gif?.analytics?.[action]?.url;
      if (!url) return;
      void fetch(url, { mode:"no-cors", keepalive:true }).catch(() => {});
    }

    async function loadGifProviderConfig(){
      if (gifProviderConfig) return gifProviderConfig;
      const payload = await context.request({ mode:"gif-config" });
      if (payload?.provider !== "giphy" || !payload?.clientConfig){
        throw new Error("GIFs are unavailable right now.");
      }
      gifProviderConfig = payload.clientConfig;
      return gifProviderConfig;
    }

    async function referenceGif(item, gif){
      const room = state().currentRoom;
      if (!room?.viewer?.canPost) return;
      Object.assign(item, { status:"preparing", error:"" });
      refreshPreviews();
      try{
        const payload = await context.request({}, {
          action:"gif-reference",
          roomId:room.roomId,
          gif:{
            gifId:gif.gifId,
            title:gif.title,
            contentUrl:gif.contentUrl,
            previewUrl:gif.previewUrl,
            width:gif.width,
            height:gif.height,
            sourcePage:gif.sourcePage,
            analytics:gif.analytics,
          },
        });
        Object.assign(item, payload.attachment, {
          clientAttachmentId:item.clientAttachmentId,
          url:payload.attachment.url || gif.contentUrl,
          status:"ready", progress:100,
          sourceProvider:"giphy", sourceGifId:gif.gifId, sourceGif:gif, sourceFile:null,
        });
      }catch(error){
        Object.assign(item, { status:"failed", error:error.message || "That GIF could not be added." });
      }
      refreshPreviews();
    }

    function selectGif(gif){
      const current = state();
      if (current.pendingAttachments.length >= 4) return;
      const item = {
        clientAttachmentId:crypto.randomUUID?.() || `gif_${Date.now()}_${Math.random()}`,
        attachmentId:null, kind:"gif", fileName:gif.title || "GIF", contentType:"image/gif",
        byteSize:0, url:gif.previewUrl, own:true, status:"preparing",
        sourceProvider:"giphy", sourceGifId:gif.gifId, sourceGif:gif,
      };
      current.pendingAttachments.push(item);
      item.providerAnalytics = gif.analytics || null;
      registerGifAction(gif, "onclick");
      closePicker();
      refreshPreviews();
      void referenceGif(item, gif);
    }

    async function search(query, { append = false } = {}){
      const q = String(query || "").trim();
      const results = document.getElementById("chatGifResults");
      const status = document.getElementById("chatGifPickerStatus");
      if (q.length === 1){
        results.replaceChildren();
        status.textContent = "Enter at least two characters.";
        return;
      }
      searchController?.abort?.();
      const controller = new AbortController();
      searchController = controller;
      const sequence = ++searchSequence;
      status.textContent = q ? "Searching GIFs…" : "Loading trending GIFs…";
      if (!append) results.replaceChildren();
      try{
        if (!append){ gifOffset = 0; gifQuery = q; }
        const providerPayload = await searchGiphyClient(await loadGifProviderConfig(), {
          query:q,
          offset:gifOffset,
          signal:controller.signal,
        });
        const gifs = providerPayload.items || [];
        if (controller.signal.aborted || sequence !== searchSequence) return;
        if (!gifs.length){
          status.textContent = append ? "That’s everything." : "No GIFs found. Try another search.";
          return;
        }
        status.textContent = q ? `${gifs.length} reactions found.` : "Trending reactions";
        gifs.forEach(gif => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "chat-gif-result";
          const image = document.createElement("img");
          image.src = gif.previewUrl;
          image.alt = gif.title;
          image.width = gif.width || 240;
          image.height = gif.height || 240;
          button.appendChild(image);
          button.addEventListener("click", () => selectGif(gif));
          results.appendChild(button);
          registerGifAction(gif, "onload");
        });
        gifOffset = Number(providerPayload.pagination?.nextOffset) || (gifOffset + gifs.length);
        if (providerPayload.pagination?.hasMore){
          const more = document.createElement("button");
          more.type = "button";
          more.className = "btn ghost chat-gif-more";
          more.textContent = "Load more";
          more.addEventListener("click", () => { more.remove(); void search(gifQuery, { append:true }); });
          results.appendChild(more);
        }
      }catch(error){
        if (error?.name !== "AbortError"){
          const message = document.createElement("span");
          message.textContent = error.message || "GIFs are unavailable right now.";
          const retryButton = document.createElement("button");
          retryButton.type = "button";
          retryButton.className = "btn ghost";
          retryButton.textContent = "Retry";
          retryButton.addEventListener("click", () => { void search(q, { append }); });
          status.replaceChildren(message, document.createTextNode(" "), retryButton);
        }
      }
    }

    function scheduleSearch(value){
      clearTimeout(searchTimer);
      if (String(value || "").trim().length < 2) return;
      searchTimer = setTimeout(() => { void search(value); }, 300);
    }

    function ensurePicker(){
      if (document.getElementById("chatGifPicker")) return;
      const picker = document.createElement("section");
      picker.className = "chat-gif-picker";
      picker.id = "chatGifPicker";
      picker.setAttribute("role", "dialog");
      picker.setAttribute("aria-modal", "true");
      picker.setAttribute("aria-labelledby", "chatGifPickerTitle");
      picker.setAttribute("aria-hidden", "true");
      picker.innerHTML = '<header class="chat-gif-picker-head"><button class="btn ghost" id="closeChatGifPickerBtn" type="button" aria-label="Back to chat">Back</button><h2 id="chatGifPickerTitle">Add a GIF</h2></header><div class="chat-gif-picker-search"><input id="chatGifSearchInput" type="search" inputmode="search" autocomplete="off" placeholder="Search reactions and memes" aria-label="Search GIFs"><button class="btn primary" id="chatGifSearchBtn" type="button">Search</button></div><div class="chat-gif-prompts" aria-label="GIF suggestions"><button type="button">Big win</button><button type="button">No way</button><button type="button">Banter</button><button type="button">Disaster</button><button type="button">Clutch</button><button type="button">Celebration</button></div><p class="chat-gif-picker-status" id="chatGifPickerStatus" role="status" aria-live="polite">Trending reactions and sports memes.</p><div class="chat-gif-results" id="chatGifResults"></div><a class="chat-gif-attribution" href="https://giphy.com/" target="_blank" rel="noopener noreferrer">Powered by GIPHY</a>';
      document.body.appendChild(picker);
      picker.querySelector("#closeChatGifPickerBtn").addEventListener("click", closePicker);
      picker.querySelector("#chatGifSearchBtn").addEventListener("click", () => { void search(picker.querySelector("#chatGifSearchInput").value); });
      picker.querySelector("#chatGifSearchInput").addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.isComposing) return;
        event.preventDefault();
        void search(event.currentTarget.value);
      });
      picker.querySelector("#chatGifSearchInput").addEventListener("input", event => scheduleSearch(event.currentTarget.value));
      picker.querySelectorAll(".chat-gif-prompts button").forEach(button => button.addEventListener("click", () => {
        picker.querySelector("#chatGifSearchInput").value = button.textContent;
        void search(button.textContent);
      }));
    }

    ensurePicker();

    return Object.freeze({
      stylesReady,
      MAX_STATIC_IMAGE_EDGE:media.MAX_STATIC_IMAGE_EDGE,
      prepareStaticImage, stageText, preview, refreshPreviews, upload, choose,
      closePicker, openPicker, search, scheduleSearch,
      notifyGifSent(items){ (items || []).filter(item => item.providerAnalytics).forEach(item => registerGifAction({ analytics:item.providerAnalytics }, "onsent")); },
    });
  }

  return Object.freeze({
    GIPHY_REQUEST_TIMEOUT_MS,
    giphyRequestUrl,
    install,
    normalizedGiphyItem,
    searchGiphyClient,
    trustedGiphyUrl,
  });
});
