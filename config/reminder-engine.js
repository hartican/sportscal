(function attachNothingSportsReminderEngine(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_REMINDER_ENGINE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildReminderEngine(){
  "use strict";

  const SCHEMA_VERSION = "reminder-schedule.v1";
  const MAX_TIMER_MS = 24 * 24 * 60 * 60 * 1000;

  function eventStart(event){
    if (event.startTimeUtc){
      const parsed = new Date(event.startTimeUtc);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (event.date){
      const parsed = new Date(`${event.date}T${event.time || "00:00"}:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  function uniqueLeadMinutes(values){
    return Array.from(new Set((Array.isArray(values) ? values : [values])
      .map(Number)
      .filter(value => Number.isInteger(value) && value >= 0 && value <= 10080)))
      .sort((first, second) => first - second);
  }

  function reminderKey(eventId, startTime, leadMinutes){
    return `reminder:${eventId}:${startTime}:${leadMinutes}`;
  }

  function buildSchedule(events, {
    now = new Date(),
    leadMinutes = [60],
    shouldRemind = () => true,
    deliveredKeys = [],
  } = {}){
    const reference = now instanceof Date ? now : new Date(now);
    const delivered = new Set(deliveredKeys);
    const leads = uniqueLeadMinutes(leadMinutes);
    const reminders = [];
    (Array.isArray(events) ? events : []).forEach(event => {
      if (!shouldRemind(event)) return;
      const start = eventStart(event);
      const eventId = String(event.eventId || event.id || "");
      if (!start || !eventId || start <= reference) return;
      leads.forEach(lead => {
        const remindAt = new Date(start.getTime() - lead * 60 * 1000);
        const key = reminderKey(eventId, start.toISOString(), lead);
        if (remindAt <= reference || delivered.has(key)) return;
        reminders.push({
          key,
          eventId,
          title: event.displayTitleCompact || event.name || "Upcoming sport",
          body: `${lead < 60 ? `${lead} minutes` : lead === 60 ? "1 hour" : lead % 1440 === 0 ? `${lead / 1440} day${lead === 1440 ? "" : "s"}` : `${lead / 60} hours`} until start${event.broadcaster ? ` · ${event.broadcaster}` : ""}`,
          startTime: start.toISOString(),
          remindAt: remindAt.toISOString(),
          leadMinutes: lead,
        });
      });
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: reference.toISOString(),
      reminders: reminders.sort((first, second) => first.remindAt.localeCompare(second.remindAt) || first.key.localeCompare(second.key)),
    };
  }

  function schedulableReminders(schedule, now = new Date()){
    const reference = now instanceof Date ? now : new Date(now);
    return (schedule?.reminders || []).filter(reminder => {
      const delay = new Date(reminder.remindAt).getTime() - reference.getTime();
      return delay > 0 && delay <= MAX_TIMER_MS;
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    MAX_TIMER_MS,
    uniqueLeadMinutes,
    reminderKey,
    buildSchedule,
    schedulableReminders,
  });
});
