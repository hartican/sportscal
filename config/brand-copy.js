(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingsport-brand.v3",
    name: "nothingsport",
    title: "Nothingsport — Smart sports feed",
    descriptor: "Smart sports feed. Nothing boring. Nothing spoiled. No big moments missed.",
    hero: "Follow live sport without the clutter.",
    about: "nothingsport is a smarter way to follow live sport without wading through low-value fixtures. Its personalised feed surfaces the matches and events worth your attention, keeps browsing spoiler-safe, and helps you catch major live moments without the clutter. Choose Froth when you want every eligible fixture, or focus on one sport for its full fixture view; the pinned filter can stay visible as you scroll or tuck away while your selection remains active. Built around AEST/AEDT by default, it adapts to other time zones.",
    metadataDescription: "Smart sports feed. Nothing boring. Nothing spoiled. No big moments missed.",
    onboardingDescription: "Choose what you follow once. nothingsport keeps the feed smart, spoiler-safe and focused on moments worth your attention.",
    emptyStateDescription: "Nothing in your current filter deserves your time right now.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
