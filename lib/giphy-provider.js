"use strict";

const { logGifProviderFailure } = require("./gif-provider-telemetry");

const GIF_SEARCH_LIMIT = 24;

class GifProviderError extends Error {
  constructor(message, status, code){
    super(message);
    this.status = status;
    this.code = code;
  }
}

function providerError(errorFactory, message, status, code){
  return typeof errorFactory === "function"
    ? errorFactory(message, status, code)
    : new GifProviderError(message, status, code);
}

function requireGiphyApiKey(environment = process.env, errorFactory){
  const key = String(environment.GIPHY_API_KEY || "").trim();
  if (key) return key;
  logGifProviderFailure("missing_configuration");
  throw providerError(errorFactory, "GIFs are unavailable right now.", 503, "gif_provider_unconfigured");
}

function trustedGiphyUrl(value){
  try{
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && /(^|\.)giphy\.(?:com|net)$/i.test(url.hostname) ? url.href : "";
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
  const preview = item?.images?.fixed_width_small || item?.images?.fixed_width || item?.images?.preview_gif || {};
  const previewUrl = trustedGiphyUrl(preview.url);
  const gifId = String(item?.id || "").trim().slice(0, 200);
  if (!gifId || !previewUrl) return null;
  return {
    gifId,
    provider:"giphy",
    title:String(item?.title || "GIF").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 120) || "GIF",
    contentType:"image/gif",
    previewUrl,
    width:Math.max(1, Number(preview.width) || 240),
    height:Math.max(1, Number(preview.height) || 240),
    sourcePage:trustedGiphyUrl(item?.url) || "https://giphy.com/",
    attribution:"Powered by GIPHY",
    analytics:normalizedGifAnalytics(item?.analytics),
  };
}

async function searchGiphyProvider({ query = "", offset = 0 } = {}, options = {}){
  const environment = options.environment || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const key = requireGiphyApiKey(environment, options.errorFactory);
  const endpoint = query ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending";
  const url = new URL(endpoint);
  url.searchParams.set("api_key", key);
  url.searchParams.set("limit", String(GIF_SEARCH_LIMIT));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("country_code", "AU");
  url.searchParams.set("bundle", "messaging_non_clips");
  url.searchParams.set("remove_low_contrast", "true");
  if (query){
    url.searchParams.set("q", query);
    url.searchParams.set("lang", "en");
  }

  let response;
  try{
    response = await fetchImpl(url, { signal:options.signal || AbortSignal.timeout(8_000) });
  }catch(error){
    logGifProviderFailure(error?.name === "TimeoutError" ? "timeout" : "network_error");
    throw providerError(options.errorFactory, "GIFs are unavailable right now.", 502, "gif_provider_unavailable");
  }
  if (!response.ok){
    const reason = [401, 403].includes(response.status) ? "provider_rejected_configuration" : "upstream_response";
    logGifProviderFailure(reason, { status:Number(response.status) || 0 });
    throw providerError(options.errorFactory, "GIFs are unavailable right now.", 502, "gif_provider_unavailable");
  }

  let providerPayload;
  try{
    providerPayload = await response.json();
  }catch(_error){
    logGifProviderFailure("invalid_response");
    throw providerError(options.errorFactory, "GIFs are unavailable right now.", 502, "gif_provider_unavailable");
  }
  const items = (Array.isArray(providerPayload?.data) ? providerPayload.data : [])
    .map(normalizedGiphyItem)
    .filter(Boolean);
  const providerCount = Math.max(0, Number(providerPayload?.pagination?.count) || items.length);
  const totalCount = Math.max(0, Number(providerPayload?.pagination?.total_count) || 0);
  const nextOffset = offset + providerCount;
  return {
    provider:"giphy",
    items,
    pagination:{
      offset,
      count:items.length,
      nextOffset,
      hasMore:providerCount > 0 && (totalCount ? nextOffset < totalCount : providerCount >= GIF_SEARCH_LIMIT),
    },
    attribution:"Powered by GIPHY",
    attributionUrl:"https://giphy.com/",
  };
}

module.exports = Object.freeze({
  GifProviderError,
  normalizedGiphyItem,
  requireGiphyApiKey,
  searchGiphyProvider,
});
