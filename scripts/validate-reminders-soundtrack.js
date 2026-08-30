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
assert(/async function toggleQuickReminder[\s\S]{0,1200}await ensureWebPushReminder\(ev, timing\)[\s\S]{0,500}await removeWebPushReminder\(ev\)/.test(html), "reminder creation and cancellation must wait for the server");
assert(/async function backfillWebPushReminders[\s\S]{0,500}Notification\.permission !== "granted"/.test(html), "automatic reminder upgrades must never prompt for permission");
assert(!html.includes("scheduleBrowserReminders()") && !html.includes("deliverBrowserReminder"), "foreground timers must not duplicate server Web Push");

assert.equal(soundtrack.track.id, "skyscraper-samba");
assert.equal(soundtrack.track.src, "/assets/audio/sb_skyscrapersamba_eq_lessdrums.mp3");
assert.equal(soundtrack.track.artist, "Scott Buckley");
assert.equal(soundtrack.track.licence, "CC-BY 4.0");
assert.match(soundtrack.attribution, /'Skyscraper Samba' by Scott Buckley - released under CC-BY 4\.0/);
assert.equal(soundtrack.state().playing, false, "audio must remain off until the user explicitly starts it");
assert.equal(soundtrack.state().volume, 1, "the sole soundtrack must use full HTML media volume");

console.log("Web Push and soundtrack validation passed: reliable reminder wiring and one attributed Scott Buckley track at full app volume.");
