#!/usr/bin/env node

const assert = require("node:assert/strict");
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

assert.deepEqual(soundtrack.styles.map(style => style.id), ["elevator", "epic", "metal"]);
assert(soundtrack.styles.every(style => !/miley|artist|playlist/i.test(style.label)), "soundtrack labels must remain neutral genres");
assert.match(soundtrack.attribution, /procedural audio/i);
assert.equal(soundtrack.state().playing, false, "audio must remain off until the user explicitly starts it");

console.log("Reminder and soundtrack validation passed.");
