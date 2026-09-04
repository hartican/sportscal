"use strict";

const { logGifProviderFailure } = require("./gif-provider-telemetry");

const GIF_SEARCH_LIMIT = 24;
const GIPHY_SEARCH_ENDPOINT = "https://api.giphy.com/v1/gifs/search";
const GIPHY_TRENDING_ENDPOINT = "https://api.giphy.com/v1/gifs/trending";

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

function giphyClientConfig(environment = process.env, errorFactory){
  return {
    apiKey:requireGiphyApiKey(environment, errorFactory),
    searchEndpoint:GIPHY_SEARCH_ENDPOINT,
    trendingEndpoint:GIPHY_TRENDING_ENDPOINT,
    limit:GIF_SEARCH_LIMIT,
    rating:"pg-13",
    countryCode:"AU",
    language:"en",
    bundle:"messaging_non_clips",
    removeLowContrast:true,
  };
}

function normalizedGiphyReference(item, errorFactory){
  const gifId = String(item?.gifId || item?.id || "").trim().slice(0, 200);
  const contentUrl = trustedGiphyUrl(item?.contentUrl || item?.url);
  const previewUrl = trustedGiphyUrl(item?.previewUrl || item?.contentUrl || item?.url);
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(gifId) || !contentUrl || !previewUrl){
    throw providerError(errorFactory, "That GIF is no longer available.", 400, "invalid_gif_reference");
  }
  return {
    gifId,
    provider:"giphy",
    title:String(item?.title || "GIF").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 120) || "GIF",
    contentType:"image/gif",
    contentUrl,
    previewUrl,
    width:Math.max(1, Math.min(4096, Number(item?.width) || 240)),
    height:Math.max(1, Math.min(4096, Number(item?.height) || 240)),
    sourcePage:trustedGiphyUrl(item?.sourcePage) || "https://giphy.com/",
    attribution:"Powered by GIPHY",
    analytics:normalizedGifAnalytics(item?.analytics),
  };
}

module.exports = Object.freeze({
  GIF_SEARCH_LIMIT,
  GIPHY_SEARCH_ENDPOINT,
  GIPHY_TRENDING_ENDPOINT,
  GifProviderError,
  giphyClientConfig,
  normalizedGiphyReference,
  requireGiphyApiKey,
  trustedGiphyUrl,
});
