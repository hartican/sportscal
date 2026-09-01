(function(root, factory){
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_CHAT_MEDIA_UI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  function install(context){
    const media = context.media;
    const state = () => context.state();
    const stylesReady = (() => {
      const existing = document.querySelector('link[data-chat-media-styles]');
      if (existing) return Promise.resolve();
      return new Promise(resolve => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "config/chat-media-ui.css?v=214";
        link.dataset.chatMediaStyles = "true";
        link.addEventListener("load", resolve, { once:true });
        link.addEventListener("error", resolve, { once:true });
        document.head.appendChild(link);
      });
    })();
    let searchTimer = null;
    let searchController = null;
    let searchSequence = 0;

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
      if (item.sourceProvider && item.sourceGifId){
        return importGif(item, { provider:item.sourceProvider, gifId:item.sourceGifId, previewUrl:item.url, title:item.fileName });
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
      document.getElementById("chatGifPickerStatus").textContent = "Tap the search field and enter at least two characters.";
      document.querySelector('#chatRoomComposer [data-chat-gif-trigger]')?.focus?.({ preventScroll:true });
    }

    function openPicker(){
      if (!state().capabilities.canUseGifs){
        context.connection(`Earn 25 NSC points to use GIFs. You have ${state().capabilities.lifetimeNscPoints || 0}.`, "retrying");
        return;
      }
      const picker = document.getElementById("chatGifPicker");
      picker.classList.add("show");
      picker.setAttribute("aria-hidden", "false");
      document.getElementById("closeChatGifPickerBtn").focus({ preventScroll:true });
    }

    async function importGif(item, gif){
      const room = state().currentRoom;
      if (!room?.viewer?.canPost) return;
      Object.assign(item, { status:"preparing", error:"" });
      refreshPreviews();
      try{
        const payload = await context.request({}, {
          action:"gif-import", roomId:room.roomId, provider:gif.provider, gifId:gif.gifId,
        });
        Object.assign(item, payload.attachment, {
          clientAttachmentId:item.clientAttachmentId,
          url:payload.attachment.url || gif.previewUrl,
          status:"ready", progress:100,
          sourceProvider:gif.provider, sourceGifId:gif.gifId, sourceFile:null,
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
        sourceProvider:gif.provider, sourceGifId:gif.gifId,
      };
      current.pendingAttachments.push(item);
      closePicker();
      refreshPreviews();
      void importGif(item, gif);
    }

    async function search(query){
      const q = String(query || "").trim();
      const results = document.getElementById("chatGifResults");
      const status = document.getElementById("chatGifPickerStatus");
      if (q.length < 2){
        results.replaceChildren();
        status.textContent = "Enter at least two characters.";
        return;
      }
      searchController?.abort?.();
      const controller = new AbortController();
      searchController = controller;
      const sequence = ++searchSequence;
      status.textContent = "Searching GIFs…";
      results.replaceChildren();
      try{
        const payload = await context.request({ mode:"gif-search", q }, null, { signal:controller.signal });
        if (controller.signal.aborted || sequence !== searchSequence) return;
        if (!(payload.gifs || []).length){
          status.textContent = "No GIFs found. Try another search.";
          return;
        }
        status.textContent = `${payload.gifs.length} GIFs found.`;
        payload.gifs.forEach(gif => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "chat-gif-result";
          const image = document.createElement("img");
          image.src = gif.previewUrl;
          image.alt = gif.title;
          image.width = 240;
          image.height = 240;
          button.appendChild(image);
          button.addEventListener("click", () => selectGif(gif));
          results.appendChild(button);
        });
        const attribution = document.createElement("a");
        attribution.className = "chat-gif-attribution";
        attribution.href = payload.attributionUrl || "https://commons.wikimedia.org/";
        attribution.target = "_blank";
        attribution.rel = "noopener noreferrer";
        attribution.textContent = payload.attribution || "GIF library";
        results.appendChild(attribution);
      }catch(error){
        if (error?.name !== "AbortError") status.textContent = error.message || "GIF search is unavailable. Tap Search to retry.";
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
      picker.innerHTML = '<header class="chat-gif-picker-head"><button class="btn ghost" id="closeChatGifPickerBtn" type="button" aria-label="Back to chat">Back</button><h2 id="chatGifPickerTitle">Add a GIF</h2></header><div class="chat-gif-picker-search"><input id="chatGifSearchInput" type="search" inputmode="search" autocomplete="off" placeholder="Search GIFs" aria-label="Search GIFs"><button class="btn primary" id="chatGifSearchBtn" type="button">Search</button></div><p class="chat-gif-picker-status" id="chatGifPickerStatus" role="status" aria-live="polite">Tap the search field and enter at least two characters.</p><div class="chat-gif-results" id="chatGifResults"></div>';
      document.body.appendChild(picker);
      picker.querySelector("#closeChatGifPickerBtn").addEventListener("click", closePicker);
      picker.querySelector("#chatGifSearchBtn").addEventListener("click", () => { void search(picker.querySelector("#chatGifSearchInput").value); });
      picker.querySelector("#chatGifSearchInput").addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.isComposing) return;
        event.preventDefault();
        void search(event.currentTarget.value);
      });
      picker.querySelector("#chatGifSearchInput").addEventListener("input", event => scheduleSearch(event.currentTarget.value));
    }

    ensurePicker();

    return Object.freeze({
      stylesReady,
      MAX_STATIC_IMAGE_EDGE:media.MAX_STATIC_IMAGE_EDGE,
      prepareStaticImage, stageText, preview, refreshPreviews, upload, choose,
      closePicker, openPicker, search, scheduleSearch,
    });
  }

  return Object.freeze({ install });
});
