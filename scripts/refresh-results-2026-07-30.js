#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const inputPath = path.resolve(process.argv[2] || "feeds/incoming/events.json");
const sourceCheckedAt = "2026-07-30T01:11:08+10:00";
const lastReviewedAt = "2026-07-29T15:11:08.000Z";

const official = (sourceName, sourceUrl, result) => ({
  ...result,
  sourceName,
  sourceUrl,
  sourceCheckedAt,
  sourceType: "official",
  lastReviewedAt,
});

const results = {
  "f1-australian-gp-2027-ticket-watch": official(
    "Formula 1 Australian Grand Prix ticket waitlist",
    "https://www.grandprix.com.au/tickets",
    {
      score: "2027 ticket on-sale date: not announced",
      outcomeText: "The watch window closed with no confirmed 2027 Australian Grand Prix ticket on-sale date.",
      recapText: "No verified on-sale date emerged during this alert window. The official ticket page continues to offer registration and waitlist updates.",
      resultLabels: ["Ticket watch closed", "No confirmed sale date", "Official waitlist"],
    }
  ),
  evt_61: official(
    "Tour de France stage 16 report",
    "https://www.letour.fr/en/news/2026/king-evenepoel-conquers-lake-geneva-on-belgium-day/1350635?stage=16&stageType=stage",
    {
      score: "Stage winner: Remco Evenepoel (32:19)",
      outcomeText: "Remco Evenepoel won the Stage 16 time trial, 28 seconds ahead of Tadej Pogačar.",
      recapText: "Evenepoel covered the 26km Lake Geneva time trial in 32:19. Pogačar finished second at 28 seconds and Mattias Skjelmose was third at 1:04.",
      resultLabels: ["Stage 16", "Evenepoel winner", "Official result"],
      consensusResult: {
        winner: "Remco Evenepoel",
        summary: "Evenepoel won the Stage 16 individual time trial in 32:19.",
        marginText: "Pogačar +28 seconds",
      },
    }
  ),
  evt_62: official(
    "Tour de France stage 17 report",
    "https://www.letour.fr/en/news/2026/philipsen-finds-more-than-redemption-in-voiron/1351787",
    {
      score: "Stage winner: Jasper Philipsen",
      outcomeText: "Jasper Philipsen won Stage 17 in Voiron ahead of Mauro Schmid and Olav Kooij.",
      recapText: "Philipsen delivered the winning sprint in Voiron, with Schmid second and Kooij third after the flat 175km stage from Chambéry.",
      resultLabels: ["Stage 17", "Philipsen winner", "Official result"],
      consensusResult: {
        winner: "Jasper Philipsen",
        summary: "Philipsen won the Stage 17 sprint in Voiron.",
        marginText: "Schmid second; Kooij third",
      },
    }
  ),
  evt_63: official(
    "Tour de France stage 18 report",
    "https://www.letour.fr/en/news/2026/stage-18/carapaz-takes-his-attacking-crown-in-orcieres-merlette/1353035",
    {
      score: "Stage winner: Richard Carapaz",
      outcomeText: "Richard Carapaz won Stage 18 at Orcières-Merlette, 45 seconds ahead of Mauro Schmid.",
      recapText: "Carapaz completed a decisive mountain attack to take the stage. Schmid finished second at 45 seconds and Matteo Jorgenson placed third.",
      resultLabels: ["Stage 18", "Carapaz winner", "Official result"],
      consensusResult: {
        winner: "Richard Carapaz",
        summary: "Carapaz won the Stage 18 mountain finish at Orcières-Merlette.",
        marginText: "Schmid +45 seconds",
      },
    }
  ),
  "event-nrl-129992102": official(
    "NRL match centre",
    "https://www.nrl.com/draw/nrl-premiership/2026/round-21/knights-v-roosters/",
    {
      score: "Newcastle Knights 22-23 Sydney Roosters",
      outcomeText: "The Roosters edged Newcastle 23-22 through a late Daly Cherry-Evans field goal.",
      recapText: "A 77th-minute Cherry-Evans field goal separated the sides after the Knights and Roosters traded momentum in a one-point Round 21 finish.",
      resultLabels: ["NRL Round 21", "Roosters by 1", "Official result"],
      consensusResult: {
        winner: "Sydney Roosters",
        loser: "Newcastle Knights",
        summary: "The Roosters beat Newcastle 23-22.",
        marginText: "Roosters by 1",
      },
    }
  ),
  "cwg-glasgow-2026-3x3-australia-opening": official(
    "Glasgow 2026 3x3 session report",
    "https://www.glasgow2026.com/news/4546385/australia-set-the-pace-in-basketball-3x3-while-england-start-strong-in-wheelchair-competition",
    {
      score: "Australia men 3-0; Australia women 3-0",
      outcomeText: "Australia's men's and women's 3x3 teams each completed an unbeaten opening session.",
      recapText: "The men beat New Zealand 21-15, Nigeria 21-15 and Scotland 21-14. The women defeated Kenya 21-5, Jamaica 21-13 and Fiji 21-3.",
      resultLabels: ["Basketball 3x3", "Australia men 3-0", "Australia women 3-0"],
    }
  ),
  "event-afl-cd_m20260142008": official(
    "AFL match centre",
    "https://www.afl.com.au/afl/matches/8205",
    {
      score: "Melbourne 14.13 (97) lost to Geelong Cats 18.9 (117)",
      outcomeText: "Geelong defeated Melbourne by 20 points after a strong finish at the MCG.",
      recapText: "The Cats pulled away to win 117-97, with Shannon Neale kicking five goals as Geelong strengthened its position near the top of the ladder.",
      resultLabels: ["AFL Round 20", "Geelong by 20", "Official result"],
      consensusResult: {
        winner: "Geelong Cats",
        loser: "Melbourne",
        summary: "Geelong defeated Melbourne 117-97.",
        marginText: "Geelong by 20 points",
      },
    }
  ),
  "event-nrl-129992103": official(
    "NRL match centre",
    "https://www.nrl.com/draw/nrl-premiership/2026/round-21/rabbitohs-v-storm/",
    {
      score: "South Sydney Rabbitohs 28-26 Melbourne Storm",
      outcomeText: "South Sydney held off Melbourne 28-26 in a two-point Round 21 finish.",
      recapText: "Campbell Graham's 75th-minute try proved decisive as the Rabbitohs absorbed a late Storm push and closed out the home win.",
      resultLabels: ["NRL Round 21", "Rabbitohs by 2", "Official result"],
      consensusResult: {
        winner: "South Sydney Rabbitohs",
        loser: "Melbourne Storm",
        summary: "South Sydney beat Melbourne 28-26.",
        marginText: "Rabbitohs by 2",
      },
    }
  ),
  "event-afl-cd_m20260142004": official(
    "AFL match centre",
    "https://www.afl.com.au/afl/matches/8210",
    {
      score: "Fremantle 16.16 (112) defeated West Coast Eagles 6.6 (42)",
      outcomeText: "Fremantle won the Western Derby by 70 points.",
      recapText: "The Dockers controlled the derby to win 112-42. Murphy Reid earned the Glendinning-Allan Medal after a 26-disposal performance.",
      resultLabels: ["AFL Round 20", "Fremantle by 70", "Official result"],
      consensusResult: {
        winner: "Fremantle",
        loser: "West Coast Eagles",
        summary: "Fremantle defeated West Coast 112-42.",
        marginText: "Fremantle by 70 points",
      },
    }
  ),
  evt_64: official(
    "Tour de France stage 19 result",
    "https://www.letour.fr/en/stage-19",
    {
      score: "Stage winner: Tadej Pogačar",
      outcomeText: "Tadej Pogačar won Stage 19 on Alpe d'Huez.",
      recapText: "Pogačar took the first of the Tour's back-to-back Alpe d'Huez summit finishes, adding another mountain-stage victory to his race lead.",
      resultLabels: ["Stage 19", "Pogačar winner", "Official result"],
      consensusResult: {
        winner: "Tadej Pogačar",
        summary: "Pogačar won Stage 19 on Alpe d'Huez.",
        marginText: "Official stage winner",
      },
    }
  ),
  "cwg-glasgow-2026-para-powerlifting-finals": official(
    "Glasgow 2026 Para Powerlifting finals reports",
    "https://www.glasgow2026.com/news/4546365/records-tumble-as-nigeria-confirm-para-powerlifting-dominance",
    {
      score: "Gold: Mark Swan; Esther Nworgu; Folashade Oluwafemiayo; Riluwan Idris",
      outcomeText: "Nigeria won three of four Para Powerlifting finals, with England's Mark Swan taking men's lightweight gold.",
      recapText: "Swan won men's lightweight; Nworgu won women's lightweight; Oluwafemiayo set a 175kg world record in women's heavyweight; and Idris won men's heavyweight with 208kg.",
      resultLabels: ["Four medal finals", "Nigeria three golds", "Oluwafemiayo world record"],
    }
  ),
  "cwg-glasgow-2026-gymnastics-mens-team-final": official(
    "Glasgow 2026 men's team final report",
    "https://www.glasgow2026.com/news/4546398/canada-maintain-focus-to-win-men-s-team-gold",
    {
      score: "Canada 241.400; England 238.250; Australia 235.650",
      outcomeText: "Canada won the men's artistic gymnastics team title ahead of England and Australia.",
      recapText: "Canada held its focus through the final rotation to score 241.400. England took silver on 238.250 and Australia earned bronze on 235.650.",
      resultLabels: ["Men's team final", "Canada gold", "Australia bronze"],
    }
  ),
  "cwg-glasgow-2026-swimming-opening-finals": official(
    "Glasgow 2026 opening swimming finals report",
    "https://www.glasgow2026.com/news/4546397/forrester-doubles-up-for-australia-as-chad-le-clos-hits-new-heights",
    {
      score: "Australia won both 4x100m freestyle relays",
      outcomeText: "Australia won the opening men's and women's 4x100m freestyle relay titles.",
      recapText: "Australia's women won in 3:31.40 before the men set a Games record of 3:09.49. The opening finals also featured individual golds for Lani Pallister, Jenna Forrester and Duncan Scott.",
      resultLabels: ["Swimming opening finals", "Australia relay double", "Men's Games record"],
    }
  ),
  "event-afl-cd_m20260142003": official(
    "AFL match centre",
    "https://www.afl.com.au/afl/matches/8201",
    {
      score: "Carlton 16.14 (110) defeated Gold Coast SUNS 15.7 (97)",
      outcomeText: "Carlton defeated Gold Coast by 13 points at the MCG.",
      recapText: "The Blues rallied late to win 110-97, denying the Suns in a high-scoring contest and damaging Gold Coast's finals push.",
      resultLabels: ["AFL Round 20", "Carlton by 13", "Official result"],
      consensusResult: {
        winner: "Carlton",
        loser: "Gold Coast SUNS",
        summary: "Carlton defeated Gold Coast 110-97.",
        marginText: "Carlton by 13 points",
      },
    }
  ),
  "nrl-raiders-tigers-2026-07-25": official(
    "NRL Round 21 live report",
    "https://www.nrl.com/news/2026/07/25/super-saturday-raiders-v-wests-tigers-bulldogs-v-warriors-cowboys-v-broncos/",
    {
      score: "Canberra Raiders 56-10 Wests Tigers",
      outcomeText: "Canberra ran in ten tries to defeat Wests Tigers 56-10.",
      recapText: "The Raiders produced their biggest win of the season, controlling the contest from the opening exchanges and completing a 46-point victory.",
      resultLabels: ["NRL Round 21", "Raiders by 46", "Official result"],
      consensusResult: {
        winner: "Canberra Raiders",
        loser: "Wests Tigers",
        summary: "Canberra defeated Wests Tigers 56-10.",
        marginText: "Raiders by 46",
      },
    }
  ),
  "event-afl-cd_m20260142006": official(
    "AFL match centre",
    "https://www.afl.com.au/afl/matches/8206",
    {
      score: "Hawthorn 19.18 (132) defeated Essendon 5.9 (39)",
      outcomeText: "Hawthorn defeated Essendon by 93 points at the MCG.",
      recapText: "The Hawks dominated from early in the contest to win 132-39, with Jack Gunston kicking seven goals in the emphatic Round 20 victory.",
      resultLabels: ["AFL Round 20", "Hawthorn by 93", "Official result"],
      consensusResult: {
        winner: "Hawthorn",
        loser: "Essendon",
        summary: "Hawthorn defeated Essendon 132-39.",
        marginText: "Hawthorn by 93 points",
      },
    }
  ),
  "event-afl-cd_m20260142005": official(
    "AFL match centre",
    "https://www.afl.com.au/afl/matches/8208",
    {
      score: "GWS GIANTS 13.10 (88) lost to Sydney Swans 21.13 (139)",
      outcomeText: "Sydney defeated Greater Western Sydney by 51 points.",
      recapText: "The Swans won the derby 139-88 with a sustained attacking performance that left the Giants' finals hopes under further pressure.",
      resultLabels: ["AFL Round 20", "Sydney by 51", "Official result"],
      consensusResult: {
        winner: "Sydney Swans",
        loser: "GWS GIANTS",
        summary: "Sydney defeated GWS 139-88.",
        marginText: "Sydney by 51 points",
      },
    }
  ),
  "event-nrl-129992105": official(
    "NRL Round 21 live report",
    "https://www.nrl.com/news/2026/07/25/super-saturday-raiders-v-wests-tigers-bulldogs-v-warriors-cowboys-v-broncos/",
    {
      score: "Canterbury-Bankstown Bulldogs 18-6 New Zealand Warriors",
      outcomeText: "The Bulldogs defeated the Warriors 18-6.",
      recapText: "Canterbury limited New Zealand to one converted try and closed out a 12-point Round 21 win.",
      resultLabels: ["NRL Round 21", "Bulldogs by 12", "Official result"],
      consensusResult: {
        winner: "Canterbury-Bankstown Bulldogs",
        loser: "New Zealand Warriors",
        summary: "The Bulldogs defeated the Warriors 18-6.",
        marginText: "Bulldogs by 12",
      },
    }
  ),
  "event-nrl-129992106": official(
    "NRL Round 21 live report",
    "https://www.nrl.com/news/2026/07/25/super-saturday-raiders-v-wests-tigers-bulldogs-v-warriors-cowboys-v-broncos/",
    {
      score: "North Queensland Cowboys 18-10 Brisbane Broncos",
      outcomeText: "North Queensland defeated Brisbane 18-10 in the Queensland derby.",
      recapText: "The Cowboys held the Broncos to ten points and completed an eight-point home victory in the final match of Saturday's Round 21 programme.",
      resultLabels: ["NRL Round 21", "Cowboys by 8", "Official result"],
      consensusResult: {
        winner: "North Queensland Cowboys",
        loser: "Brisbane Broncos",
        summary: "North Queensland defeated Brisbane 18-10.",
        marginText: "Cowboys by 8",
      },
    }
  ),
  evt_65: official(
    "Tour de France stage 20 result",
    "https://www.letour.fr/en/stage-20",
    {
      score: "Stage winner: Richard Carapaz",
      outcomeText: "Richard Carapaz won Stage 20 on Alpe d'Huez.",
      recapText: "Carapaz took the second consecutive Alpe d'Huez summit finish, earning his second stage victory of the final week.",
      resultLabels: ["Stage 20", "Carapaz winner", "Official result"],
      consensusResult: {
        winner: "Richard Carapaz",
        summary: "Carapaz won Stage 20 on Alpe d'Huez.",
        marginText: "Official stage winner",
      },
    }
  ),
  "afl-western-bulldogs-richmond-2026-07-25": official(
    "AFL match centre",
    "https://www.afl.com.au/afl/matches/8204",
    {
      score: "Western Bulldogs 15.15 (105) defeated Richmond 7.6 (48)",
      outcomeText: "The Western Bulldogs defeated Richmond by 57 points.",
      recapText: "The Bulldogs controlled the second half to win 105-48 and secure a convincing Round 20 result.",
      resultLabels: ["AFL Round 20", "Bulldogs by 57", "Official result"],
      consensusResult: {
        winner: "Western Bulldogs",
        loser: "Richmond",
        summary: "The Western Bulldogs defeated Richmond 105-48.",
        marginText: "Bulldogs by 57 points",
      },
    }
  ),
  "cwg-glasgow-2026-gymnastics-womens-team-final": official(
    "Glasgow 2026 women's team final report",
    "https://www.glasgow2026.com/news/4546743/golden-joy-for-godwin-and-australia-in-artistic-gymnastics",
    {
      score: "Australia 158.400; Canada 157.300; England 154.300",
      outcomeText: "Australia won the women's artistic gymnastics team title ahead of Canada and England.",
      recapText: "Georgia Godwin led Australia to 158.400 and its first women's team title since 2010. Canada took silver on 157.300 and England bronze on 154.300.",
      resultLabels: ["Women's team final", "Australia gold", "Official result"],
    }
  ),
  evt_22: official(
    "Formula 1 Hungarian Grand Prix qualifying report",
    "https://www.formula1.com/en/latest/article/norris-snatches-pole-position-from-hamilton-in-gripping-hungarian-gp-qualifying.6FcjwTeRfUdjidtY0vkKZN",
    {
      score: "Pole: Lando Norris 1:17.207",
      outcomeText: "Lando Norris took Hungarian Grand Prix pole with a 1:17.207 lap.",
      recapText: "Norris beat Lewis Hamilton by 0.012 seconds. Hamilton qualified second but received a three-place grid penalty, promoting Charles Leclerc to the front row.",
      resultLabels: ["Hungarian GP", "Norris pole", "Official result"],
      consensusResult: {
        winner: "Lando Norris",
        summary: "Norris took pole in 1:17.207.",
        marginText: "Hamilton +0.012 seconds",
      },
    }
  ),
  "event-afl-cd_m20260142002": official(
    "AFL match centre",
    "https://www.afl.com.au/afl/matches/8203",
    {
      score: "Brisbane Lions 19.12 (126) defeated Port Adelaide 9.13 (67)",
      outcomeText: "Brisbane defeated Port Adelaide by 59 points at the Gabba.",
      recapText: "The Lions took control after half-time to win 126-67, with Will Ashcroft collecting 30 disposals and kicking two goals.",
      resultLabels: ["AFL Round 20", "Brisbane by 59", "Official result"],
      consensusResult: {
        winner: "Brisbane Lions",
        loser: "Port Adelaide",
        summary: "Brisbane defeated Port Adelaide 126-67.",
        marginText: "Brisbane by 59 points",
      },
    }
  ),
  "event-nrl-129992107": official(
    "NRL Round 21 Sunday report",
    "https://www.nrl.com/news/2026/07/26/sunday-footy-dragons-v-titans-sea-eagles-v-sharks/",
    {
      score: "St George Illawarra Dragons 18-38 Gold Coast Titans",
      outcomeText: "Gold Coast defeated St George Illawarra 38-18.",
      recapText: "The Titans scored 38 points to complete a 20-point away win over the Dragons in Sunday's Round 21 opener.",
      resultLabels: ["NRL Round 21", "Titans by 20", "Official result"],
      consensusResult: {
        winner: "Gold Coast Titans",
        loser: "St George Illawarra Dragons",
        summary: "Gold Coast defeated the Dragons 38-18.",
        marginText: "Titans by 20",
      },
    }
  ),
  "event-afl-cd_m20260142007": official(
    "AFL match centre",
    "https://www.afl.com.au/afl/matches/8207",
    {
      score: "North Melbourne 8.14 (62) lost to St Kilda 13.15 (93)",
      outcomeText: "St Kilda defeated North Melbourne by 31 points.",
      recapText: "The Saints won 93-62, led by Nasiah Wanganeen-Milera's 46 disposals and four goals.",
      resultLabels: ["AFL Round 20", "St Kilda by 31", "Official result"],
      consensusResult: {
        winner: "St Kilda",
        loser: "North Melbourne",
        summary: "St Kilda defeated North Melbourne 93-62.",
        marginText: "St Kilda by 31 points",
      },
    }
  ),
  "event-nrl-129992108": official(
    "NRL Round 21 Sunday report",
    "https://www.nrl.com/news/2026/07/26/sunday-footy-dragons-v-titans-sea-eagles-v-sharks/",
    {
      score: "Manly Warringah Sea Eagles 12-48 Cronulla-Sutherland Sharks",
      outcomeText: "Cronulla defeated Manly 48-12 at Brookvale.",
      recapText: "The Sharks completed a 36-point away win to strengthen their top-four position, holding Manly to two converted tries.",
      resultLabels: ["NRL Round 21", "Sharks by 36", "Official result"],
      consensusResult: {
        winner: "Cronulla-Sutherland Sharks",
        loser: "Manly Warringah Sea Eagles",
        summary: "Cronulla defeated Manly 48-12.",
        marginText: "Sharks by 36",
      },
    }
  ),
  "cwg-glasgow-2026-netball-australia-england": official(
    "Glasgow 2026 netball match report",
    "https://www.glasgow2026.com/news/4547088/one-of-the-biggest-rivalries-in-the-sport-resumed-on-day-three-as-australia-took-on-england-in-the-netball-competition",
    {
      score: "Australia 66-47 England",
      outcomeText: "Australia defeated England 66-47 in the netball pool stage.",
      recapText: "The Diamonds turned sustained defensive pressure into a 19-goal victory over England in one of the pool stage's major early match-ups.",
      resultLabels: ["Netball pool stage", "Australia by 19", "Official result"],
      consensusResult: {
        winner: "Australia",
        loser: "England",
        summary: "Australia defeated England 66-47.",
        marginText: "Australia by 19",
      },
    }
  ),
  "cwg-glasgow-2026-weightlifting-opening-finals": official(
    "Glasgow 2026 opening weightlifting finals report",
    "https://www.glasgow2026.com/news/4547112/returning-champions-show-class-as-weightlifting-begins",
    {
      score: "Gold: Mohamad Aniq Bin Kasdan; Mirabai Chanu Saikhom; Aznil Bin Bidin Muhamad",
      outcomeText: "Malaysia won two of the opening three weightlifting titles, with India's Mirabai Chanu Saikhom also taking gold.",
      recapText: "Kasdan won the men's 60kg, Chanu claimed the women's 48kg and Muhamad took the men's 65kg title in the first weightlifting medal session.",
      resultLabels: ["Three weightlifting finals", "Malaysia two golds", "Chanu gold"],
    }
  ),
  "cwg-glasgow-2026-gymnastics-mens-all-around": official(
    "Glasgow 2026 men's all-around final report",
    "https://www.glasgow2026.com/news/4546981/ward-thrills-glasgow-crowd-to-win-artistic-gymnastics-gold",
    {
      score: "Reuben Ward 79.650; Felix Dolci 79.450; Jesse Moore 79.000",
      outcomeText: "Scotland's Reuben Ward won the men's artistic gymnastics all-around title.",
      recapText: "Ward scored 79.650 to edge Canada's Felix Dolci by 0.200, with Australia's Jesse Moore taking bronze on 79.000.",
      resultLabels: ["Men's all-around", "Ward gold", "Australia bronze"],
      consensusResult: {
        winner: "Reuben Ward",
        summary: "Ward won the men's all-around with 79.650.",
        marginText: "Dolci 0.200 behind",
      },
    }
  ),
  evt_23: official(
    "Formula 1 Hungarian Grand Prix result",
    "https://www.formula1.com/en/racing/2026/hungary",
    {
      score: "1 Lando Norris; 2 Max Verstappen +15.080s; 3 Kimi Antonelli +18.728s",
      outcomeText: "Lando Norris won the Hungarian Grand Prix ahead of Max Verstappen and Kimi Antonelli.",
      recapText: "Norris completed the race in 1:39:56.180 and won by 15.080 seconds from Verstappen, with Antonelli taking third.",
      resultLabels: ["Hungarian GP", "Norris winner", "Official result"],
      consensusResult: {
        winner: "Lando Norris",
        summary: "Norris won the Hungarian Grand Prix.",
        marginText: "Verstappen +15.080 seconds",
      },
    }
  ),
  evt_66: official(
    "Tour de France stage 21 and final classification",
    "https://www.letour.fr/en/rankings/stage-21",
    {
      score: "Stage: Mathieu van der Poel; Tour: Tadej Pogačar (73:56:26)",
      outcomeText: "Mathieu van der Poel won Stage 21, while Tadej Pogačar secured the Tour de France title.",
      recapText: "Van der Poel won on the Champs-Élysées. Pogačar completed the Tour in 73:56:26, 6:26 ahead of Remco Evenepoel and 9:42 ahead of Isaac del Toro.",
      resultLabels: ["Stage 21", "Van der Poel winner", "Pogačar Tour champion"],
      consensusResult: {
        winner: "Mathieu van der Poel",
        summary: "Van der Poel won Stage 21 and Pogačar won the Tour.",
        marginText: "Pogačar won GC by 6:26",
      },
    }
  ),
  "cwg-glasgow-2026-gymnastics-womens-all-around": official(
    "Glasgow 2026 women's all-around final report",
    "https://www.glasgow2026.com/news/4547123/canada-s-black-uses-her-experience-to-regain-women-s-all-around-title",
    {
      score: "Ellie Black 53.050; Breanna Scott 52.900; Lia-Monica Fontaine 52.800",
      outcomeText: "Canada's Ellie Black won the women's artistic gymnastics all-around title.",
      recapText: "Black scored 53.050 to edge Australia's Breanna Scott by 0.150, with Canada's Lia-Monica Fontaine third on 52.800.",
      resultLabels: ["Women's all-around", "Black gold", "Australia silver"],
      consensusResult: {
        winner: "Ellie Black",
        summary: "Black won the women's all-around with 53.050.",
        marginText: "Scott 0.150 behind",
      },
    }
  ),
  "cwg-glasgow-2026-gymnastics-apparatus-finals-one": official(
    "Glasgow 2026 apparatus finals day 1 report",
    "https://www.glasgow2026.com/news/4547672/three-golds-three-silvers-on-a-day-to-remember-for-canada-s-artistic-gymnasts",
    {
      score: "Gold: Luke Whitehouse; Jordan Carroll; Felix Dolci; Lia-Monica Fontaine; Kate McDonald",
      outcomeText: "Canada won three of the first five artistic gymnastics apparatus finals.",
      recapText: "Whitehouse won men's floor, Carroll pommel horse, Dolci rings, Fontaine women's vault and Australia's Kate McDonald uneven bars.",
      resultLabels: ["Apparatus finals day 1", "Canada three golds", "McDonald gold"],
    }
  ),
  "cwg-glasgow-2026-gymnastics-apparatus-finals-two": official(
    "Glasgow 2026 apparatus finals day 2 report",
    "https://www.glasgow2026.com/news/4548789/dolci-s-sweet-six-helps-canada-top-artistic-gymnastics-medal-table",
    {
      score: "Gold: Felix Dolci (vault, high bar); Jesse Moore; Breanna Scott; Ruby Evans",
      outcomeText: "Felix Dolci won two titles and Australia claimed two on the final day of artistic gymnastics.",
      recapText: "Dolci won men's vault and horizontal bar, Jesse Moore took parallel bars, Breanna Scott won balance beam and Ruby Evans claimed women's floor.",
      resultLabels: ["Apparatus finals day 2", "Dolci two golds", "Australia two golds"],
    }
  ),
  "cwg-glasgow-2026-athletics-100m-finals": official(
    "World Athletics Commonwealth Games report",
    "https://worldathletics.org/news/report/commonwealth-games-glasgow-eseme-rogers-katzberg",
    {
      score: "Men: Emmanuel Eseme 9.83; Women: Zoe Hobbs 10.93",
      outcomeText: "Emmanuel Eseme and Zoe Hobbs won the Commonwealth 100m titles in record-setting finals.",
      recapText: "Eseme ran a Games and Cameroon record of 9.83 ahead of Australia's Lachlan Kennedy. Hobbs set an Oceania record of 10.93, with Australia's Torrie Lewis taking bronze.",
      resultLabels: ["100m finals", "Eseme gold", "Hobbs gold", "Two Australia medals"],
    }
  ),
  "cwg-glasgow-2026-netball-australia-malawi": official(
    "World Netball Commonwealth Games results",
    "https://netball.sport/events-and-results/commonwealth-games/",
    {
      score: "Australia 68-32 Malawi",
      outcomeText: "Australia defeated Malawi 68-32 in the netball pool stage.",
      recapText: "The Diamonds held Malawi to 32 goals and completed a 36-goal victory to continue their unbeaten pool campaign.",
      resultLabels: ["Netball pool stage", "Australia by 36", "Official result"],
      consensusResult: {
        winner: "Australia",
        loser: "Malawi",
        summary: "Australia defeated Malawi 68-32.",
        marginText: "Australia by 36",
      },
    }
  ),
};

const feed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const found = new Set();

feed.events = feed.events.map((event) => {
  const result = results[event.id];
  if (!result) return event;
  found.add(event.id);
  const next = {
    ...event,
    status: "completed",
    ...result,
  };
  delete next.editorialPreview;
  return next;
});

const missing = Object.keys(results).filter((id) => !found.has(id));
if (missing.length) {
  throw new Error(`Result refresh targets not found: ${missing.join(", ")}`);
}

feed.version = "nothingsport-results-2026-07-30-v1";
feed.publishedAt = "2026-07-29T15:11:08.000Z";
feed.sourceNote = "Curated event cards plus official confirmed 2026 AFL and NRL fixtures, refreshed with source-backed results through 30 July 2026. Curated cards supersede routine imports for the same event.";

fs.writeFileSync(inputPath, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Updated ${found.size} result cards in ${path.relative(process.cwd(), inputPath)}.`);
