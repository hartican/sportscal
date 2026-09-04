#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  GifProviderError,
  giphyClientConfig,
  normalizedGiphyReference,
  requireGiphyApiKey,
} = require("../lib/giphy-provider");
const {
  GIPHY_REQUEST_TIMEOUT_MS,
  giphyRequestUrl,
  normalizedGiphyItem,
  searchGiphyClient,
} = require("../config/chat-media-ui");

function providerItem(){
  return {
    id:"reaction-1",
    title:"Big win",
    url:"https://giphy.com/gifs/reaction-1",
    images:{
      fixed_width_small:{ url:"https://media1.giphy.com/media/reaction-1/100w.gif?cid=client", width:"100", height:"80" },
      original:{ url:"https://media1.giphy.com/media/reaction-1/giphy.gif?cid=client", width:"480", height:"384" },
    },
    analytics:{
      onload:{ url:"https://giphy-analytics.giphy.com/simple_analytics?event=onload" },
      onclick:{ url:"https://giphy-analytics.giphy.com/simple_analytics?event=onclick" },
      onsent:{ url:"https://giphy-analytics.giphy.com/simple_analytics?event=onsent" },
    },
  };
}

async function main(){
  const providerLogs = [];
  const originalError = console.error;
  console.error = value => providerLogs.push(String(value));
  try{
    assert.throws(
      () => requireGiphyApiKey({}),
      error => error instanceof GifProviderError
        && error.status === 503
        && error.code === "gif_provider_unconfigured"
        && error.message === "GIFs are unavailable right now."
    );

    const config = giphyClientConfig({ GIPHY_API_KEY:"test-public-beta-key" });
    assert.equal(config.apiKey, "test-public-beta-key");
    assert.equal(config.searchEndpoint, "https://api.giphy.com/v1/gifs/search");
    assert.equal(config.trendingEndpoint, "https://api.giphy.com/v1/gifs/trending");
    assert.equal(config.rating, "pg-13");
    assert.equal(config.countryCode, "AU");
    assert.equal(config.language, "en");

    const normalized = normalizedGiphyItem(providerItem());
    assert.equal(normalized.gifId, "reaction-1");
    assert.equal(normalized.previewUrl, "https://media1.giphy.com/media/reaction-1/100w.gif?cid=client");
    assert.equal(normalized.contentUrl, "https://media1.giphy.com/media/reaction-1/giphy.gif?cid=client");
    assert.equal(normalized.analytics.onclick.url, "https://giphy-analytics.giphy.com/simple_analytics?event=onclick");
    assert.equal(normalizedGiphyItem({ id:"unsafe", images:{ fixed_width:{ url:"http://example.com/unsafe.gif" } } }), null);

    const reference = normalizedGiphyReference(normalized);
    assert.equal(reference.gifId, "reaction-1");
    assert.equal(reference.provider, "giphy");
    assert.equal(reference.attribution, "Powered by GIPHY");
    assert.throws(
      () => normalizedGiphyReference({ gifId:"unsafe", contentUrl:"https://example.com/a.gif", previewUrl:"https://example.com/a.gif" }),
      error => error instanceof GifProviderError && error.code === "invalid_gif_reference"
    );

    const searchUrl = giphyRequestUrl(config, "big win", 24);
    assert.equal(searchUrl.origin, "https://api.giphy.com");
    assert.equal(searchUrl.pathname, "/v1/gifs/search");
    assert.equal(searchUrl.searchParams.get("api_key"), "test-public-beta-key");
    assert.equal(searchUrl.searchParams.get("q"), "big win");
    assert.equal(searchUrl.searchParams.get("rating"), "pg-13");
    assert.equal(searchUrl.searchParams.get("country_code"), "AU");
    assert.equal(searchUrl.searchParams.get("lang"), "en");
    assert.equal(searchUrl.searchParams.get("offset"), "24");

    const trendingUrl = giphyRequestUrl(config);
    assert.equal(trendingUrl.pathname, "/v1/gifs/trending");
    assert.equal(trendingUrl.searchParams.has("q"), false);
    assert.throws(
      () => giphyRequestUrl({ ...config, searchEndpoint:"https://example.com/v1/gifs/search" }, "clutch"),
      /GIFs are unavailable/
    );
    assert.throws(() => giphyRequestUrl(config, "x".repeat(101)), /at most 100 characters/);
    assert.throws(() => giphyRequestUrl(config, "clutch", 4_801), /result page is unavailable/);

    let requestedUrl = null;
    let requestedOptions = null;
    const search = await searchGiphyClient(config, {
      query:"big win",
      offset:24,
      fetchImpl:async (url, options) => {
        requestedUrl = new URL(url);
        requestedOptions = options;
        return {
          ok:true,
          async json(){
            return {
              data:[providerItem()],
              pagination:{ count:1, total_count:100 },
            };
          },
        };
      },
    });
    assert.equal(requestedUrl.origin, "https://api.giphy.com");
    assert.equal(requestedOptions.credentials, "omit");
    assert.equal(search.items.length, 1);
    assert.equal(search.pagination.nextOffset, 25);
    assert.equal(search.pagination.hasMore, true);

    await assert.rejects(
      searchGiphyClient(config, {
        timeoutMs:5,
        fetchImpl:(_url, { signal }) => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            const timeout = new Error("aborted");
            timeout.name = "AbortError";
            reject(timeout);
          }, { once:true });
        }),
      }),
      error => error.message === "GIFs are taking too long. Try again."
    );
    assert.equal(GIPHY_REQUEST_TIMEOUT_MS, 10_000);
  }finally{
    console.error = originalError;
  }

  const chatApi = fs.readFileSync("api/chat.js", "utf8");
  assert.doesNotMatch(chatApi, /api\.giphy\.com|searchGiphyProvider/, "the server must not proxy GIPHY API calls");
  assert.match(chatApi, /mode === "gif-config"/);
  assert.match(chatApi, /case "gif-reference"/);
  assert.match(chatApi, /external_url:gif\.contentUrl/);
  assert.match(chatApi, /external_media_save_unsupported/);
  assert(providerLogs.some(line => line.includes('"reason":"missing_configuration"')));
  assert(!providerLogs.join("\n").includes("test-public-beta-key"), "structured provider logs must not expose the GIPHY key");
  console.log("GIF integration validation passed: authenticated config, direct client search, trusted references, bounded timeout, and no server proxy.");
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
