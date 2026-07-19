(function configureAuBroadcastWeights(root){
  root.NOTHINGSPORTS_AU_BROADCAST_CONFIG = Object.freeze({
    defaultWeight: 0,
    profiles: Object.freeze([
      Object.freeze({ broadcasterKey: "sbs", aliases: ["sbs", "sbs on demand"], weight: 5.0 }),
      Object.freeze({ broadcasterKey: "nine", aliases: ["nine", "9now"], weight: 4.9 }),
      Object.freeze({ broadcasterKey: "seven", aliases: ["seven", "7plus"], weight: 4.9 }),
      Object.freeze({ broadcasterKey: "abc", aliases: ["abc", "abc iview"], weight: 4.8 }),
      Object.freeze({ broadcasterKey: "ten", aliases: ["network 10", "10 play", "10 bold"], weight: 4.7 }),
      Object.freeze({ broadcasterKey: "kayo", aliases: ["kayo", "kayo sports"], weight: 4.4 }),
      Object.freeze({ broadcasterKey: "foxtel", aliases: ["foxtel"], weight: 4.2 }),
      Object.freeze({ broadcasterKey: "stan", aliases: ["stan sport"], weight: 4.1 }),
      Object.freeze({ broadcasterKey: "espn", aliases: ["espn"], weight: 4.0 }),
      Object.freeze({ broadcasterKey: "fis", aliases: ["fis broadcast"], weight: 2.5 }),
    ]),
  });
})(globalThis);
