(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingsport-brand.v2",
    name: "nothingsport",
    title: "Nothingsport — Sports feed orchestrator",
    descriptor: "Sports feed orchestrator",
    hero: "Your sports, orchestrated.",
    about: "nothingsport is a sports feed orchestrator: one calm, personalised view of the events that matter to you. It brings fixtures, stakes, spoiler-safe context, where-to-watch details and reminders into a single feed, then filters out the noise. Choose the sports, competitions, teams and competitors you follow once; nothingsport ranks what is worth your attention, keeps your calendar in sync and stays quiet when nothing merits it. Built around AEST/AEDT by default, it adapts to other time zones.",
    metadataDescription: "A personalised, spoiler-safe sports feed for what matters, when it matters, and where to watch.",
    onboardingDescription: "Choose what you follow once. nothingsport orchestrates the events, stakes, where-to-watch details and reminders that matter.",
    emptyStateDescription: "Nothing in your current filter deserves your time right now.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
