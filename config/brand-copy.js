(function attachNothingSportsBrand(root){
  // Long-form copy travels with the optional Settings bundle, not startup.
  const settingsCopy = typeof NOTHINGSPORTS_DEFER_SETTINGS_COPY !== "undefined" && NOTHINGSPORTS_DEFER_SETTINGS_COPY ? {} : Object.freeze({
    about: "Nothing Sport is a live sports curator, tailored to your tastes and free from betting content and gambling promotion. You can love sport without supporting sports gambling.\n\nWe help you find fixtures worth your time, understand what makes them matter, and follow the sports, teams and players you care about. Explore tournaments in Events, and schedules, ladders and standings in Follow.\n\nSkill, rivalry, suspense and shared moments are already plenty to get excited about. Nothing Sport helps you enjoy them.",
    productCharter: Object.freeze({
      title: "Product Charter",
      introduction: "Nothing Sport exists to make it easier to find, follow and enjoy sport. Our vision is a place where sport itself gives you every reason to care.",
      commitments: Object.freeze([
        Object.freeze({ title: "Enjoyment comes first.", body: "Sport offers extraordinary skill, compelling stories, fierce rivalries and moments worth sharing. We want you to spend less time searching and more time enjoying the sport that matters to you." }),
        Object.freeze({ title: "Independent of gambling.", body: "Our commitment covers Nothing Sport’s own content, features and funding. We will not offer betting products, betting odds or betting tips, carry gambling advertising, accept bookmaker sponsorships, or earn betting affiliate revenue." }),
        Object.freeze({ title: "Trustworthy coverage.", body: "We research our editorial context, prefer official sources, make uncertainty clear and correct errors. Commercial interests must not determine our editorial judgments." }),
        Object.freeze({ title: "Follow on your terms.", body: "Your interests guide your experience. You choose what to follow, whether to show scores and which reminders to receive. We aim to make sport fit into your life and respect your attention." }),
        Object.freeze({ title: "Every fan is welcome.", body: "Nothing Sport welcomes longstanding fans, newcomers and people reconnecting with sport without betting. We keep the focus on sport and treat people’s histories and choices with respect." }),
      ]),
      coverage: "Horse-racing coverage is limited to basic Melbourne Cup event information. NS does not provide runner details, race analysis or results. Factual competition names and sporting imagery may include existing sponsors; their appearance does not represent a gambling partnership or endorsement by Nothing Sport.",
    }),
  });
  const brand = Object.freeze(typeof NOTHINGSPORTS_SETTINGS_COPY_ONLY !== "undefined" && NOTHINGSPORTS_SETTINGS_COPY_ONLY ? {
    ...root.NOTHINGSPORTS_BRAND,
    ...settingsCopy,
  } : {
    version: "nothingsport-brand.v13",
    name: "Nothing Sport",
    officialName: "Nothing Sport",
    stylisedName: "nothing SPORT",
    title: "Nothing Sport — Smart sports feed",
    copyright: "Copyright ©\u00A02026\u00A0Nothing Sport. All Rights Reserved.",
    social: Object.freeze({
      instagram: Object.freeze({ handle: "@_nothingsport", url: "https://www.instagram.com/_nothingsport/", status: "active" }),
      x: Object.freeze({ handle: "@nothingsport", status: "coming soon" }),
      linkedin: Object.freeze({ handle: "@nothingsport", status: "coming soon" }),
    }),
    descriptor: "Live sport, nothing missed.",
    loadingDescriptor: "Live sport, nothing missed.",
    hero: "Live sport, nothing missed.",
    ...settingsCopy,
    countryAcknowledgement: "Nothing Sport acknowledges the Yuin Nation, the Traditional Custodians of the land on which this app was built. Always was, always will be Aboriginal land. Voice. Treaty. Truth.",
    metadataDescription: "Live sport, nothing missed.",
    onboardingDescription: "Nothing Sport is free from betting content and gambling promotion. Choose the sports you love, then refine teams and players in Follow.",
    emptyStateDescription: "No known fixtures match your current follows and filters.",
    timezoneDescription: "Built around AEST/AEDT by default, with other time zones supported as your profile travels.",
  });

  root.NOTHINGSPORTS_BRAND = brand;
  if (typeof module !== "undefined" && module.exports) module.exports = brand;
})(typeof globalThis !== "undefined" ? globalThis : window);
