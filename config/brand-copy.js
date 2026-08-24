(function attachNothingSportsBrand(root){
  const brand = Object.freeze({
    version: "nothingsport-brand.v6",
    name: "nothingsport",
    title: "Nothingsport — Smart sports feed",
    descriptor: "Live sports curator, tailored to your tastes — like having a sports-fanatic mate in your pocket.",
    hero: "The sports-fanatic mate who knows what you’re into.",
    about: "nothingsport curates live sport around your tastes, learning from what you follow and rate so the feed gets more useful over time. It surfaces the matches and events most worth your attention, keeps results hidden until you choose to reveal them, and helps you catch major live moments without trawling every fixture. Use Sports followed & Tune in Settings to shape the curated mix, or open Inspector for a read-only code-level fixture drill-down. Built around AEST/AEDT by default, it adapts to other time zones.",
    metadataDescription: "Live sports curator, tailored to your tastes — like having a sports-fanatic mate in your pocket.",
    onboardingDescription: "Choose what you follow once. nothingsport keeps the feed smart, spoiler-safe and focused on moments worth your attention.",
    emptyStateDescription: "Nothing in your current filter deserves your time right now.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
