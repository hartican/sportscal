(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingSports-brand.v1",
    name: "nothingSports",
    hero: "A smart sports streaming filter that knows what to show you — and what to leave out.",
    about: "nothingSports is a smart sports streaming filter that knows what to show you and what to leave out. It keeps your most important games in one place, without the back-and-forth of checking websites and streaming services. Set it up once, and it quietly handles the rest. It learns what you follow, surfaces the highest-stakes events, shows where to watch them, and stays quiet when nothing deserves your time. Sync with your calendar for reminders across devices. Built around AEST/AEDT by default, it can easily adapt to other time zones.",
    metadataDescription: "A smart sports streaming filter for high-stakes events, reminders, and where to watch.",
    onboardingDescription: "Choose what you follow once. nothingSports will surface the highest-stakes events, show where to watch, and stay quiet when nothing matters.",
    emptyStateDescription: "Nothing in your current filter deserves your time right now.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
