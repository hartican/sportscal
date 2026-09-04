#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const reminders = require("../config/reminder-engine.js");
const soundtrack = require("../config/soundtrack.js");

const now = new Date("2026-07-20T10:00:00.000Z");
const events = [
  { id: "important", name: "Australia v Japan", startTimeUtc: "2026-07-20T12:00:00.000Z", broadcaster: "Stan Sport", important: true },
  { id: "routine", name: "Routine", startTimeUtc: "2026-07-20T13:00:00.000Z", important: false },
  { id: "past", name: "Past", startTimeUtc: "2026-07-20T09:00:00.000Z", important: true },
];
const schedule = reminders.buildSchedule(events, {
  now,
  leadMinutes: [60, 15, 60],
  shouldRemind: event => event.important,
});
assert.deepEqual(schedule.reminders.map(reminder => reminder.leadMinutes), [60, 15]);
assert(schedule.reminders.every(reminder => reminder.eventId === "important"));
assert.equal(reminders.schedulableReminders(schedule, now).length, 2);
const delivered = reminders.buildSchedule(events, {
  now,
  leadMinutes: [60],
  shouldRemind: event => event.important,
  deliveredKeys: [schedule.reminders[0].key],
});
assert.equal(delivered.reminders.length, 0, "delivered reminder keys must not schedule twice");
const cancelled = reminders.buildSchedule(events, {
  now,
  leadMinutes:[15],
  shouldRemind:() => false,
});
assert.equal(cancelled.reminders.length, 0, "the retired deterministic scheduler must still model cancellation correctly");

const html = fs.readFileSync("index.html", "utf8");
assert(/async function ensurePushInstallation[\s\S]{0,1800}Notification\.permission === "default"[\s\S]{0,500}Notification\.requestPermission/.test(html), "system notification permission must remain inside the explicit Web Push enablement path");
assert(/async function toggleQuickReminder[\s\S]{0,1600}return ensureWebPushReminder\(ev, timing\)[\s\S]{0,500}return removeWebPushReminder\(ev\)/.test(html), "reminder creation and cancellation must wait for the server");
assert(/function renderQuickReminderButton[\s\S]{0,900}"Reminder ON"[\s\S]{0,500}"Remind"/.test(html), "the shared reminder renderer must expose distinct on and off labels");
assert(/function renderQuickReminderButton[\s\S]{0,900}classList\.toggle\("is-reminder-on"[\s\S]{0,500}aria-pressed/.test(html), "the reminder renderer must expose its filled visual and accessible pressed state from the same source of truth");
assert(html.includes('.event-quick-action.is-reminder-on .reminder-bell{ fill:currentColor; }'), "an active reminder must use a colour-filled bell");
assert(/function appendEventQuickActions[\s\S]{0,1700}renderQuickReminderButton\(reminderButton, reminderRequested\)/.test(html), "initial card rendering must restore Reminder ON from persisted state");
assert(/function renderQuickReminderInstances[\s\S]{0,1000}data-reminder-action-key[\s\S]{0,500}renderQuickReminderButton/.test(html), "every rendered instance of the same fixture reminder must update together");
assert(/function toggleQuickReminder[\s\S]{0,1600}renderQuickReminderInstances\(ev, enabled, \{ pending:true \}\)[\s\S]{0,900}renderQuickReminderInstances\(ev, enabled\)[\s\S]{0,500}renderQuickReminderInstances\(ev, prior\.reminderRequested\)/.test(html), "reminder mutation must synchronise optimistic, committed and rolled-back states across cards");
assert(/async function backfillWebPushReminders[\s\S]{0,500}Notification\.permission !== "granted"/.test(html), "automatic reminder upgrades must never prompt for permission");
assert(!html.includes("scheduleBrowserReminders()") && !html.includes("deliverBrowserReminder"), "foreground timers must not duplicate server Web Push");
assert(/async function playIncomingChatSound[\s\S]{0,500}await prepareChatAudio\(\{ force \}\)/.test(html), "incoming chat sound must await AudioContext resume before checking playback state");
assert(html.includes('id="testChatSoundBtn"') && html.includes("await playIncomingChatSound({ force: true })"), "notification settings must provide an audible test through the real incoming-chat sound path even when the saved preference is off");

assert.equal(soundtrack.track.id, "skyscraper-samba");
assert.equal(soundtrack.track.src, "/assets/audio/sb_skyscrapersamba_eq_lessdrums.mp3");
assert.equal(soundtrack.track.artist, "Scott Buckley");
assert.equal(soundtrack.track.licence, "CC-BY 4.0");
assert.match(soundtrack.attribution, /'Skyscraper Samba' by Scott Buckley - released under CC-BY 4\.0/);
assert.equal(soundtrack.state().playing, false, "audio must remain off until the user explicitly starts it");
assert.equal(soundtrack.state().volume, 1, "the sole soundtrack must use full HTML media volume");

console.log("Web Push and soundtrack validation passed: reliable reminder wiring and one attributed Scott Buckley track at full app volume.");
