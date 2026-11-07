#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main(){
  const browser = await chromium.launch({ headless:true });
  try{
    for (const viewport of [{width:390,height:844}, {width:430,height:932}, {width:768,height:1024}, {width:1280,height:900}]){
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(() => {
        // Exercise the real composer with a deferred local response; never send a real message.
        let sync;
        Object.defineProperty(window, "NOTHINGSPORTS_SERVER_SYNC", {
          configurable:true,
          get:() => sync,
          set:value => { sync = { ...value, createClient:() => ({
            ...value.createClient(),
            chatRequest:(_query, command) => command?.action === "send-message"
              ? new Promise((resolve, reject) => { window.chatQaResponse = { resolve, reject, command }; })
              : Promise.resolve({ rooms:[] }),
          }) }; },
        });
      });
      await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status:503, body:"{}" });
        return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
      });
      await page.goto(process.env.REPAIR_QA_URL || "http://127.0.0.1:33958");
      await page.waitForFunction(() => typeof renderOpenChatRoom === "function" && typeof startupFeedState !== "undefined" && startupFeedState.phase !== "loading");
      await page.evaluate(async () => {
        await document.fonts.ready;
        document.getElementById("mainContent").style.minHeight = "2400px";
        syncFeedFilterDockOffset();
        window.scrollTo(0, 0);
      });
      const before = await page.locator("header.top").boundingBox();
      await page.evaluate(() => window.scrollTo(0, 1100));
      await page.waitForFunction(() => window.scrollY >= 1000);
      const after = await page.locator("header.top").boundingBox();
      assert.equal(before.y, 0);
      assert.equal(after.y, 0);
      assert.equal(after.height, before.height, "Feed chrome must keep its height while scrolling");
      const savedScroll = await page.evaluate(() => {
        document.getElementById("homeSpoilerToggle").focus({ preventScroll:true });
        const scroll = window.scrollY;
        chatState = createChatState({
          currentRoom:{ roomId:"native-qa", roomName:"Local QA", status:"open", members:[], viewer:{canPost:true}, fixture:{name:"Local fixture"} },
          profile:{displayName:"Local tester"},
          messages:Array.from({length:30}, (_, index) => ({messageId:`qa-${index}`, body:`Message ${index}`, senderName:"Tester", sentAt:new Date(1800000000000 + index * 1000).toISOString(), attachments:[], reactions:[]})),
        });
        setChatDrawerOpen(true);
        renderOpenChatRoom();
        return scroll;
      });
      await page.waitForFunction(() => document.activeElement?.id === "closeChatBtn");
      const drawer = await page.locator("#chatDrawer").boundingBox();
      assert.deepEqual(drawer, {x:0, y:0, width:viewport.width, height:viewport.height});
      await page.locator("#chatMessageInput").fill("First line");
      await page.locator("#chatMessageInput").press("Enter");
      await page.locator("#chatMessageInput").press("End");
      await page.locator("#chatMessageInput").pressSequentially("Second line");
      assert.equal(await page.locator("#chatMessageInput").inputValue(), "First line\nSecond line");
      assert.equal(await page.evaluate(() => Boolean(window.chatQaResponse)), false, "Return must not send");

      // Bounded viewport samples stand in for keyboard geometry, not physical iPhone proof.
      for (let cycle = 0; cycle < 3; cycle++){
        await page.evaluate(() => {
          Object.defineProperty(window, "visualViewport", { configurable:true, value:{height:420,width:innerWidth,offsetTop:44,offsetLeft:0,addEventListener(){},removeEventListener(){}} });
          applyChatViewport();
        });
        const field = await page.locator("#chatMessageInput").boundingBox();
        assert(field.y + field.height <= 464, "composer must fit above the simulated keyboard");
        await page.evaluate(() => { delete window.visualViewport; applyChatViewport(); });
      }
      await page.evaluate(() => {
        const body = document.getElementById("chatBody");
        body.scrollTop = 0;
        body.dispatchEvent(new Event("scroll"));
        applyChatViewport();
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      assert.equal(await page.locator("#chatBody").evaluate(body => body.scrollTop), 0, "viewport sampling must preserve a reader's scroll-back position");
      await page.locator("#chatMessageInput").press("Control+Enter");
      await page.waitForFunction(() => Boolean(window.chatQaResponse));
      assert.equal(await page.evaluate(() => window.chatQaResponse.command.body), "First line\nSecond line");
      await page.evaluate(() => {
        document.getElementById("chatMessageInput").blur();
        const {resolve, command} = window.chatQaResponse;
        resolve({message:{messageId:"qa-sent",body:command.body,sentAt:new Date().toISOString(),senderName:"Tester",own:true,attachments:[],reactions:[]}});
      });
      await page.waitForFunction(() => !document.querySelector('#chatRoomComposer [type="submit"]').disabled);
      assert.equal(await page.evaluate(() => document.activeElement?.id === "chatMessageInput"), false, "a delayed send response must not reopen a dismissed keyboard");

      await page.locator("#chatMessageInput").fill("Retry this message");
      await page.locator("#chatMessageInput").press("Control+Enter");
      await page.evaluate(() => { document.getElementById("chatMessageInput").blur(); window.chatQaResponse.reject(new Error("Local deferred failure")); });
      await page.waitForFunction(() => document.getElementById("chatConnection").textContent.includes("Local deferred failure"));
      assert.equal(await page.locator("#chatMessageInput").inputValue(), "Retry this message");
      assert.equal(await page.evaluate(() => document.activeElement?.id === "chatMessageInput"), false, "a failed send must not reopen a dismissed keyboard");
      await page.locator("#chatMessageInput").fill("Explicit Send");
      await page.locator('#chatRoomComposer [type="submit"]').click();
      assert.equal(await page.evaluate(() => document.activeElement?.id), "chatMessageInput", "tapping Send must retain the active composer");
      await page.evaluate(() => window.chatQaResponse.resolve({message:{messageId:"qa-button-send",body:"Explicit Send",sentAt:new Date().toISOString(),senderName:"Tester",own:true,attachments:[],reactions:[]}}));
      await page.waitForFunction(() => !document.querySelector('#chatRoomComposer [type="submit"]').disabled);
      assert.equal(await page.evaluate(() => document.activeElement?.id), "chatMessageInput");
      await page.locator("#closeChatBtn").click();
      assert.equal(await page.evaluate(() => window.scrollY), savedScroll, "closing Chat must restore Feed scroll");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "homeSpoilerToggle");
      assert.deepEqual(errors, [], "local shell must run without JavaScript errors");
      console.log(`${viewport.width}×${viewport.height}: fixed Feed, full-screen Chat, multiline input, viewport cycles and deferred sends passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
