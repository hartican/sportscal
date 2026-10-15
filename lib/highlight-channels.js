'use strict';
// Server-only publisher registry. Ownership receipts: reviewed 2026-10-15.
// Resolve explicit competition/code identities before historical card keys.
const contract=require('../config/fixture-highlights');
const tennis=require('./fixture-highlights');
const publisher=(id,label,officialUrl,channelUrl)=>Object.freeze({id,label,officialUrl,channelUrl,reviewedAt:'2026-10-15'});
const channels=Object.freeze({
  afl:publisher('UCxAeHdLDAatFV_vt95MSO-g','AFL','https://www.afl.com.au/','https://www.youtube.com/user/BigPondAFL'),
  nbl:publisher('UCQOt5-Mc5m03JCO_W9SWySA','National Basketball League','https://www.nbl.com.au/','https://www.youtube.com/user/nbl'),
  mlb:publisher('UCoLrcjPV5PbUrUyXq5mjc_A','MLB','https://www.mlb.com/','https://www.youtube.com/mlb'),
  f1:publisher('UCB_qr75-ydFVKSF9Dmo6izg','FORMULA 1','https://www.formula1.com/','https://www.youtube.com/F1'),
  rugby:publisher('UCE28rwYoaV7jvU6GVzdu_GQ','World Rugby','https://www.world.rugby/','https://www.youtube.com/worldrugby'),
  epl:publisher('UCG5qGWdu8nIRZqJ_GgDwQ-w','Premier League','https://www.premierleague.com/','https://www.youtube.com/premierleague'),
  bundesliga:publisher('UC6UL29enLNe4mqwTfAyeNuw','Bundesliga','https://www.bundesliga.com/en/bundesliga','https://www.youtube.com/@bundesliga'),
  laliga:publisher('UCTv-XvfzLX3i4IGWAm4sbmA','LALIGA','https://www.laliga.com/en-GB','https://www.youtube.com/user/laliga'),
  aleagues:publisher('UCzRogd_oK3bzKvAW-4aLuPQ','A-Leagues','https://aleagues.com.au/','https://www.youtube.com/channel/UCzRogd_oK3bzKvAW-4aLuPQ'),
  uefa:publisher('UCyGa1YEx9ST66rYrJTGIKOw','UEFA','https://www.uefa.com/','https://www.youtube.com/user/UEFA'),
  cricket:publisher('UC2naOExy27J5Qz3SO-w6xkQ','Cricket Australia','https://www.cricket.com.au/','https://www.youtube.com/@CricketAus'),
  icc:publisher('UCt2JXOLNxqry7B_4rRZME3Q','ICC','https://www.icc-cricket.com/','https://www.youtube.com/@ICC'),
  nfl:publisher('UCDVYQ4Zhbm3S2dlz7P1GBDg','NFL','https://www.nfl.com/','https://www.youtube.com/NFL'),
  sailgp:publisher('UC8Z3si9YuOzrJN-4dVpW5Jw','SailGP','https://www.sailgp.com/','https://www.youtube.com/channel/UC8Z3si9YuOzrJN-4dVpW5Jw'),
  wsl:publisher('UChuLeaTGRcfzo0UjL-2qSbQ','World Surf League','https://www.worldsurfleague.com/','https://www.youtube.com/wsl'),
  wec:publisher('UCwU7U7PiarcJKLjDJTnANjw','FIA World Endurance Championship','https://www.fiawec.com/','https://www.youtube.com/@FIAWEC'),
  pga:publisher('UCKwGZZMrhNYKzucCtTPY2Nw','PGA TOUR','https://www.pgatour.com/','https://www.youtube.com/pgatour'),
  lpga:publisher('UCWZbPo5_riXyCFDyaMl2yRA','LPGA','https://www.lpga.com/','https://www.youtube.com/@LPGA'),
  supercars:publisher('UCcCBrelNGfpchXKLFt8gtKg','Supercars','https://www.supercars.com/','https://www.youtube.com/@SupercarsChampionship'),
  seriea:publisher('UCBJeMCIeLQos7wacox4hmLQ','Serie A','https://www.legaseriea.it/','https://www.youtube.com/@seriea'),
  ligue1:publisher('UCQsH5XtIc9hONE1BQjucM0g','Ligue 1','https://ligue1.com/','https://www.youtube.com/@Ligue1'),
  nrl:publisher('UC33-OkQ6VCYk8xtml8Pk4-g','NRL','https://www.nrl.com/','https://www.youtube.com/@NRL'),
  nba:publisher('UCWJ2lWNubArHWmf3FIHbfcQ','NBA','https://www.nba.com/','https://www.youtube.com/@NBA'),
  wrc:publisher('UC5G6kTnHXDz0WIBC2VGBOqg','WRC','https://www.wrc.com/','https://www.youtube.com/@wrc'),
  fifa:publisher('UCpcTrCXblq78GZrTUTLWeBw','FIFA','https://www.fifa.com/','https://www.youtube.com/@FIFA'),
  fiba:publisher('UCtInrnU3QbWqFGsdKT1GZtg','FIBA','https://www.fiba.basketball/','https://www.youtube.com/@FIBA'),
  tdf:publisher('UCSpycUnuU0IVF7gGIhGojhg','Tour de France','https://www.letour.fr/','https://www.youtube.com/@letourdefrance'),
  giro:publisher('UCe10BxbsFg9Kbmkg-ean_Dg','Giro Italia','https://www.giroditalia.it/','https://www.youtube.com/@giroditalia'),
  freestyle:publisher('UCkz7PwJ-CDJuu4HpxLNtnZA','FIS Freestyle Skiing','https://www.fis-ski.com/','https://www.youtube.com/@FISFreestyle'),
  pgaChampionship:publisher('UCnUYyAtDiyeaobSzKqVE_BA','PGA Championships','https://www.pgachampionship.com/','https://www.youtube.com/@PGAChampionship'),
  netball:publisher('UC84KF8G9Nhor7wx2wOGN87g','Netball Australia','https://netball.com.au/','https://www.youtube.com/@NetballAustralia'),
  nhl:publisher('UCqFMzb-4AUf6WAIbl132QKA','NHL','https://www.nhl.com/','https://www.youtube.com/@NHL'),
  uci:publisher('UCloqTh1nPpW13LCntQglS-Q','UCI','https://www.uci.org/','https://www.youtube.com/user/ucichannel'),
  motogp:publisher('UC8pYaQzbBBXg9GIOHRvTmDQ','MotoGP','https://www.motogp.com/','https://www.youtube.com/@motogp')
});
const rules=[
  [/^supercars$/,['supercars']], [/^serie-a$/,['seriea']], [/^ligue-1$/,['ligue1']],
  [/^(?:nrl|nrlw|nrl-premiership|nrlw-premiership)$/,['nrl']],
  [/^(?:nba|nba-eastern-conference|nba-western-conference)$/,['nba']],
  [/^(?:wrc|wrc-drivers|wrc-co-drivers|wrc-manufacturers|world-rally-championship)$/,['wrc']],
  [/^(?:fifa|fifa-world-cup|fifa-womens-world-cup|football:international-friendlies)$/,['fifa']],
  [/^(?:fiba-women|fiba-womens-world-cup|fiba-world-cup)$/,['fiba']],
  [/^(?:tdf|tour-de-france)$/,['tdf']], [/^(?:giro|giro-ditalia)$/,['giro']],
  [/^(?:cycling|downhill-mtb|uci-.*)$/,['uci']], [/^fis-freestyle$/,['freestyle']], [/^(?:golf:)?pga-championship$/,['pgaChampionship']],
  [/^(?:netball|constellation-cup|super-netball)$/,['netball']], [/^(?:nhl|ice-hockey)$/,['nhl']],
  [/^(?:nbl|national-basketball-league)$/,['nbl']],
  [/^(?:afl|afl-premiership|aflw)$/,['afl']],
  [/^(?:mlb|baseball)$/,['mlb']],
  [/^(?:f1|formula-one|formula-one-world-championship|f1-drivers|f1-constructors)$/,['f1']],
  [/^(?:rugby|rugby-union|rugby-world-cup|womens-rugby-world-cup|bledisloe-cup|rugby-championship)$/,['rugby']],
  [/^premier-league$/,['epl']], [/^bundesliga$/,['bundesliga']], [/^(?:la-liga|laliga)$/,['laliga']],
  [/^(?:a-league|a-league-men|a-league-women|a-leagues|a-league-womens)$/,['aleagues']],
  [/^(?:uefa-champions-league|uefa-europa-league|uefa-conference-league|uefa-womens-champions-league|uefa-nations-league|uefa-euro)$/,['uefa']],
  [/^(?:cricket|icc-.*|cricket:.*)$/,['cricket','icc']],
  [/^(?:nfl|american-football)$/,['nfl']], [/^sailgp$/,['sailgp']],
  [/^(?:wsl|wsl-championship-tour|big-wave)$/,['wsl']], [/^(?:le-mans|lemans|fia-wec)$/,['wec']],
  [/^(?:pga-tour|presidents-cup)$/,['pga']], [/^lpga-tour$/,['lpga']], [/^(?:motogp|motogp-world-championship)$/,['motogp']]
];
const identity=value=>String(value||'').toLowerCase().replace(/^(?:competition|sport|family):/,'').replace(/-20\d\d(?:-\d{2,4})?$/,'');
function channelsFor(event={}){
  if(contract.tennisEligible(event))return tennis.channels.filter(c=>!(c.tour==='ATP'&&tennis.draw(event).startsWith('womens')||c.tour==='WTA'&&tennis.draw(event).startsWith('mens'))&&(!c.tournamentPattern||new RegExp(c.tournamentPattern,'i').test(tennis.tournament(event))));
  // An explicit competition is authoritative; never reinterpret e.g. NBL as NBA.
  const competition=identity(event.competitionId),code=identity(event.codeId);
  const specific=competition||code;
  const identifiers=competition?[competition]:[code].filter(Boolean);
  if(!specific||!competition&&['basketball','football','surf','cycling','multi-sport'].includes(code))identifiers.push(identity(event.key||event.sportKey));
  for(const value of identifiers){const rule=rules.find(([pattern])=>pattern.test(value));if(rule)return rule[1].map(key=>channels[key]).slice(0,4);}
  return [];
}
module.exports={channels,channelsFor};
