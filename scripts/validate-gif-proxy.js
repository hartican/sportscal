#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  GifProviderError,
  normalizedGiphyItem,
  requireGiphyApiKey,
  searchGiphyProvider,
} = require("../lib/giphy-provider");

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

    const normalized = normalizedGiphyItem({
      id:"reaction-1",
      title:"Big win",
      url:"https://giphy.com/gifs/reaction-1",
      images:{ fixed_width_small:{ url:"https://media1.giphy.com/media/reaction-1/100w.gif", width:"100", height:"80" } },
      analytics:{
        onload:{ url:"https://giphy-analytics.giphy.com/simple_analytics?event=onload" },
        onclick:{ url:"https://giphy-analytics.giphy.com/simple_analytics?event=onclick" },
        onsent:{ url:"https://giphy-analytics.giphy.com/simple_analytics?event=onsent" },
      },
    });
    assert.equal(normalized.gifId, "reaction-1");
    assert.equal(normalized.previewUrl, "https://media1.giphy.com/media/reaction-1/100w.gif");
    assert.equal(normalized.analytics.onclick.url, "https://giphy-analytics.giphy.com/simple_analytics?event=onclick");
    assert.equal(normalizedGiphyItem({ id:"unsafe", images:{ fixed_width:{ url:"http://example.com/unsafe.gif" } } }), null);

    let requestedUrl = null;
    const search = await searchGiphyProvider(
      { query:"big win", offset:24 },
      {
        environment:{ GIPHY_API_KEY:"test-secret-key" },
        signal:{ aborted:false },
        fetchImpl:async url => {
          requestedUrl = new URL(url);
          return {
            ok:true,
            status:200,
            async json(){
              return {
                data:[
                  {
                    id:"reaction-1",
                    title:"Big win",
                    url:"https://giphy.com/gifs/reaction-1",
                    images:{ fixed_width_small:{ url:"https://media1.giphy.com/media/reaction-1/100w.gif", width:"100", height:"80" } },
                  },
                  { id:"unsafe", images:{ fixed_width:{ url:"https://example.com/unsafe.gif" } } },
                ],
                pagination:{ count:24, total_count:100 },
              };
            },
          };
        },
      }
    );
    assert.equal(requestedUrl.origin, "https://api.giphy.com");
    assert.equal(requestedUrl.pathname, "/v1/gifs/search");
    assert.equal(requestedUrl.searchParams.get("q"), "big win");
    assert.equal(requestedUrl.searchParams.get("rating"), "pg-13");
    assert.equal(requestedUrl.searchParams.get("country_code"), "AU");
    assert.equal(requestedUrl.searchParams.get("lang"), "en");
    assert.equal(requestedUrl.searchParams.get("offset"), "24");
    assert.equal(search.items.length, 1, "untrusted provider URLs must be discarded");
    assert.equal(search.pagination.nextOffset, 48);
    assert.equal(search.pagination.hasMore, true);
    assert(!JSON.stringify(search).includes("test-secret-key"), "the provider key must never enter the client payload");

    let trendingUrl = null;
    await searchGiphyProvider({}, {
      environment:{ GIPHY_API_KEY:"test-secret-key" },
      signal:{ aborted:false },
      fetchImpl:async url => {
        trendingUrl = new URL(url);
        return { ok:true, status:200, async json(){ return { data:[], pagination:{ count:0, total_count:0 } }; } };
      },
    });
    assert.equal(trendingUrl.pathname, "/v1/gifs/trending");
    assert.equal(trendingUrl.searchParams.has("q"), false);

    await assert.rejects(
      searchGiphyProvider({}, {
        environment:{ GIPHY_API_KEY:"invalid-key" },
        signal:{ aborted:false },
        fetchImpl:async () => ({ ok:false, status:403 }),
      }),
      error => error instanceof GifProviderError
        && error.status === 502
        && error.code === "gif_provider_unavailable"
    );

    const timeout = new Error("provider timeout");
    timeout.name = "TimeoutError";
    await assert.rejects(
      searchGiphyProvider({ query:"clutch" }, {
        environment:{ GIPHY_API_KEY:"timeout-secret-key" },
        signal:{ aborted:false },
        fetchImpl:async () => { throw timeout; },
      }),
      error => error instanceof GifProviderError
        && error.status === 502
        && error.code === "gif_provider_unavailable"
        && error.message === "GIFs are unavailable right now."
    );
  }finally{
    console.error = originalError;
  }

  assert(providerLogs.some(line => line.includes('"reason":"missing_configuration"')));
  assert(providerLogs.some(line => line.includes('"reason":"provider_rejected_configuration"')));
  assert(providerLogs.some(line => line.includes('"reason":"timeout"')));
  assert(!providerLogs.join("\n").includes("test-secret-key"), "structured provider logs must not expose a credential");
  assert(!providerLogs.join("\n").includes("clutch"), "structured provider logs must not expose a search query");
  console.log("GIF proxy validation passed: authenticated server search, safe normalized results, explicit failures, and no client key exposure.");
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
