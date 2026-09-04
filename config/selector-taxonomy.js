(function attachSelectorTaxonomy(root, factory){
  const taxonomy = factory();
  root.NOTHINGSPORTS_SELECTOR_TAXONOMY = taxonomy;
  if (typeof module !== "undefined" && module.exports) module.exports = taxonomy;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildSelectorTaxonomy(){
  "use strict";

  const introducedAt = "2026-08-14T00:00:00+10:00";

  function freezeNode(node){
    return Object.freeze({
      ...node,
      path: Object.freeze(Array.isArray(node.path) ? node.path : [node.label]),
      canonicalSportKeys: Object.freeze(Array.isArray(node.canonicalSportKeys) ? node.canonicalSportKeys : []),
      childIds: Object.freeze(Array.isArray(node.childIds) ? node.childIds : []),
      underlyingSportIds: Object.freeze(Array.isArray(node.underlyingSportIds) ? node.underlyingSportIds : []),
    });
  }

  const categories = [
    freezeNode({
      id: "category:sports",
      level: 1,
      label: "Sports",
      path: ["Sports"],
      nodeType: "category",
      categoryType: "sport",
      glyph: "ui:filter",
      exposed: true,
      selectable: false,
      isNew: false,
      editorialOrder: 1,
    }),
  ];

  function sportNodeGlyph(id, domainId, canonicalSportKeys){
    if (id === "sport:afl") return "sport:australian-football";
    if (["sport:athletics", "sport:swimming", "sport:netball", "sport:hockey", "sport:gymnastics", "sport:boxing"].includes(id)){
      return "sport:multi-sport";
    }
    const domainGlyphs = {
      "sport:motorsport": "sport:motorsport",
      "sport:extreme": "sport:extreme",
      "sport:surf": "sport:surf",
      "sport:skiing": "sport:skiing",
      "sport:rugby": "sport:rugby",
      "sport:basketball": "sport:basketball",
      "sport:american-football": "sport:american-football",
      "sport:ice-hockey": "sport:ice-hockey",
      "sport:multi-sport": "sport:multi-sport",
      "sport:football": "sport:football",
    };
    return domainGlyphs[domainId] || `sport:${canonicalSportKeys[0]}`;
  }

  const sportNodes = [
    ["sport:afl", "AFL", "sport", null, ["afl"], "sport:australian-football", "sport:australian-football", 10],
    ["sport:nrl", "NRL", "sport", null, ["nrl"], "sport:rugby-league", "sport:rugby", 20],
    ["sport:motorsport", "Motorsport", "parent", null, ["motorsport"], "sport:motorsport", "sport:motorsport", 30, ["sport:f1", "sport:rally"]],
    ["sport:f1", "F1", "child", "sport:motorsport", ["f1"], "competition:formula-one", "sport:motorsport", 31],
    ["sport:rally", "Rally", "child", "sport:motorsport", ["rally"], "competition:world-rally", "sport:motorsport", 32],
    ["sport:extreme", "Extreme", "parent", null, ["extreme", "skateboard"], "sport:extreme-sports", "sport:extreme", 40, ["sport:downhill-mtb"]],
    ["sport:downhill-mtb", "MTB", "child", "sport:extreme", ["downhill-mtb", "mtb"], "competition:uci-mountain-bike", "sport:extreme", 41],
    ["sport:surf", "Surfing", "parent", null, ["surf", "wsl"], "sport:surfing", "sport:surf", 50, ["sport:big-wave"]],
    ["sport:big-wave", "Big-wave", "child", "sport:surf", ["big-wave"], "competition:big-wave-events", "sport:surf", 51],
    ["sport:skiing", "Snow", "parent", null, ["telemark"], "sport:winter-sports", "sport:skiing", 60, ["sport:alpine", "sport:freestyle"]],
    ["sport:alpine", "Alpine", "child", "sport:skiing", ["ski", "alpine"], "competition:fis-alpine", "sport:skiing", 61],
    ["sport:freestyle", "Freestyle", "child", "sport:skiing", ["freestyle"], "competition:fis-freestyle", "sport:skiing", 62],
    ["sport:rugby", "Rugby Union", "sport", null, ["rugby"], "sport:rugby-union", "sport:rugby", 70],
    ["sport:tennis", "Tennis", "sport", null, ["tennis", "wimbledon"], "sport:tennis", "sport:tennis", 80],
    ["sport:football", "Football", "parent", null, ["football", "fifa", "premier-league"], "sport:football", "sport:football", 90, ["sport:champions-league"]],
    ["sport:champions-league", "Champions League", "child", "sport:football", ["champions-league", "uefa-champions-league"], "competition:uefa-champions-league", "sport:football", 91],
    ["sport:cycling", "Cycling", "sport", null, ["cycling", "tdf"], "sport:cycling", "sport:cycling", 100],
    ["sport:cricket", "Cricket", "sport", null, ["cricket"], "sport:cricket", "sport:cricket", 110],
    ["sport:nba", "Basketball", "sport", null, ["nba", "basketball"], "sport:basketball", "sport:basketball", 120],
    ["sport:golf", "Golf", "sport", null, ["golf", "masters"], "sport:golf", "sport:golf", 130],
    ["sport:american-football", "American Football", "sport", null, ["nfl", "american-football"], "sport:american-football", "sport:american-football", 140],
    ["sport:athletics", "Athletics", "sport", null, ["athletics"], "sport:athletics", "sport:athletics", 150],
    ["sport:swimming", "Swimming", "sport", null, ["swimming"], "sport:swimming", "sport:swimming", 160],
    ["sport:netball", "Netball", "sport", null, ["netball"], "sport:netball", "sport:netball", 170],
    ["sport:ice-hockey", "Ice Hockey", "sport", null, ["ice-hockey", "nhl", "chl"], "sport:ice-hockey", "sport:ice-hockey", 180],
    ["sport:hockey", "Field Hockey", "sport", null, ["hockey"], "sport:hockey", "sport:hockey", 190, null, false],
    ["sport:gymnastics", "Gymnastics", "sport", null, ["gymnastics"], "sport:gymnastics", "sport:gymnastics", 200, null, false],
    ["sport:boxing", "Boxing", "sport", null, ["boxing"], "discipline:combat:boxing", "sport:boxing", 210],
    ["sport:multi-sport", "Commonwealth Games compatibility", "sport", null, ["cwg", "multi-sport"], "sport:multi-sport", "sport:multi-sport", 220, null, false],
  ].map(([id, label, relationship, parentId, canonicalSportKeys, taxonomyNodeId, domainId, editorialOrder, childIds, exposed = true]) => freezeNode({
    id,
    level: parentId ? 3 : 2,
    label,
    parentId: parentId || "category:sports",
    path: parentId ? ["Sports", sportNodesLabel(parentId), label] : ["Sports", label],
    nodeType: relationship === "parent" ? "parent" : relationship === "child" ? "child" : "sport",
    categoryType: "sport",
    canonicalSportKeys,
    taxonomyNodeId,
    domainId,
    childIds,
    exposed,
    selectable: exposed,
    glyph: sportNodeGlyph(id, domainId, canonicalSportKeys),
    isNew: exposed && ((relationship === "parent" && id !== "sport:football") || relationship === "child" || id === "sport:ice-hockey"),
    introducedAt,
    editorialOrder,
  }));

  function sportNodesLabel(parentId){
    return ({
      "sport:motorsport": "Motorsport",
      "sport:extreme": "Extreme",
      "sport:surf": "Surfing",
      "sport:skiing": "Snow",
      "sport:football": "Football",
    })[parentId] || parentId;
  }

  const internalEventTags = [
    ["special:commonwealth-games", "Commonwealth Games", ["sport:athletics", "sport:swimming", "sport:rugby", "sport:netball", "sport:cricket", "sport:hockey", "sport:gymnastics", "sport:cycling", "sport:boxing", "sport:multi-sport"], ["cwg"], "sport:multi-sport", 1],
    ["special:super-bowl", "Super Bowl", ["sport:american-football"], ["nfl"], "sport:american-football", 2],
    ["special:masters-tournament", "Masters Tournament", ["sport:golf"], ["masters"], "sport:golf", 3],
    ["special:fifa-world-cup", "FIFA World Cup", ["sport:football"], ["fifa"], "sport:football", 4],
    ["special:tour-de-france", "Tour de France", ["sport:cycling"], ["tdf"], "sport:cycling", 5],
    ["special:wimbledon", "Wimbledon", ["sport:tennis"], ["wimbledon"], "sport:tennis", 6],
    ["special:le-mans-24-hours", "24 Hours of Le Mans", ["sport:motorsport"], ["lemans"], "sport:motorsport", 7],
    ["special:goodwood-festival-of-speed", "Goodwood Festival of Speed", ["sport:motorsport"], ["goodwood"], "sport:motorsport", 8],
    ["special:cincinnati-open", "Cincinnati Open", ["sport:tennis"], ["cincinnati", "cincinnati-open"], "sport:tennis", 9],
  ].map(([id, label, underlyingSportIds, canonicalSportKeys, parentId, editorialOrder]) => freezeNode({
    id,
    level: 3,
    label,
    parentId,
    path: ["Internal event tags", label],
    nodeType: "internal-event-tag",
    categoryType: "internal-event-tag",
    canonicalSportKeys,
    underlyingSportIds,
    glyph: parentId === "sport:motorsport" ? "sport:motorsport"
      : parentId === "sport:tennis" ? "sport:tennis"
        : parentId === "sport:golf" ? "sport:golf"
          : parentId === "sport:football" ? "sport:football"
            : parentId === "sport:cycling" ? "sport:cycling"
              : parentId === "sport:american-football" ? "sport:american-football"
                : "sport:multi-sport",
    exposed: false,
    selectable: false,
    isNew: false,
    editorialOrder,
  }));

  const commonwealthDisciplines = [
    ["cwg:athletics", "Athletics", "athletics", "sport:athletics", 1],
    ["cwg:swimming", "Swimming", "swimming", "sport:swimming", 2],
    ["cwg:rugby-sevens", "Rugby Sevens", "rugby-sevens", "sport:rugby", 3],
    ["cwg:netball", "Netball", "netball", "sport:netball", 4],
    ["cwg:cricket", "Cricket", "cricket", "sport:cricket", 5],
    ["cwg:hockey", "Hockey", "hockey", "sport:hockey", 6],
    ["cwg:gymnastics", "Gymnastics", "gymnastics", "sport:gymnastics", 7],
    ["cwg:cycling", "Cycling", "cycling", "sport:cycling", 8],
    ["cwg:boxing", "Boxing", "boxing", "sport:boxing", 9],
    ["cwg:miscellaneous", "Miscellaneous", "miscellaneous", "sport:multi-sport", 10],
  ].map(([id, label, canonicalDiscipline, underlyingSportId, lockedSlot]) => freezeNode({
    id,
    level: 4,
    label,
    parentId: "special:commonwealth-games",
    path: ["Internal event tags", "Commonwealth Games", label],
    nodeType: "legacy-discipline-tag",
    categoryType: "internal-event-tag",
    canonicalDiscipline,
    underlyingSportIds: [underlyingSportId],
    exposed: false,
    selectable: false,
    lockedSlot,
    isNew: false,
  }));

  const nodes = Object.freeze([...categories, ...sportNodes, ...internalEventTags, ...commonwealthDisciplines]);
  const byId = Object.freeze(Object.fromEntries(nodes.map(node => [node.id, node])));

  return Object.freeze({
    version: "selector-taxonomy.v2",
    schemaVersion: "sports-discovery-hierarchy.v1",
    categories: Object.freeze(categories),
    nodes,
    byId,
    sportNodes: Object.freeze(sportNodes),
    exposedSportNodes: Object.freeze(sportNodes.filter(node => node.exposed)),
    internalEventTags: Object.freeze(internalEventTags),
    // Kept only as a non-selectable compatibility surface for deterministic migration.
    specialEvents: Object.freeze(internalEventTags),
    commonwealthDisciplines: Object.freeze(commonwealthDisciplines),
  });
});
