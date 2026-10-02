(function attachAdminCommsWorkspace(root, factory) {
  const api = factory();
  root.NOTHINGSPORTS_ADMIN_COMMS_UI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(
  typeof globalThis !== "undefined" ? globalThis : window,
  function buildAdminCommsWorkspace() {
    "use strict";
    const esc = (value) =>
      String(value ?? "").replace(
        /[&<>"']/g,
        (character) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[character],
      );
    const paragraphs = (value) =>
        String(value || "")
          .split(/\n\s*\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 8),
      record = (value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? value
          : {};
    const sydneyDate = (value) =>
      value
        ? new Intl.DateTimeFormat("en-AU", {
            timeZone: "Australia/Sydney",
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          }).format(new Date(value))
        : "Send date pending";
    function countdownLabel(value, now = Date.now()) {
      const target = Date.parse(value || "");
      if (!Number.isFinite(target)) return "Send date pending";
      const delta = target - Number(now),
        absolute = Math.abs(delta),
        days = Math.floor(absolute / 86400000),
        hours = Math.floor((absolute % 86400000) / 3600000),
        minutes = Math.floor((absolute % 3600000) / 60000),
        hourLabel = `${String(hours).padStart(2, "0")}h`,
        amount = days
          ? `${days}d ${hourLabel}`
          : hours
            ? `${hourLabel}${minutes ? ` ${String(minutes).padStart(2, "0")}m` : ""}`
            : `${String(minutes).padStart(2, "0")}m`;
      return delta >= 0 ? `Send in ${amount}` : `Overdue by ${amount}`;
    }
    function localSydney(value) {
      if (!value) return "";
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Australia/Sydney",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
          .formatToParts(new Date(value))
          .map((p) => [p.type, p.value]),
      );
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
    }
    function fromSydney(value) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
        throw Error("Choose a valid Sydney date and time.");
      let time = Date.parse(value + "Z");
      for (let i = 0; i < 3; i++)
        time +=
          Date.parse(value + "Z") -
          Date.parse(localSydney(new Date(time).toISOString()) + "Z");
      return new Date(time).toISOString();
    }
    function compareCampaigns(a, b) {
      const aSend = Date.parse(a.proposed_send_at || ""),
        bSend = Date.parse(b.proposed_send_at || "");
      if (Number.isFinite(aSend) !== Number.isFinite(bSend))
        return Number.isFinite(aSend) ? -1 : 1;
      if (Number.isFinite(aSend) && aSend !== bSend) return aSend - bSend;
      const aFixture =
          Date.parse(
            a.candidate?.timing?.startTimeUtc ||
              a.candidate?.material?.displayDate ||
              "",
          ) || Infinity,
        bFixture =
          Date.parse(
            b.candidate?.timing?.startTimeUtc ||
              b.candidate?.material?.displayDate ||
              "",
          ) || Infinity;
      return (
        aFixture - bFixture ||
        String(a.event_id).localeCompare(String(b.event_id))
      );
    }
    const displayState = (campaign) =>
      campaign.posted_at
        ? "Posted"
        : campaign.state === "cancelled"
          ? "Dismissed"
          : campaign.export_stale
            ? "Handoff superseded"
            : campaign.export_snapshot
              ? "Handoff current"
              : campaign.candidate?.readyForExport === false
                ? "Watching"
                : campaign.late
                  ? "Urgent"
                  : "Ready";
    const heroFor = (campaign, draft = campaign.draft_copy || {}) =>
      draft.live?.hero ||
      draft.email?.image ||
      draft.instagram?.image ||
      campaign.candidate?.assets?.fallbackHero ||
      {};
    const marksFor = (campaign) => {
      const identities = campaign.candidate?.identities || {},
        items = [...(identities.teams || []), identities.code].filter(Boolean);
      return items
        .map(
          (item) =>
            `<span class="campaign-mark" title="${esc(item.label)}"><img src="${esc(item.path || item.publicUrl)}" alt=""><span>${esc(item.label)}</span></span>`,
        )
        .join("");
    };
    function draftFromCard(card, draft) {
      const next = structuredClone(draft || {}),
        value = (name) =>
          card.querySelector(`[data-field="${name}"]`)?.value ?? "",
        checked = (name) =>
          card.querySelector(`[data-field="${name}"]`)?.checked !== false;
      next.email = record(next.email);
      next.instagram = record(next.instagram);
      next.live = record(next.live);
      next.hook = value("hook");
      next.email.subject = value("subject");
      next.email.preheader = value("preheader");
      next.email.headline = value("headline");
      next.email.bodyParagraphs = paragraphs(value("body"));
      next.email.timingLine = value("timing-line");
      next.email.broadcastLine = value("broadcast-line");
      next.email.primaryCta = {
        ...record(next.email.primaryCta),
        label: value("primary-label"),
      };
      const altText = value("alt-text");
      next.email.image = { ...record(next.email.image), altText };
      next.instagram.altText = altText;
      next.instagram.caption = value("caption");
      next.live.headline = value("live-headline");
      next.live.hook = value("live-hook");
      next.live.kicker = value("live-kicker");
      next.live.focalPosition = {
        x: Number(value("focal-x") ?? 50),
        y: Number(value("focal-y") ?? 50),
      };
      next.live.logos = {
        ...record(next.live.logos),
        showCode: checked("show-code"),
        showTeams: checked("show-teams"),
        order: "teams-first",
      };
      return next;
    }
    function completeHandoff(pack) {
      return [
        `EMAIL CONTENT`,
        `Subject: ${pack.subject}`,
        `Preview text: ${pack.previewText}`,
        `Suggested send: ${sydneyDate(pack.suggestedSendAt?.utc)}`,
        `Headline: ${pack.headline}`,
        `Body:\n${(pack.bodyParagraphs || []).join("\n\n")}`,
        pack.timingLine ? `Timing: ${pack.timingLine}` : "",
        pack.broadcastLine ? `Broadcast: ${pack.broadcastLine}` : "",
        `Primary CTA: ${pack.primaryCta?.label || ""}\n${pack.primaryCta?.url || ""}`,
        pack.secondaryCta
          ? `Secondary CTA: ${pack.secondaryCta.label}\n${pack.secondaryCta.url}`
          : "",
        `Hero: ${pack.image?.url || ""}`,
        `Alt text: ${pack.image?.altText || ""}`,
        `Live: ${pack.fixture?.liveUrl || ""}`,
        `Code mark: ${pack.identities?.code?.publicUrl || ""}`,
        ...(pack.identities?.teams || []).map(
          (team) => `${team.label}: ${team.publicUrl || team.path || ""}`,
        ),
        `SOCIAL CONTENT`,
        `Caption:\n${pack.social?.caption || ""}`,
        `Source: ${pack.source?.name || ""}\n${pack.source?.url || ""}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    const socialHandoff = (pack) =>
      [
        `Caption:\n${pack.social?.caption || ""}`,
        `Hero: ${pack.image?.url || ""}`,
        `Alt text: ${pack.social?.altText || pack.image?.altText || ""}`,
        `Fixture: ${pack.primaryCta?.url || ""}`,
        `Live: ${pack.fixture?.liveUrl || ""}`,
      ].join("\n\n");
    async function copy(value, status, label) {
      try {
        await navigator.clipboard.writeText(String(value || ""));
        status.className = "admin-status ok";
        status.textContent = `${label} copied.`;
      } catch (error) {
        status.className = "admin-status error";
        status.textContent = `Could not copy ${label.toLowerCase()}: ${error.message}`;
      }
    }
    async function deferredCopy(valuePromise, status, label) {
      try {
        if (
          typeof ClipboardItem !== "undefined" &&
          navigator.clipboard?.write
        ) {
          const textPromise = Promise.resolve(valuePromise).then(
            (text) => new Blob([text], { type: "text/plain" }),
          );
          // Start clipboard access inside the tap, keeping Safari's gesture across the saved snapshot request.
          await navigator.clipboard.write([
            new ClipboardItem({ "text/plain": textPromise }),
          ]);
          status.className = "admin-status ok";
          status.textContent = label + " copied.";
        } else await copy(await valuePromise, status, label);
      } catch (error) {
        status.className = "admin-status error";
        status.textContent = error.message;
      }
    }
    const saveBlob = (name, blob) => {
      const link = document.createElement("a"),
        url = URL.createObjectURL(blob);
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    function compactRow(campaign) {
      const candidate = campaign.candidate || {},
        material = candidate.material || {},
        hero = heroFor(campaign),
        state = displayState(campaign),
        freshness = campaign.export_snapshot
          ? campaign.export_stale
            ? "Superseded handoff"
            : `Handoff r${campaign.export_snapshot.campaignRevision || campaign.campaign_revision}`
          : "No handoff yet";
      return `<div class="campaign-summary"><label class="campaign-check" title="Select campaign"><input type="checkbox" data-select aria-label="Select ${esc(material.recognisableTitle || material.title || "campaign")}"></label><button class="campaign-open" data-open aria-expanded="false"><span class="campaign-date"><strong data-countdown data-send-at="${esc(campaign.snoozed_until || campaign.proposed_send_at || "")}">${esc(campaign.posted_at ? "Posted" : countdownLabel(campaign.snoozed_until || campaign.proposed_send_at))}</strong><small>${esc(sydneyDate(campaign.proposed_send_at))}${candidate.posting?.estimated ? " · estimated" : ""}</small></span><span class="campaign-thumb">${hero.path || hero.publicUrl ? `<img loading="lazy" decoding="async" src="${esc(hero.path || hero.publicUrl)}" alt="">` : '<img loading="lazy" decoding="async" src="/assets/brand/web/nothingsport-app-icon.png" alt="">'}</span><span class="campaign-summary-main"><span class="campaign-marks">${marksFor(campaign)}</span><strong class="campaign-title">${esc(material.recognisableTitle || material.title || "Untitled campaign")}</strong><small>${esc(candidate.posting?.kind === "preview" ? "72h preview" : "Day-of")}${candidate.posting?.mergedPreview ? " · preview merged" : ""} · ${esc(material.rating?.label || "Editorial stakes")}</small></span><span class="campaign-summary-state"><span data-summary-state class="badge state-${esc(state.toLowerCase().replaceAll(" ", "-"))}">${esc(state)}</span><small><span data-summary-revision>r${esc(campaign.campaign_revision)}</span> · <span data-summary-freshness>${esc(freshness)}</span></small></span><span class="campaign-chevron" aria-hidden="true">⌄</span></button></div>`;
    }
    function contentPanel(draft) {
      const email = draft.email || {},
        instagram = draft.instagram || {},
        image = email.image || instagram.image || {};
      return `<section class="campaign-panel" data-panel="content"><div class="admin-grid"><label>Subject<input data-field="subject" value="${esc(email.subject)}"></label><label>Preview text<input data-field="preheader" value="${esc(email.preheader)}"></label><label class="wide">Headline<input data-field="headline" value="${esc(email.headline)}"></label><label class="wide">Email body<textarea data-field="body" rows="7">${esc((email.bodyParagraphs || []).join("\n\n"))}</textarea></label><label>Timing line<input data-field="timing-line" value="${esc(email.timingLine)}"></label><label>Broadcast line<input data-field="broadcast-line" value="${esc(email.broadcastLine)}"></label><label>Primary CTA label<input data-field="primary-label" value="${esc(email.primaryCta?.label || "Open the fixture")}"></label><label>Image alt text<input data-field="alt-text" value="${esc(image.altText || instagram.altText)}"></label><label class="wide">Social caption · publishing platform<textarea data-field="caption" rows="5">${esc(instagram.caption)}</textarea></label></div></section>`;
    }
    function mediaPanel(campaign, draft, assets) {
      const hero = heroFor(campaign, draft),
        candidate = campaign.candidate || {},
        approved = assets.filter(
          (asset) =>
            !asset.campaignId || asset.campaignId === campaign.campaign_id,
        );
      return `<section class="campaign-panel hidden" data-panel="media"><div class="media-current"><img loading="lazy" decoding="async" src="${esc(hero.path || hero.publicUrl || "/assets/brand/web/nothingsport-logo.png")}" alt="${esc(hero.altText || "")}"><div><strong>Selected hero</strong><p>${esc(hero.credit || hero.source?.name || "First-party Nothing Sport fallback")}</p><code>${esc(hero.publicUrl || hero.path || "")}</code></div></div><div class="asset-grid">${approved.map((asset) => `<button class="asset-choice" data-asset-id="${esc(asset.assetId)}"><img loading="lazy" decoding="async" src="${esc(asset.publicUrls?.portrait || asset.publicUrls?.original)}" alt=""><span>${esc(asset.altText)}</span><small>${esc(asset.credit)} · ${esc(asset.rightsStatus)}</small></button>`).join("") || '<p class="muted">No approved editorial uploads yet. The first-party text/logo hero remains active.</p>'}</div><details class="asset-upload"><summary>Upload approved media</summary><div class="admin-grid"><label class="wide">Original<input type="file" data-asset="file" accept="image/jpeg,image/png,image/webp"></label><label>Source URL<input data-asset="source-url" type="url" placeholder="https://official-source.example/asset"></label><label>Source label<input data-asset="source-label" placeholder="Official media library"></label><label>Credit<input data-asset="credit" placeholder="Photographer / organisation"></label><label>Rights status<select data-asset="rights"><option value="official_press">Official press</option><option value="owned">Owned</option><option value="licensed">Licensed</option><option value="open_use">Open use</option></select></label><label class="wide">Permission basis<textarea data-asset="permission" rows="2" placeholder="Press-use terms, licence or internal ownership record"></textarea></label><label class="wide">Alt text<input data-asset="alt" value="${esc(hero.altText || candidate.drafts?.instagram?.altText || "")}"></label><button type="button" data-upload-asset>Upload and create derivatives</button></div><p class="admin-status" data-upload-status></p></details><div class="permalink-list"><strong>Stable asset permalinks</strong><button data-copy-permalink="${esc(hero.publicUrl || hero.path || "")}">Copy hero permalink</button>${candidate.identities?.code ? `<button data-copy-permalink="${esc(candidate.identities.code.publicUrl || candidate.identities.code.path)}">Copy code-logo permalink</button>` : ""}${(candidate.identities?.teams || []).map((team) => `<button data-copy-permalink="${esc(team.publicUrl || team.path)}">Copy ${esc(team.label)} permalink</button>`).join("")}</div></section>`;
    }
    function livePanel(campaign, draft) {
      const live = draft.live || {},
        candidate = campaign.candidate || {};
      return `<section class="campaign-panel hidden" data-panel="live"><div class="live-editor"><div class="admin-grid"><label class="wide">Live headline<input data-field="live-headline" value="${esc(live.headline || draft.email?.headline)}"></label><label class="wide">Hook<textarea data-field="live-hook" rows="3">${esc(live.hook || draft.hook)}</textarea></label><label>Kicker<input data-field="live-kicker" value="${esc(live.kicker || `${candidate.material?.rating?.label || "Editorial stakes"} · ${candidate.material?.sport || "Sport"}`)}"></label><p class="muted">Animation: ${esc(candidate.material?.rating?.animationPreset || "subtle")} · Energy requires a real pre-match average above 4.8/5. Teams always appear first.</p><label>Focal X · photo crop<input data-field="focal-x" ${live.hero?.firstPartyAssetsOnly ? "disabled" : ""} type="range" min="0" max="100" value="${esc(live.focalPosition?.x ?? 50)}"></label><label>Focal Y · photo crop<input data-field="focal-y" ${live.hero?.firstPartyAssetsOnly ? "disabled" : ""} type="range" min="0" max="100" value="${esc(live.focalPosition?.y ?? 50)}"></label><label class="check-line"><input data-field="show-code" type="checkbox" ${live.logos?.showCode !== false ? "checked" : ""}> Show code mark</label><label class="check-line"><input data-field="show-teams" type="checkbox" ${live.logos?.showTeams !== false ? "checked" : ""}> Show team marks</label></div><div><p class="muted">${live.hero?.firstPartyAssetsOnly ? "Focal controls become available when an approved photo is selected." : ""}</p><div data-live-preview class="cms-live-preview"></div><p class="muted">Canonical start and finish are read-only: ${esc(candidate.timing?.sydneyStart?.date || "TBC")} · ${esc(candidate.timing?.sydneyStart?.time || "Time TBC")}, finishing ${esc(candidate.timing?.sydneyFinish?.time || "TBC")}.</p></div></div><div class="admin-actions"><button data-publish-live>Publish live revision</button><button class="secondary" data-copy-live>Copy live link</button><a class="button secondary" href="${esc(candidate.participation?.liveUrl || `/live?campaign=${campaign.campaign_id}`)}" target="_blank" rel="noopener">Open live preview</a></div><p class="admin-status" data-live-status>${campaign.live_published_revision ? `Public live is revision ${esc(campaign.live_published_revision)}.` : "Live has not been explicitly published yet; the generated fallback is public."}</p></section>`;
    }
    const historyPanel = () =>
      '<section class="campaign-panel hidden" data-panel="history"><div data-history><p class="muted">Open History to load immutable server revisions.</p></div></section>';
    function handoffPanel(campaign) {
      const pack = campaign.export_snapshot,
        current =
          pack &&
          !campaign.export_stale &&
          Number(pack.campaignRevision) === Number(campaign.campaign_revision);
      return `<section class="campaign-panel hidden" data-panel="handoff"><div class="handoff-state ${current ? "current" : "superseded"}"><strong>${current ? `Current handoff · revision ${esc(pack.campaignRevision)}` : pack ? "Handoff superseded by later edits" : "No handoff snapshot yet"}</strong><p>Copying or downloading first snapshots the current saved revision as <code>manual-content-handoff.v2</code>. Editing remains unlocked.</p></div><div class="admin-actions"><button data-handoff-copy="subject">Copy subject</button><button data-handoff-copy="preview">Copy preview</button><button data-handoff-copy="body">Copy body</button><button data-handoff-copy="complete">Copy all content</button><button data-handoff-copy="social">Copy social content</button><button data-handoff-download="json" class="secondary">Download content JSON</button><button data-handoff-download="image" class="secondary">Download hero</button></div><p class="admin-status" data-handoff-status></p></section>`;
    }
    function editorMarkup(campaign, assets) {
      const draft = campaign.draft_copy || campaign.candidate?.drafts || {};
      const section = (label, markup) =>
        `<details class="editor-detail"><summary>${label}</summary>${markup.replace("campaign-panel hidden", "campaign-panel")}</details>`;
      const suggestions = draft.cms?.suggestedChanges || [];
      return `<div class="campaign-editor hidden" data-editor><div class="breadcrumbs"><a href="/admin/users">Owner console</a><span>/</span><a href="/admin/comms">Content</a><span>/</span><strong>${esc(campaign.candidate?.material?.recognisableTitle || campaign.event_id)}</strong></div><div class="editor-toolbar"><div class="save-state" role="status" aria-live="polite"><span data-save-state>Saved</span><button class="secondary small" data-save-retry hidden>Retry</button><button class="secondary small" data-save-reload hidden>Load server revision</button><button class="secondary small" data-undo ${campaign.undo_available ? "" : "disabled"}>Undo</button></div></div><div class="task-controls"><label>Post time (Sydney)<input type="datetime-local" data-post-time value="${esc(localSydney(campaign.proposed_send_at))}"></label><button data-posted class="secondary">${campaign.posted_at ? "Mark unposted" : "Mark posted"}</button><button data-snooze class="secondary">Snooze 1h</button><p data-task-status role="status"></p></div>${suggestions.length ? `<details class="source-suggestions"><summary>${suggestions.length} source updates · your edits are protected</summary>${suggestions.map((s) => `<p><strong>${esc(s.field)}</strong><br>${esc(Array.isArray(s.suggested) ? s.suggested.join("\n\n") : s.suggested)}</p>`).join("")}<p>Review the suggestions and edit the fields below; existing text is not replaced automatically.</p></details>` : ""}<label class="hook-field">Hook · Why it matters<textarea data-field="hook" rows="3">${esc(draft.hook)}</textarea></label>${contentPanel(draft)}${section("Media · hero and logo permalinks", mediaPanel(campaign, draft, assets))}${section("Live · staged countdown presentation", livePanel(campaign, draft))}<details data-history-detail class="editor-detail"><summary>History</summary>${historyPanel().replace("campaign-panel hidden", "campaign-panel")}</details>${handoffPanel(campaign).replace("campaign-panel hidden", "campaign-panel")}</div>`;
    }
    function campaignCard(campaign, assets) {
      const card = document.createElement("article");
      card.className = "campaign-card";
      card.dataset.id = campaign.campaign_id;
      card.dataset.state = displayState(campaign).toLowerCase();
      card.dataset.workflow = campaign.state;
      card.dataset.search =
        `${campaign.candidate?.material?.recognisableTitle || ""} ${campaign.candidate?.material?.matchupLabel || ""} ${campaign.draft_copy?.email?.subject || ""}`.toLowerCase();
      card.__campaign = campaign;
      card.__draft = campaign.draft_copy || campaign.candidate?.drafts || {};
      card.innerHTML = compactRow(campaign) + editorMarkup(campaign, assets);
      return card;
    }
    async function imageBitmap(file) {
      if (typeof createImageBitmap === "function")
        return createImageBitmap(file);
      return new Promise((resolve, reject) => {
        const image = new Image(),
          url = URL.createObjectURL(file);
        image.onload = () => {
          URL.revokeObjectURL(url);
          resolve(image);
        };
        image.onerror = reject;
        image.src = url;
      });
    }
    async function derivative(bitmap, width, height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d"),
        scale = Math.max(width / bitmap.width, height / bitmap.height),
        sourceWidth = width / scale,
        sourceHeight = height / scale,
        sourceX = (bitmap.width - sourceWidth) / 2,
        sourceY = (bitmap.height - sourceHeight) / 2;
      context.drawImage(
        bitmap,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height,
      );
      return new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(Error("Could not create image derivative.")),
          "image/webp",
          0.9,
        ),
      );
    }
    async function sha256(file) {
      const hash = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      );
      return [...new Uint8Array(hash)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
    }
    async function mount(container, client) {
      const cacheKey = (card) =>
        "ns_owner_draft_v1_" +
        (client.getSession()?.user?.id || "owner") +
        "_" +
        card.dataset.id;
      let data = null,
        cards = [],
        openId = new URLSearchParams(location.search).get("campaign") || "",
        selected = new Set(),
        pending = new Map(),
        syncing = false;
      const flush = (card) =>
          pending.get(card.dataset.id)?.flush?.() || Promise.resolve(),
        flushAll = () => Promise.all(cards.map(flush));
      function setUrl(campaignId) {
        const url = new URL(location.href);
        campaignId
          ? url.searchParams.set("campaign", campaignId)
          : url.searchParams.delete("campaign");
        history.replaceState({}, "", url);
      }
      function toolbar() {
        return `<div class="admin-section-head"><div><span class="admin-eyebrow">Owner console / Content</span><h1>Post workspace</h1><p>Autosaved drafts, ordered by post time. Preview 72h before; day-of at 9am Sydney or 2h before an early start.</p></div></div><div class="owner-device"><button id="ownerReminders" class="secondary">${data.remindersEnabled ? "Disable post reminders" : "Enable post reminders"}</button><span id="ownerReminderStatus" role="status">${data.refresh?.error ? esc(data.refresh.error) : data.refreshedAt ? `Updated ${esc(sydneyDate(data.refreshedAt))}` : ""} · iPhone: Safari → Share → Add to Home Screen, then enable reminders there.</span></div><section class="workspace-toolbar"><label>Find posts<input id="campaignSearch" type="search" placeholder="Bledisloe, NRL…"></label><label>State<select id="campaignFilter"><option value="active">To post</option><option value="all">All</option><option value="posted">Posted</option><option value="handoff">Copied / downloaded</option><option value="dismissed">Dismissed</option></select></label><button id="syncCampaigns">Sync candidates</button><div class="sync-progress hidden" id="syncProgress"><div><span id="syncText">Preparing sync…</span><strong id="syncPercent">0%</strong></div><progress id="syncBar" max="100" value="0"></progress></div></section><section class="bulk-bar hidden" id="bulkBar"><strong id="bulkCount">0 selected</strong><button id="bulkDismiss" class="secondary">Dismiss</button><button id="bulkRestore" class="secondary">Restore</button><button id="bulkCopy">Copy content</button></section><p id="bulkStatus" class="admin-status" role="status"></p><div id="campaignList" class="campaign-timeline"></div>`;
      }
      async function load(notice = "", skipFlush = false) {
        if (!skipFlush) await flushAll();
        selected = new Set();
        container.innerHTML = '<p class="muted">Loading communications…</p>';
        data = await client.commsRequest();
        data.campaigns.sort(compareCampaigns);
        container.innerHTML = toolbar();
        const list = container.querySelector("#campaignList");
        pending.clear();
        cards = data.campaigns.map((campaign) => {
          let recovered = false;
          try {
            const saved = JSON.parse(
              localStorage.getItem(
                cacheKey({ dataset: { id: campaign.campaign_id } }),
              ) || "null",
            );
            if (
              !skipFlush &&
              saved?.revision === campaign.campaign_revision &&
              Date.now() - saved.updatedAt < 7 * 86400000
            ) {
              campaign.draft_copy = saved.draft;
              recovered = true;
            }
          } catch (_error) {}
          const card = campaignCard(campaign, data.assets || []);
          list.appendChild(card);
          wireCard(card);
          if (recovered) {
            pending.get(card.dataset.id).schedule();
            openId = card.dataset.id;
          }
          return card;
        });
        wireWorkspace();
        applyFilters();
        if (openId) {
          const target = cards.find((card) => card.dataset.id === openId);
          if (target) openCard(target);
        }
        if (notice) {
          const status = container.querySelector("#bulkStatus");
          status.className = "admin-status ok";
          status.textContent = notice;
        }
      }
      function renderLive(card) {
        const preview = card.querySelector("[data-live-preview]");
        if (preview && globalThis.NOTHINGSPORTS_MARQUEE_LIVE_RENDERER)
          NOTHINGSPORTS_MARQUEE_LIVE_RENDERER.render(
            preview,
            card.__campaign.candidate,
            draftFromCard(card, card.__draft).live,
          );
      }
      function openCard(card) {
        cards.forEach((item) => {
          const open = item === card;
          item.classList.toggle("open", open);
          item.querySelector("[data-editor]").classList.toggle("hidden", !open);
          item
            .querySelector("[data-open]")
            .setAttribute("aria-expanded", String(open));
        });
        openId = card.dataset.id;
        setUrl(openId);
        if (card.classList.contains("open")) renderLive(card);
      }
      function closeCard(card) {
        card.classList.remove("open");
        card.querySelector("[data-editor]").classList.add("hidden");
        card
          .querySelector("[data-open]")
          .setAttribute("aria-expanded", "false");
        openId = "";
        setUrl("");
      }
      function refreshSummary(card) {
        const state = displayState(card.__campaign),
          pack = card.__campaign.export_snapshot,
          freshness = pack
            ? card.__campaign.export_stale
              ? "Superseded handoff"
              : `Handoff r${pack.campaignRevision || card.__campaign.campaign_revision}`
            : "No handoff yet",
          stateNode = card.querySelector("[data-summary-state]");
        card.querySelector("[data-summary-revision]").textContent =
          `r${card.__campaign.campaign_revision}`;
        card.querySelector("[data-summary-freshness]").textContent = freshness;
        stateNode.textContent = state;
        stateNode.className = `badge state-${state.toLowerCase().replaceAll(" ", "-")}`;
      }
      function setSave(card, text, kind = "") {
        const node = card.querySelector("[data-save-state]");
        node.className = kind;
        node.textContent = text;
        card.querySelector("[data-save-retry]").hidden = kind !== "error";
        card.querySelector("[data-save-reload]").hidden = kind !== "conflict";
      }
      function autosaver(card) {
        let timer = null,
          inflight = null,
          dirty = false;
        async function save() {
          clearTimeout(timer);
          timer = null;
          if (inflight) await inflight;
          if (!dirty) return inflight || Promise.resolve();
          dirty = false;
          setSave(card, "Saving…", "saving");
          const draft = draftFromCard(card, card.__draft),
            expectedRevision = Number(card.__campaign.campaign_revision);
          inflight = client
            .commsRequest({
              action: "autosave",
              campaignId: card.dataset.id,
              expectedRevision,
              draftCopy: draft,
            })
            .then((payload) => {
              card.__campaign = {
                ...card.__campaign,
                ...payload.campaign,
                undo_available:
                  !payload.idempotent || card.__campaign.undo_available,
              };
              card.__draft = payload.campaign.draft_copy;
              setSave(
                card,
                `Saved at ${new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(new Date())}`,
                dirty ? "dirty" : "saved",
              );
              card.querySelector("[data-undo]").disabled =
                !card.__campaign.undo_available;
              refreshSummary(card);
              if (!dirty)
                try {
                  localStorage.removeItem(cacheKey(card));
                } catch (_error) {}
              else
                try {
                  localStorage.setItem(
                    cacheKey(card),
                    JSON.stringify({
                      revision: card.__campaign.campaign_revision,
                      draft: draftFromCard(card, card.__draft),
                      updatedAt: Date.now(),
                    }),
                  );
                } catch (_error) {}
              return payload;
            })
            .catch((error) => {
              dirty = true;
              card.__serverCampaign = error.payload?.currentCampaign || null;
              if (error.code === "campaign_revision_conflict")
                setSave(
                  card,
                  "Conflict · another tab has a newer revision",
                  "conflict",
                );
              else setSave(card, `Save failed · ${error.message}`, "error");
              throw error;
            })
            .finally(() => {
              inflight = null;
            });
          return inflight;
        }
        function schedule() {
          dirty = true;
          try {
            localStorage.setItem(
              cacheKey(card),
              JSON.stringify({
                revision: card.__campaign.campaign_revision,
                draft: draftFromCard(card, card.__draft),
                updatedAt: Date.now(),
              }),
            );
          } catch (_error) {}
          setSave(card, "Unsaved changes", "dirty");
          clearTimeout(timer);
          timer = setTimeout(() => save().catch(() => {}), 800);
          renderLive(card);
        }
        return {
          schedule,
          flush: () => save(),
          retry: () => save(),
          dirty: () => dirty,
        };
      }
      async function ensureHandoff(card) {
        await flush(card);
        const pack = await client.commsRequest({
          action: "handoff",
          campaignId: card.dataset.id,
        });
        card.__campaign.export_snapshot = pack;
        card.__campaign.export_stale = false;
        refreshSummary(card);
        return pack;
      }
      async function loadHistory(card) {
        const target = card.querySelector("[data-history]");
        target.innerHTML = '<p class="muted">Loading history…</p>';
        try {
          const history = await client.commsRequest(null, {
            campaignId: card.dataset.id,
            history: "1",
          });
          target.innerHTML =
            history.versions
              .map(
                (version) =>
                  `<article class="history-row"><div><strong>Revision ${esc(version.campaignRevision)}</strong><span>${esc(version.reason)} · ${esc(sydneyDate(version.createdAt))}</span><small>${esc(version.summary.subject || version.summary.headline || "No copy summary")}</small></div><button class="secondary" data-restore-version="${esc(version.campaignRevision)}" ${Number(version.campaignRevision) === Number(history.currentRevision) ? "disabled" : ""}>Restore</button></article>`,
              )
              .join("") || '<p class="muted">No revisions recorded.</p>';
          target.querySelectorAll("[data-restore-version]").forEach(
            (button) =>
              (button.onclick = async () => {
                await flush(card);
                await client.commsRequest({
                  action: "restore-revision",
                  campaignId: card.dataset.id,
                  expectedRevision: Number(card.__campaign.campaign_revision),
                  targetRevision: Number(button.dataset.restoreVersion),
                });
                await load("Revision restored as a new revision.");
              }),
          );
        } catch (error) {
          target.innerHTML = `<p class="admin-status error">${esc(error.message)}</p>`;
        }
      }
      async function chooseAsset(card, asset) {
        const shared = {
            assetId: asset.assetId,
            altText: asset.altText,
            mimeType: "image/webp",
            credit: asset.credit,
            source: { name: asset.sourceLabel, url: asset.sourceUrl },
            rights: {
              status: asset.rightsStatus,
              permissionBasis: asset.permissionBasis,
            },
          },
          portrait = {
            ...shared,
            path: asset.paths?.portrait,
            publicUrl: asset.publicUrls?.portrait,
            width: 1080,
            height: 1350,
          },
          email = {
            ...shared,
            path: asset.paths?.email,
            publicUrl: asset.publicUrls?.email,
            width: 1200,
            height: 675,
          },
          live = {
            ...shared,
            path: asset.paths?.live,
            publicUrl: asset.publicUrls?.live,
            width: 1600,
            height: 900,
          },
          next = draftFromCard(card, card.__draft);
        next.live = {
          ...record(next.live),
          heroAssetId: asset.assetId,
          hero: live,
        };
        next.email = { ...record(next.email), image: email };
        next.instagram = {
          ...record(next.instagram),
          image: portrait,
          altText: asset.altText,
        };
        card.__draft = next;
        pending.get(card.dataset.id).schedule();
        await flush(card);
        await load("Approved hero selected and saved.");
      }
      async function uploadAsset(card) {
        const status = card.querySelector("[data-upload-status]"),
          file = card.querySelector('[data-asset="file"]').files[0];
        if (!file) {
          status.className = "admin-status error";
          status.textContent = "Choose an original image first.";
          return;
        }
        status.className = "admin-status";
        status.textContent = "Hashing original…";
        try {
          const bitmap = await imageBitmap(file),
            metadata = {
              action: "create-asset-upload",
              campaignId: card.dataset.id,
              mimeType: file.type,
              size: file.size,
              sha256: await sha256(file),
              sourceUrl: card.querySelector('[data-asset="source-url"]').value,
              sourceLabel: card.querySelector('[data-asset="source-label"]')
                .value,
              credit: card.querySelector('[data-asset="credit"]').value,
              altText: card.querySelector('[data-asset="alt"]').value,
              rightsStatus: card.querySelector('[data-asset="rights"]').value,
              permissionBasis: card.querySelector('[data-asset="permission"]')
                .value,
            },
            ticket = await client.commsRequest(metadata);
          if (ticket.idempotent) {
            await load("That approved asset is already in the library.");
            return;
          }
          status.textContent = "Creating portrait, email and live derivatives…";
          const blobs = {
            original: file,
            portrait: await derivative(bitmap, 1080, 1350),
            email: await derivative(bitmap, 1200, 675),
            live: await derivative(bitmap, 1600, 900),
          };
          for (const key of ["original", "portrait", "email", "live"]) {
            status.textContent = `Uploading ${key}…`;
            const form = new FormData();
            form.append("cacheControl", "31536000");
            form.append("", blobs[key]);
            const response = await fetch(ticket.uploads[key].url, {
              method: "PUT",
              headers: { "x-upsert": "false" },
              body: form,
            });
            if (!response.ok)
              throw Error(`${key} upload failed (${response.status}).`);
          }
          await client.commsRequest({
            action: "finalise-asset",
            assetId: ticket.assetId,
            width: bitmap.width,
            height: bitmap.height,
          });
          await load("Approved asset and permanent derivatives added.");
        } catch (error) {
          status.className = "admin-status error";
          status.textContent = error.message;
        }
      }
      function wireCard(card) {
        const campaign = card.__campaign,
          save = autosaver(card);
        pending.set(card.dataset.id, save);
        card.querySelector("[data-open]").onclick = () =>
          card.classList.contains("open") ? closeCard(card) : openCard(card);
        card.querySelector("[data-select]").onchange = (event) => {
          event.target.checked
            ? selected.add(card.dataset.id)
            : selected.delete(card.dataset.id);
          updateBulk();
        };
        card.querySelectorAll("[data-field]").forEach((field) => {
          field.addEventListener("input", save.schedule);
          field.addEventListener("change", save.schedule);
          field.addEventListener("blur", () => flush(card).catch(() => {}));
        });
        const task = async (taskAction, postAt) => {
          const status = card.querySelector("[data-task-status]");
          try {
            await flush(card);
            const result = await client.commsRequest({
              action: "post-task",
              campaignId: card.dataset.id,
              expectedRevision: card.__campaign.campaign_revision,
              taskAction,
              postAt,
            });
            card.__campaign = result.campaign;
            await load("Post task updated.");
          } catch (error) {
            status.textContent = error.message;
            status.className = "error";
          }
        };
        card.querySelector("[data-post-time]").onchange = (event) => {
          try {
            task("schedule", fromSydney(event.target.value));
          } catch (error) {
            card.querySelector("[data-task-status]").textContent =
              error.message;
          }
        };
        card.querySelector("[data-posted]").onclick = () =>
          task(card.__campaign.posted_at ? "unposted" : "posted");
        card.querySelector("[data-snooze]").onclick = () => task("snooze");
        card.querySelector("[data-history-detail]").ontoggle = (event) => {
          if (event.target.open) loadHistory(card);
        };
        card.querySelector("[data-save-retry]").onclick = () =>
          save.retry().catch(() => {});
        card.querySelector("[data-save-reload]").onclick = () => {
          openId = card.dataset.id;
          load(
            card.__serverCampaign
              ? "Loaded the current server revision. Your conflicting local edit was not silently overwritten."
              : "Reloaded current server campaigns.",
            true,
          );
        };
        card.querySelectorAll("[data-tab-panel]").forEach(
          (button) =>
            (button.onclick = () => {
              card
                .querySelectorAll("[data-tab-panel]")
                .forEach((item) =>
                  item.classList.toggle("active", item === button),
                );
              card
                .querySelectorAll("[data-panel]")
                .forEach((panel) =>
                  panel.classList.toggle(
                    "hidden",
                    panel.dataset.panel !== button.dataset.tabPanel,
                  ),
                );
              if (button.dataset.tabPanel === "history") loadHistory(card);
              if (button.dataset.tabPanel === "live") renderLive(card);
            }),
        );
        card.querySelector("[data-undo]").onclick = async () => {
          await flush(card);
          await client.commsRequest({
            action: "restore-revision",
            campaignId: card.dataset.id,
            expectedRevision: Number(card.__campaign.campaign_revision),
            targetRevision: Number(card.__campaign.campaign_revision) - 1,
          });
          await load("Last saved change restored as a new revision.");
        };
        card.querySelector("[data-publish-live]").onclick = async () => {
          const status = card.querySelector("[data-live-status]");
          try {
            await flush(card);
            const result = await client.commsRequest({
              action: "publish-live",
              campaignId: card.dataset.id,
              expectedRevision: Number(card.__campaign.campaign_revision),
            });
            card.__campaign.live_published_revision =
              result.snapshot.campaignRevision;
            status.className = "admin-status ok";
            status.textContent = `Published live revision ${result.snapshot.campaignRevision}.`;
          } catch (error) {
            status.className = "admin-status error";
            status.textContent = error.message;
          }
        };
        card.querySelector("[data-copy-live]").onclick = () =>
          copy(
            campaign.candidate?.participation?.liveUrl,
            card.querySelector("[data-live-status]"),
            "Live link",
          );
        card
          .querySelectorAll("[data-copy-permalink]")
          .forEach(
            (button) =>
              (button.onclick = () =>
                copy(
                  button.dataset.copyPermalink,
                  card.querySelector("[data-upload-status]"),
                  "Permalink",
                )),
          );
        card.querySelectorAll("[data-handoff-copy]").forEach(
          (button) =>
            (button.onclick = async () => {
              const status = card.querySelector("[data-handoff-status]");
              try {
                const valuePromise = ensureHandoff(card).then((pack) => {
                  const values = {
                    subject: pack.subject,
                    preview: pack.previewText,
                    body: (pack.bodyParagraphs || []).join("\n\n"),
                    complete: completeHandoff(pack),
                    social: socialHandoff(pack),
                  };
                  return values[button.dataset.handoffCopy];
                });
                await deferredCopy(valuePromise, status, button.textContent);
              } catch (error) {
                status.className = "admin-status error";
                status.textContent = error.message;
              }
            }),
        );
        card.querySelectorAll("[data-handoff-download]").forEach(
          (button) =>
            (button.onclick = async () => {
              const status = card.querySelector("[data-handoff-status]");
              try {
                const pack = await ensureHandoff(card);
                if (button.dataset.handoffDownload === "json")
                  saveBlob(
                    `${pack.campaignId}-r${pack.campaignRevision}-handoff.json`,
                    new Blob([JSON.stringify(pack, null, 2)], {
                      type: "application/json",
                    }),
                  );
                else {
                  const response = await fetch(pack.image.url);
                  if (!response.ok) throw Error("Hero download failed.");
                  saveBlob(
                    `${pack.campaignId}-hero.${pack.image.mimeType === "image/webp" ? "webp" : "jpg"}`,
                    await response.blob(),
                  );
                }
                status.className = "admin-status ok";
                status.textContent =
                  "Current revision snapshotted and downloaded.";
              } catch (error) {
                status.className = "admin-status error";
                status.textContent = error.message;
              }
            }),
        );
        card.querySelectorAll("[data-asset-id]").forEach(
          (button) =>
            (button.onclick = () =>
              chooseAsset(
                card,
                (data.assets || []).find(
                  (asset) => asset.assetId === button.dataset.assetId,
                ),
              )),
        );
        card.querySelector("[data-upload-asset]").onclick = () =>
          uploadAsset(card);
        if (card.classList.contains('open')) renderLive(card);
      }
      function matches(card) {
        const term = container
            .querySelector("#campaignSearch")
            .value.trim()
            .toLowerCase(),
          filter = container.querySelector("#campaignFilter").value,
          state = displayState(card.__campaign).toLowerCase(),
          workflow = card.__campaign.state;
        return (
          (!term || card.dataset.search.includes(term)) &&
          (filter === "all" ||
            (filter === "active" &&
              workflow !== "cancelled" &&
              !card.__campaign.posted_at) ||
            (filter === "posted" && Boolean(card.__campaign.posted_at)) ||
            (filter === "ready" && ["ready", "urgent"].includes(state)) ||
            (filter === "watching" && state === "watching") ||
            (filter === "handoff" && state === "handoff current") ||
            (filter === "dismissed" && workflow === "cancelled"))
        );
      }
      function applyFilters() {
        cards.forEach((card) => (card.hidden = !matches(card)));
        updateBulk();
      }
      function updateBulk() {
        const bar = container.querySelector("#bulkBar"),
          visible = [...selected].filter((id) =>
            cards.some((card) => card.dataset.id === id && !card.hidden),
          );
        bar.classList.toggle("hidden", !visible.length);
        container.querySelector("#bulkCount").textContent =
          `${visible.length} selected`;
      }
      async function runBulk(action) {
        const targets = cards.filter(
            (card) => selected.has(card.dataset.id) && !card.hidden,
          ),
          status = container.querySelector("#bulkStatus");
        if (!targets.length) return;
        if (action === "copy") {
          const contentPromise = (async () => {
            await Promise.all(targets.map(flush));
            const packs = [];
            for (const card of targets)
              packs.push(completeHandoff(await ensureHandoff(card)));
            return packs.join("\n\n====================\n\n");
          })();
          await deferredCopy(contentPromise, status, "Selected content");
          return;
        }
        try {
          await Promise.all(targets.map(flush));
          if (action === "copy") {
            const packs = [];
            for (const card of targets)
              packs.push({
                title:
                  card.__campaign.candidate?.material?.recognisableTitle ||
                  card.dataset.id,
                pack: await ensureHandoff(card),
              });
            await copy(
              packs
                .map((item) => `${item.title}\n\n${completeHandoff(item.pack)}`)
                .join("\n\n====================\n\n"),
              status,
              "Selected handoffs",
            );
          } else {
            for (const card of targets)
              await client.commsRequest({
                action:
                  action === "dismiss"
                    ? "dismiss-campaign"
                    : "restore-campaign",
                campaignId: card.dataset.id,
              });
            await load(
              `${targets.length} campaign${targets.length === 1 ? "" : "s"} ${action === "dismiss" ? "dismissed" : "restored"}.`,
            );
          }
        } catch (error) {
          status.className = "admin-status error";
          status.textContent = error.message;
        }
      }
      async function sync() {
        if (syncing) return;
        syncing = true;
        const panel = container.querySelector("#syncProgress"),
          bar = container.querySelector("#syncBar"),
          text = container.querySelector("#syncText"),
          percent = container.querySelector("#syncPercent"),
          button = container.querySelector("#syncCampaigns"),
          failures = [];
        panel.classList.remove("hidden");
        button.disabled = true;
        try {
          await flushAll();
          let cursor = 0,
            done = false,
            sourceRevision = "";
          cards.forEach((card) =>
            card
              .querySelectorAll("[data-field]")
              .forEach((input) => (input.disabled = true)),
          );
          while (!done) {
            try {
              const result = await client.commsRequest({
                action: "sync-candidates",
                cursor,
                sourceRevision,
              });
              sourceRevision = result.sourceRevision;
              if (result.error)
                failures.push(result.title + ": " + result.error);
              bar.value = result.percent;
              percent.textContent = `${result.percent}%`;
              text.textContent = `${result.completed} of ${result.total} · ${result.title || "Complete"}`;
              cursor = result.nextCursor;
              done = result.done;
            } catch (error) {
              failures.push(error.message);
              done = true;
            }
          }
          await load(
            failures.length
              ? `Candidate sync completed with ${failures.length} failure${failures.length === 1 ? "" : "s"}: ${failures.join(" · ")}`
              : "Candidate sync complete.",
          );
        } finally {
          syncing = false;
          button.disabled = false;
          cards.forEach((card) =>
            card
              .querySelectorAll("[data-field]")
              .forEach((input) => {
                input.disabled = ['focal-x', 'focal-y'].includes(input.dataset.field) && card.__draft.live?.hero?.firstPartyAssetsOnly !== false;
              }),
          );
        }
      }
      function wireWorkspace() {
        container.querySelector("#ownerReminders").onclick = async () => {
          const button = container.querySelector("#ownerReminders"),
            status = container.querySelector("#ownerReminderStatus");
          const ios =
            /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
          const standalone =
            matchMedia("(display-mode: standalone)").matches ||
            navigator.standalone === true;
          try {
            if (!data.remindersEnabled && ios && !standalone)
              throw Error(
                "Add Owner console to your Home Screen from Safari, open it there, then enable reminders.",
              );
            if (
              !data.remindersEnabled &&
              (!("serviceWorker" in navigator) ||
                !("PushManager" in window) ||
                typeof Notification === "undefined")
            )
              throw Error(
                "System notifications are unavailable in this browser.",
              );
            // Permission call stays in the explicit click gesture, before any awaited request.
            const permission =
              !data.remindersEnabled && Notification.permission === "default"
                ? Notification.requestPermission()
                : Promise.resolve(
                    typeof Notification !== "undefined"
                      ? Notification.permission
                      : "denied",
                  );
            button.disabled = true;
            let credentials = JSON.parse(
              localStorage.getItem("ns_push_installation_v1") || "null",
            );
            if (!data.remindersEnabled) {
              if ((await permission) !== "granted")
                throw Error(
                  "Allow notifications in system settings before enabling post reminders.",
                );
              await navigator.serviceWorker.register("/service-worker.js");
              const registration = await navigator.serviceWorker.ready;
              const response = await fetch("/api/notifications", {
                  cache: "no-store",
                }),
                config = await response.json();
              if (!response.ok || !config.configured || !config.publicKey)
                throw Error("Notifications are not configured.");
              if (!credentials) {
                const bytes = crypto.getRandomValues(new Uint8Array(32));
                credentials = {
                  installationId: crypto.randomUUID(),
                  secret: btoa(String.fromCharCode(...bytes))
                    .replaceAll("+", "-")
                    .replaceAll("/", "_")
                    .replace(/=+$/, ""),
                };
                localStorage.setItem(
                  "ns_push_installation_v1",
                  JSON.stringify(credentials),
                );
              }
              const key = config.publicKey
                  .replaceAll("-", "+")
                  .replaceAll("_", "/"),
                serverKey = Uint8Array.from(
                  atob(key + "=".repeat((4 - (key.length % 4)) % 4)),
                  (c) => c.charCodeAt(0),
                );
              const subscription =
                (await registration.pushManager.getSubscription()) ||
                (await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: serverKey,
                }));
              await client.notificationCommand({
                action: "register",
                ...credentials,
                subscription: subscription.toJSON(),
                timezone: "Australia/Sydney",
              });
            }
            if (!credentials)
              throw Error(
                "This device has no registered notification installation.",
              );
            const result = await client.commsRequest({
              action: "post-reminders",
              ...credentials,
              enabled: !data.remindersEnabled,
            });
            data.remindersEnabled = result.enabled;
            button.textContent = result.enabled
              ? "Disable post reminders"
              : "Enable post reminders";
            status.textContent = result.enabled
              ? "Enabled on this device · 30 minutes before and when due. Delivery is checked every 5 minutes."
              : "Post reminders disabled.";
          } catch (error) {
            status.textContent = error.message;
          } finally {
            button.disabled = false;
          }
        };
        container.querySelector("#campaignSearch").oninput = applyFilters;
        container.querySelector("#campaignFilter").onchange = applyFilters;
        container.querySelector("#syncCampaigns").onclick = sync;
        container.querySelector("#bulkDismiss").onclick = () =>
          runBulk("dismiss");
        container.querySelector("#bulkRestore").onclick = () =>
          runBulk("restore");
        container.querySelector("#bulkCopy").onclick = () => runBulk("copy");
      }
      await load();
      let lastForeground = Date.now(),
        disposed = false;
      const foreground = () => {
        if (
          !document.hidden &&
          Date.now() - lastForeground > 60000 &&
          !syncing
        ) {
          lastForeground = Date.now();
          load().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", foreground);
      const refreshTimer = setInterval(() => {
        if (!document.hidden && !disposed && !syncing) {
          lastForeground = Date.now();
          load().catch(() => {});
        }
      }, 6 * 3600000);
      const countdownTimer = setInterval(
        () =>
          container
            .querySelectorAll("[data-countdown]")
            .forEach(
              (node) => {
                const campaign = node.closest('[data-id]')?.__campaign;
                node.textContent = campaign?.posted_at ? "Posted" : countdownLabel(node.dataset.sendAt);
              },
            ),
        60000,
      );
      window.addEventListener(
        "pagehide",
        () => {
          disposed = true;
          clearInterval(refreshTimer);
          document.removeEventListener("visibilitychange", foreground);
          clearInterval(countdownTimer);
          cards.forEach((card) => {
            if (pending.get(card.dataset.id)?.dirty())
              flush(card).catch(() => {});
          });
        },
        { once: true },
      );
      return async () => {
        await flushAll();
        disposed = true;
        clearInterval(refreshTimer);
        clearInterval(countdownTimer);
        document.removeEventListener("visibilitychange", foreground);
      };
    }
    return Object.freeze({
      compareCampaigns,
      countdownLabel,
      fromSydney,
      displayState,
      draftFromCard,
      mount,
    });
  },
);
