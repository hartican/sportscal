(function attachNothingSportsNationalTeamIdentities(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_NATIONAL_TEAM_IDENTITIES = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsNationalTeamIdentities(){
  "use strict";

  const RETRIEVED_AT = "2026-08-28";
  const OFFICIAL_REFERENCE = "official-reference";
  const PERMISSION_REVIEW_REQUIRED = "permission-review-required";

  function identity(id, displayName, sport, sportDomainId, countryCode, gender, aliases, assetPath, assetKind, sourceUrl, assetSourceUrl, sha256, legacyIds = [], permissionReviewStatus = "recorded"){
    const rightsStatus = permissionReviewStatus === PERMISSION_REVIEW_REQUIRED ? PERMISSION_REVIEW_REQUIRED : OFFICIAL_REFERENCE;
    return Object.freeze({
      id,
      stableTeamId:id,
      displayName,
      canonicalName:displayName,
      shortName:displayName,
      sport,
      sportDomainId,
      countryCode,
      gender,
      aliases:Object.freeze(Array.from(new Set([displayName, ...aliases]))),
      legacyIds:Object.freeze(legacyIds),
      assetPath,
      assetKind,
      sourceUrl,
      assetSourceUrl,
      retrievedAt:RETRIEVED_AT,
      sha256,
      permissionReviewStatus,
      rightsStatus,
      assetClass:OFFICIAL_REFERENCE,
      provenance:assetKind === "coat-of-arms" ? "government-symbol" : "official-governing-body",
      displayUse:"editorial-identification",
      teamKind:"national",
      type:"nationalSide",
      isNationalTeam:true,
    });
  }

  const footballCrestBase = "https://cdn.englandfootball.com/-/media/EnglandFootball/Global/Nations/Crests-USE-THIS";
  const iccMemberBase = "https://images.icc-cricket.com/icc-web/image/private/t_q-best/prd/assets/member_association";
  const nrlThemeBase = "https://www.nrl.com/.theme";
  const rugbyAssetBase = "https://d26phqdbpt0w91.cloudfront.net/NonVideo";

  const allTeams = Object.freeze([
    identity("team:football:socceroos", "Socceroos", "football", "sport:football", "AU", "male", ["Australia", "Australian", "Australia Men"], "assets/identities/national/football/socceroos.png", "federation-crest", "https://socceroos.com.au/", "https://footballaustralia.com.au/sites/default/files/styles/image_300x/public/2020-12/18128_FA_Website-Header-Logo_FA.png?itok=18GbS1cR", "2c703adafd1dca0cb3c257fc0eaf179912d2a747cd2f45e451b76aa93a726d60", ["team:football:national:australia"]),
    identity("team:football:matildas", "Matildas", "football", "sport:football", "AU", "female", ["Australia Women", "Australian Women", "CommBank Matildas"], "assets/identities/national/football/matildas.png", "federation-crest", "https://matildas.com.au/", "https://footballaustralia.com.au/sites/default/files/styles/image_300x/public/2020-12/18128_FA_Website-Header-Logo_FA.png?itok=18GbS1cR", "2c703adafd1dca0cb3c257fc0eaf179912d2a747cd2f45e451b76aa93a726d60"),
    identity("team:football:turkiye", "Türkiye", "football", "sport:football", "TR", "male", ["Turkey"], "assets/identities/national/football/turkiye.png", "federation-crest", "https://www.tff.org/", `${footballCrestBase}/turkey-150.png`, "c3bbfbbca378c89d6ac04bfcfae26051e0ec3aca79746dae9b1966daa1e9bf67", ["team:football:national:turkiye"]),
    identity("team:football:usa", "USA", "football", "sport:football", "US", "male", ["United States", "USMNT"], "assets/identities/national/football/usa.png", "federation-crest", "https://www.ussoccer.com/teams/usmnt", `${footballCrestBase}/usa-150.png`, "a3742bd4df85453f2e24ca1ba7c53d114f7734383981f4f7108f9cec7b6d67c6", ["team:football:national:usa"]),
    identity("team:football:paraguay", "Paraguay", "football", "sport:football", "PY", "male", ["Albirroja"], "assets/identities/national/football/paraguay.png", "federation-crest", "https://www.apf.org.py/", `${footballCrestBase}/paraguay-150.png`, "6fd404189fd8f101009257b9557af2fcf606dd2617c12b6681361006f4cbec9c", ["team:football:national:paraguay"]),
    identity("team:football:egypt", "Egypt", "football", "sport:football", "EG", "male", [], "assets/identities/national/football/egypt.png", "federation-crest", "https://www.efa.com.eg/", `${footballCrestBase}/egypt-150.png`, "248504f40fa97a6c02224bcb71ce480092cee325c8245c72878885c4f50cd147", ["team:football:national:egypt"]),
    identity("team:football:canada", "Canada", "football", "sport:football", "CA", "male", [], "assets/identities/national/football/canada.png", "federation-crest", "https://canadasoccer.com/", `${footballCrestBase}/canada-150.png`, "035f3e00f5450b2fa9a22b65bc473e40820486623fd7ff9a7c4583af43c4e099", ["team:football:national:canada"]),
    identity("team:football:morocco", "Morocco", "football", "sport:football", "MA", "male", [], "assets/identities/national/football/morocco.png", "federation-crest", "https://frmf.ma/", `${footballCrestBase}/morocco-150.png`, "575b846de92b13983f1f760e6d1e5ec53905b248e433c5cb114d713f7546db01", ["team:football:national:morocco"]),
    identity("team:football:france", "France", "football", "sport:football", "FR", "male", [], "assets/identities/national/football/france.png", "federation-crest", "https://www.fff.fr/", `${footballCrestBase}/france-150.png`, "0e546e3263b1667724f9e73825a9dbe957e6e58639a13c514be2186e29d03cd5", ["team:football:national:france"]),
    identity("team:football:brazil", "Brazil", "football", "sport:football", "BR", "male", ["Brasil"], "assets/identities/national/football/brazil.png", "federation-crest", "https://www.cbf.com.br/", `${footballCrestBase}/brazil-150.png`, "ac47ebfeadcaef03dcae3b2106fd1b5aa6325fb51ff215a97068a4788235b44f", ["team:football:national:brazil"]),
    identity("team:football:norway", "Norway", "football", "sport:football", "NO", "male", [], "assets/identities/national/football/norway.png", "federation-crest", "https://www.fotball.no/landslag/norge-a-herrer/", `${footballCrestBase}/norway-150.png`, "7920fa17599421a5edba70c846bed57bb51ca580ed5cbc8c7bdd6ead921619a7", ["team:football:national:norway"]),
    identity("team:football:mexico", "Mexico", "football", "sport:football", "MX", "male", ["México"], "assets/identities/national/football/mexico.png", "federation-crest", "https://miseleccion.mx/", `${footballCrestBase}/mexico-150.png`, "a8c9886a23e9e51694ce9ab79e275fe0404ce701f0950a2923d6aa75dffb0754", ["team:football:national:mexico"]),
    identity("team:football:england", "England", "football", "sport:football", "GB", "male", ["Three Lions"], "assets/identities/national/football/england.png", "federation-crest", "https://www.englandfootball.com/england/mens-senior-team", `${footballCrestBase}/England3x.png`, "787b5fafaca2c55a6fbc367fe1b9d312062697d9cbee0d0b86ebed1bc921f8be", ["team:football:national:england"]),
    identity("team:football:portugal", "Portugal", "football", "sport:football", "PT", "male", [], "assets/identities/national/football/portugal.png", "federation-crest", "https://www.fpf.pt/", `${footballCrestBase}/portugal-150.png`, "13cac4981455c4deace9614ef1995e71e0f16168ea2d06e2e86d1d20ff61fe89", ["team:football:national:portugal"]),
    identity("team:football:spain", "Spain", "football", "sport:football", "ES", "male", ["España"], "assets/identities/national/football/spain.png", "federation-crest", "https://rfef.es/", `${footballCrestBase}/spain-150.png`, "b64f9705b581bbebc3b8ec8d124ed30d954eda4a7db65cebd258dc6a06ae1f8e", ["team:football:national:spain"]),
    identity("team:football:belgium", "Belgium", "football", "sport:football", "BE", "male", ["Red Devils"], "assets/identities/national/football/belgium.png", "federation-crest", "https://www.rbfa.be/", `${footballCrestBase}/belgium-150.png`, "66afa34debea05851ecd13db092e256190480ddedd4c5f347049ac21443e4a40", ["team:football:national:belgium"]),
    identity("team:football:argentina", "Argentina", "football", "sport:football", "AR", "male", ["La Albiceleste"], "assets/identities/national/football/argentina.png", "federation-crest", "https://www.afa.com.ar/", `${footballCrestBase}/argentina-150.png`, "88076ce948cc541ab96e1ff08e3e308a7d172b2ccc773e355e44210444716231", ["team:football:national:argentina"]),
    identity("team:football:switzerland", "Switzerland", "football", "sport:football", "CH", "male", ["Swiss"], "assets/identities/national/football/switzerland.png", "federation-crest", "https://www.football.ch/SFV/Nationalteams.aspx", `${footballCrestBase}/switzerland-150.png`, "a63c7d33cc660c197fd7f7b6ae219f7095a1bad84f5207301e0845bc2a5cb630", ["team:football:national:switzerland"]),
    identity("team:football:colombia", "Colombia", "football", "sport:football", "CO", "male", [], "assets/identities/national/football/colombia.png", "federation-crest", "https://fcf.com.co/", `${footballCrestBase}/colombia-150.png`, "212da1680a8b6578574d37181971c849c66c4e4674dcfe46c4a31fb59e8f58aa", ["team:football:national:colombia"]),

    identity("team:rugby:wallabies", "Wallabies", "rugby", "sport:rugby", "AU", "male", ["Australia", "Australian"], "assets/identities/national/rugby/wallabies.png", "team-logo", "https://wallabies.rugby/", `${rugbyAssetBase}/929920ed-8900-40f0-8402-4563c0006eec.png`, "4e80e5a2496f8bd32a89d77db616b5a680f60bb680762e198d23834eb52049a1"),
    identity("team:rugby:ireland", "Ireland", "rugby", "sport:rugby", "IE", "male", ["Irish"], "assets/identities/national/rugby/ireland.png", "federation-crest", "https://www.irishrugby.ie/", `${rugbyAssetBase}/993f90f6-3586-4741-45ad-08d8e29e6bc6.png`, "d4b13a0afb3d32593918633a4f517accc78bb1c5c65905fbc4347a5f901b6202"),
    identity("team:rugby:france", "France", "rugby", "sport:rugby", "FR", "male", ["Les Bleus"], "assets/identities/national/rugby/france.png", "federation-crest", "https://www.ffr.fr/", `${rugbyAssetBase}/d6161a2f-f770-46b9-23d9-08d9369d2141.png`, "63b36bb2b7f96be2d3854736993804dc4b76fccdd6ab8b7f5292cde3a4d6a17e"),
    identity("team:rugby:italy", "Italy", "rugby", "sport:rugby", "IT", "male", ["Azzurri"], "assets/identities/national/rugby/italy.png", "federation-crest", "https://federugby.it/", `${rugbyAssetBase}/56e05e32-60ca-451d-b09a-ec3ad52cc709.png`, "2b918e62b2214617af7d4395d20302368fec1c3756b865fd7c3630aedf8968c6"),
    identity("team:rugby:japan", "Japan", "rugby", "sport:rugby", "JP", "male", ["Brave Blossoms"], "assets/identities/national/rugby/japan.png", "federation-crest", "https://en.rugby-japan.jp/", `${rugbyAssetBase}/aaf401bd-6fbf-4881-a7db-52aec716f789.png`, "cb019200e6cc2afaf35d674bd5be4fef662ad3714afbb047fc83f5935695c0c4"),
    identity("team:rugby:springboks", "Springboks", "rugby", "sport:rugby", "ZA", "male", ["South Africa", "South African"], "assets/identities/national/rugby/springboks.png", "team-logo", "https://springboks.rugby/", `${rugbyAssetBase}/bedf129f-471d-4442-b7ad-fdf07c516630.png`, "cedbb8481ff734ff0467b36fc5aa45dede16e78aa1721fc0e0251b5c8b3e8ae0"),
    identity("team:rugby:all-blacks", "All Blacks", "rugby", "sport:rugby", "NZ", "male", ["New Zealand", "New Zealander"], "assets/identities/national/rugby/all-blacks.png", "team-logo", "https://www.allblacks.com/team/all-blacks", "https://images.allblacks.com/image/private/t_q_good/v1780998849/prd/assets/teams/logos_darkmode/AB.png", "99ea4c6df5d7009449e33d6e73b18c27da1051200d051dcc7e067c077a0086b6"),
    identity("team:rugby:argentina", "Argentina", "rugby", "sport:rugby", "AR", "male", ["Los Pumas"], "assets/identities/national/rugby/argentina.png", "team-logo", "https://uar.com.ar/identidad/", `${rugbyAssetBase}/0d879300-8bf6-4f95-b91e-ea8b69723b75.png`, "7adab3ec2f9818e36a3c80aaaceb9d6650b2b1ef2336fca746bf8e08d9bad659"),
    identity("team:rugby:england", "England", "rugby", "sport:rugby", "GB", "male", ["English"], "assets/identities/national/rugby/england.png", "federation-crest", "https://www.englandrugby.com/", `${rugbyAssetBase}/1fc97be3-7806-4009-a341-81a734684a79.png`, "4615e77caf33bd4176c7f0ac155ab4d263323074485f33b319ef85e6b15f4cd0"),
    identity("team:rugby:scotland", "Scotland", "rugby", "sport:rugby", "GB", "male", ["Scottish"], "assets/identities/national/rugby/scotland.png", "federation-crest", "https://scottishrugby.org/", `${rugbyAssetBase}/45384b69-1c6c-4a23-9ee2-8c420e938e3d.png`, "dec4e2d4530eac4b89e8c9e2ce86653a6ae401783ab752064597d2cde57dcbea"),
    identity("team:rugby:wales", "Wales", "rugby", "sport:rugby", "GB", "male", ["Welsh"], "assets/identities/national/rugby/wales.png", "federation-crest", "https://www.wru.wales/", `${rugbyAssetBase}/d01e3086-cb62-47bd-9e2b-61db9c1dc397.png`, "43660bc933235bfe6a1a5cb9a4ca5044acccdfa72d3c61edb66a805f718274d7"),

    identity("team:cricket:australia", "Australia cricket", "cricket", "sport:cricket", "AU", "mixed", ["Australia", "Australian"], "assets/identities/national/cricket/australia.jpg", "federation-crest", "https://www.cricket.com.au/", `${iccMemberBase}/AUS.jpg`, "53df3d4bbc32f83a55b3e11f345c2d585f89e596dc58a644c25a80f87763e0cb"),
    identity("team:cricket:bangladesh", "Bangladesh cricket", "cricket", "sport:cricket", "BD", "mixed", ["Bangladesh"], "assets/identities/national/cricket/bangladesh.jpg", "federation-crest", "https://www.tigercricket.com.bd/", `${iccMemberBase}/BAN.jpg`, "4f4378fc612a1ac0e393b547ea3c603d241ed849f6af008003f43c8914851800"),
    identity("team:cricket:england", "England cricket", "cricket", "sport:cricket", "GB", "mixed", ["England"], "assets/identities/national/cricket/england.jpg", "federation-crest", "https://www.ecb.co.uk/", `${iccMemberBase}/ENG.jpg`, "58d2b93e179182d55c3ecfcab4fb45a4024f72ec69eaa9095eab3a8933366dcc"),
    identity("team:cricket:new-zealand", "New Zealand cricket", "cricket", "sport:cricket", "NZ", "mixed", ["New Zealand", "Black Caps", "White Ferns"], "assets/identities/national/cricket/new-zealand.jpg", "federation-crest", "https://www.nzc.nz/", `${iccMemberBase}/NZ.jpg`, "a0e2c3ff4c14b5438f5f5f4a3a876ec746ee2e0f21089efe0a89318555035503"),
    identity("team:cricket:south-africa", "South Africa cricket", "cricket", "sport:cricket", "ZA", "mixed", ["South Africa", "Proteas"], "assets/identities/national/cricket/south-africa.jpg", "federation-crest", "https://cricket.co.za/", `${iccMemberBase}/SA.jpg`, "f5b720183d2edd498c6a3892485a1873f2a5e0771d3e67c45a7fcbf7f36a323e"),
    identity("team:cricket:india", "India cricket", "cricket", "sport:cricket", "IN", "mixed", ["India"], "assets/identities/national/cricket/india.jpg", "federation-crest", "https://www.bcci.tv/", `${iccMemberBase}/IND.jpg`, "728f13f926a533b1ca31f53597591d034cd10dd17ee4585c2efaeb73147df283"),
    identity("team:cricket:pakistan", "Pakistan cricket", "cricket", "sport:cricket", "PK", "mixed", ["Pakistan"], "assets/identities/national/cricket/pakistan.jpg", "federation-crest", "https://www.pcb.com.pk/", `${iccMemberBase}/PAK.jpg`, "9a350e00ee5c0791e56dd3613bae57543c32f5da44120c57f2c488506ca8b52e"),
    identity("team:cricket:sri-lanka", "Sri Lanka cricket", "cricket", "sport:cricket", "LK", "mixed", ["Sri Lanka"], "assets/identities/national/cricket/sri-lanka.jpg", "federation-crest", "https://srilankacricket.lk/", `${iccMemberBase}/SL.jpg`, "07f5bff9b434e5b13bf6bb85e89be47989a7e3103c504513ce5e524dc55cba2d"),
    identity("team:cricket:west-indies", "West Indies cricket", "cricket", "sport:cricket", "WI", "mixed", ["West Indies", "Windies"], "assets/identities/national/cricket/west-indies.jpg", "federation-crest", "https://www.windiescricket.com/", `${iccMemberBase}/WI.jpg`, "5f793c37fce3bd1e5960cae43a111a678917aead7e1d86c1237dac9aea197365"),

    identity("team:nrl:kangaroos", "Australian Kangaroos", "rugby-league", "sport:nrl", "AU", "male", ["Australia", "Kangaroos", "Australia Men"], "assets/identities/national/rugby-league/kangaroos.svg", "team-logo", "https://www.nrl.com/players/?competition=195", `${nrlThemeBase}/australia/badge.svg`, "7f11d570d799acc61733a901f0f29fe016fbe9693f29c8fb616a7a6b295f945e", ["team:nrl:national:australia"]),
    identity("team:nrl:jillaroos", "Australian Jillaroos", "rugby-league", "sport:nrl", "AU", "female", ["Australia Women", "Jillaroos"], "assets/identities/national/rugby-league/jillaroos.svg", "team-logo", "https://www.nrl.com/players/?competition=196", `${nrlThemeBase}/australian-jillaroos/badge.svg`, "64bbec9204f338cae4de4050e95ffcb2aa09d777d6b833d497a4ec16c08f4d79"),
    identity("team:nrl:kiwis", "New Zealand Kiwis", "rugby-league", "sport:nrl", "NZ", "male", ["New Zealand", "Kiwis", "New Zealand Men"], "assets/identities/national/rugby-league/kiwis.svg", "team-logo", "https://nzrl.co.nz/national-teams/kiwis", `${nrlThemeBase}/new-zealand/badge.svg`, "1f35a4149afe4e8a8c59ebf5422a5aa3c9c2942d5b9866b158e39c42474f038f", ["team:nrl:national:new-zealand"]),
    identity("team:nrl:kiwi-ferns", "New Zealand Kiwi Ferns", "rugby-league", "sport:nrl", "NZ", "female", ["New Zealand Women", "Kiwi Ferns"], "assets/identities/national/rugby-league/kiwi-ferns.png", "team-logo", "https://nzrl.co.nz/national-teams/kiwi-ferns", `${nrlThemeBase}/kiwi-ferns/badge.png`, "d6a3257c88a42579941300051e5f6caaf675a459a0dcad66beb134c24a98c837"),
    identity("team:nrl:fiji-bati", "Fiji Bati", "rugby-league", "sport:nrl", "FJ", "male", ["Fiji"], "assets/identities/national/rugby-league/fiji-bati.svg", "team-logo", "https://www.nrl.com/players/?competition=195", `${nrlThemeBase}/fiji/badge.svg`, "894856abbadee2f9ee79e9c460d90fee24200999ac562ab00df3dae1587f5220", ["team:nrl:national:fiji"]),
    identity("team:nrl:cook-islands-aitu", "Cook Islands Aitu", "rugby-league", "sport:nrl", "CK", "male", ["Cook Islands", "Aitu"], "assets/identities/national/rugby-league/cook-islands-aitu.svg", "team-logo", "https://www.nrl.com/players/?competition=195", `${nrlThemeBase}/cook-islands/badge.svg`, "5d321fd8c0f445c84f9bcedd5b42a2acd647f6f02a5626b169a0f01af8fd7eff", ["team:nrl:national:cook-islands"]),

    identity("team:netball:diamonds", "Australian Diamonds", "netball", "sport:netball", "AU", "female", ["Australia", "Diamonds"], "assets/identities/national/netball/diamonds.svg", "team-logo", "https://netball.com.au/diamonds", "https://netball.com.au/sites/netballnation/files/migrated_images/team_logos/811.svg", "af80660d13b8085cae62e3b1b67f29cce7e8777aa875b14e54aea202b289e7fe", ["team:netball:national:australia"]),
    identity("team:netball:england-roses", "England Roses", "netball", "sport:netball", "GB", "female", ["England", "Vitality Roses", "Roses"], "assets/identities/national/netball/england-roses.png", "federation-crest", "https://www.englandnetball.co.uk/team/vitality-roses/", "https://tickets.englandnetball.co.uk/light_custom/lightTheme/favicon-desk.png", "42c115bdf1cc9bd27442aa3ed747006b44f26f983b6c549c37344b42ca77de73", ["team:netball:national:england"]),
    identity("team:netball:malawi-queens", "Malawi Queens", "netball", "sport:netball", "MW", "female", ["Malawi"], "assets/identities/national/netball/malawi-queens.png", "coat-of-arms", "https://www.malawi.gov.mw/", "https://www.malawi.gov.mw/templates/shaper_educon/images/favicon.ico", "8c7464aa46a2a1b31536cd98bab1331d7cff595719962b0861dc741433e4497e", ["team:netball:national:malawi"], PERMISSION_REVIEW_REQUIRED),
    identity("team:netball:south-africa-proteas", "South Africa Proteas", "netball", "sport:netball", "ZA", "female", ["South Africa", "SPAR Proteas", "Proteas"], "assets/identities/national/netball/south-africa-proteas.svg", "team-logo", "https://netball-sa.org.za/spar-proteas/", "https://netball.com.au/sites/netballnation/files/migrated_images/team_logos/833.svg", "6fb545a45936700a0e0e37f2878298afd4244de0c7d6573fc8f99ab4a95550e2", ["team:netball:national:south-africa"]),
    identity("team:netball:jamaica-sunshine-girls", "Jamaica Sunshine Girls", "netball", "sport:netball", "JM", "female", ["Jamaica", "Sunshine Girls"], "assets/identities/national/netball/jamaica-sunshine-girls.png", "coat-of-arms", "https://opm.gov.jm/symbols/coat-of-arms/", "https://opm.gov.jm/wp-content/uploads/2017/02/coat-of-arms-national-symbol.png", "2ecb091089f91e549eec86e3feec4b8fb845abbbaaad0fe144705aa6f32554b3", ["team:netball:national:jamaica"], PERMISSION_REVIEW_REQUIRED),
    identity("team:netball:silver-ferns", "New Zealand Silver Ferns", "netball", "sport:netball", "NZ", "female", ["New Zealand", "Silver Ferns"], "assets/identities/national/netball/silver-ferns.svg", "team-logo", "https://www.silverferns.co.nz/", "https://www.silverferns.co.nz/media/com_nnzframework/images/logos/on-dark/silverferns.svg", "1488a0a3280ed167e6affe3b74d62e8e2f549d0c62bac00092817acb316d1934"),

    identity("team:basketball:boomers", "Australian Boomers", "basketball", "sport:nba", "AU", "male", ["Australia", "Boomers", "Australia Men"], "assets/identities/national/basketball/boomers.png", "team-logo", "https://www.australia.basketball/national-teams/boomers/about", "https://resources.basketball-australia.pulselive.com/basketball-australia/photo/2026/03/31/02c54508-1467-431f-89b5-e648b23dde6e/AustralianBoomers_Logo_Gold_RGB.png", "648077103cf62114897162bd2268e89e79d7a8f8a28db1d7408af2d9e95e1600"),
    identity("team:basketball:opals", "Australian Opals", "basketball", "sport:nba", "AU", "female", ["Australia Women", "Opals"], "assets/identities/national/basketball/opals.png", "team-logo", "https://www.australia.basketball/national-teams/opals/", "https://resources.basketball-australia.pulselive.com/basketball-australia/photo/2026/06/17/3602eebe-5e54-4e05-a990-563ae16078ab/AustralianOpals_Logo_Gold_RGB.png", "a3a710950532358e49e8f8ca90f665e1eae5a44010595383ba3bafdc5dbcdf59"),
    identity("team:hockey:kookaburras", "Kookaburras", "hockey", "sport:hockey", "AU", "male", ["Australia", "Australia Men"], "assets/identities/national/hockey/kookaburras.svg", "federation-crest", "https://www.hockey.org.au/teams/kookaburras", "https://www.hockey.org.au/favicon.svg", "3b23ab61cb38e6c120f9bf6e450c0e5fc3152708a66d6f11768b49597ad10374"),
    identity("team:hockey:hockeyroos", "Hockeyroos", "hockey", "sport:hockey", "AU", "female", ["Australia Women"], "assets/identities/national/hockey/hockeyroos.png", "team-logo", "https://www.hockey.org.au/teams/hockeyroos", "https://cdn.sanity.io/images/a5i57b7j/production/89acf32fff8fa28d11fd087dc02379d80c5c10d0-748x163.png", "06b3e5ad0baba5c8b6d47ea6f09f97a43090f5a1f7c15719c654eaaf0dfba434"),
    identity("team:cwg:australia", "Team Australia", "multi-sport", "sport:multi-sport", "AU", "mixed", ["Australia"], "assets/identities/national/multi-sport/team-australia.png", "team-logo", "https://commonwealthgames.com.au/brand-toolkit/", "https://commonwealthgames.com.au/wp-content/themes/cga_theme/assets/build/css/images/CGA_Logo.png", "e6ead9ae2d8ef31bc128215fe3fa9eb03f5fd4934ea1ae5287d8ae1e10b0a74a", [], PERMISSION_REVIEW_REQUIRED),
    identity("team:aflw:representative:australia", "Australia AFLW representative", "aflw", "sport:afl", "AU", "female", ["Australia"], "assets/identities/national/aflw/australia-coat-of-arms.svg", "coat-of-arms", "https://www.pmc.gov.au/honours-and-symbols/commonwealth-coat-arms", "https://www.pmc.gov.au/sites/default/files/2023-03/1912-coat-of-arms-1280.jpg", "fbdc88ef2ccafcb5982570d0dde0b480a30b3c7de425c8ec003ee128084f9dd0", [], PERMISSION_REVIEW_REQUIRED),
    identity("team:aflw:representative:ireland", "Ireland AFLW representative", "aflw", "sport:afl", "IE", "female", ["Ireland"], "assets/identities/national/aflw/ireland-state-harp.svg", "coat-of-arms", "https://www.gov.ie/en/department-of-the-taoiseach/publications/the-harp/", "https://ds.services.gov.ie/logos/general/harp.svg", "e65334ba240bebead5b1cf36f98574393c62a19cbe39310071dad28d85b7c041", [], PERMISSION_REVIEW_REQUIRED),
  ]);

  const teamsById = Object.freeze(Object.fromEntries(allTeams.map(team => [team.id, team])));
  const legacyIdMap = Object.freeze(Object.fromEntries(allTeams.flatMap(team => team.legacyIds.map(legacyId => [legacyId, team.id]))));
  const assetPaths = Object.freeze(Array.from(new Set(allTeams.map(team => team.assetPath))));

  function canonicalId(value){
    const id = String(value || "");
    return teamsById[id] ? id : legacyIdMap[id] || id;
  }

  function teamForId(value){ return teamsById[canonicalId(value)] || null; }
  function normalize(value){ return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function escapeRegExp(value){ return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function containsAlias(text, alias){
    const normalizedText = normalize(text);
    const normalizedAlias = normalize(alias);
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(normalizedAlias)}(?:$|[^a-z0-9])`).test(normalizedText);
  }
  function eventText(event){
    return [event?.name, event?.displayTitleCompact, event?.competitionId, event?.series, event?.sport, ...(Array.isArray(event?.participants) ? event.participants.map(participant => typeof participant === "string" ? participant : participant?.name) : [])].filter(Boolean).join(" | ");
  }
  function isAflwRepresentative(event){ return /^aflw-australia-ireland-2026-08-01$/.test(String(event?.id || event?.eventId || "")) || /aflw[^|]*australia\s+v\.?\s+ireland/i.test(eventText(event)); }
  function sportForEvent(event){
    const key = String(event?.key || "").toLowerCase();
    const text = eventText(event);
    if (isAflwRepresentative(event)) return "aflw";
    if (key === "nrl" || /rugby league|\brlwc\b|world cup[^|]*league/i.test(text)) return "rugby-league";
    if (key === "rugby") return "rugby";
    if (key === "cricket") return "cricket";
    if (["fifa", "football"].includes(key)) return "football";
    if (["nba", "basketball"].includes(key)) return "basketball";
    if (key === "netball" || (key === "cwg" && /netball/i.test(text))) return "netball";
    if (key === "hockey") return "hockey";
    if (["cwg", "multi-sport"].includes(key)) return "multi-sport";
    return null;
  }
  function genderForEvent(event, sport){
    const text = eventText(event);
    if (sport === "netball" || sport === "aflw") return "female";
    if (/\b(?:women|women's|female|girls|matildas|jillaroos|kiwi ferns|opals|hockeyroos)\b/i.test(text)) return "female";
    if (/\b(?:men|men's|male|socceroos|kangaroos|kiwis|boomers|kookaburras)\b/i.test(text)) return "male";
    return null;
  }
  function matchupLabels(event){
    const participants = Array.isArray(event?.participants) ? event.participants.map(participant => typeof participant === "string" ? participant : participant?.name).filter(Boolean) : [];
    if (participants.length >= 2) return participants.slice(0, 2);
    const source = String(event?.displayTitleCompact || event?.name || "").replace(/\p{Regional_Indicator}{2}/gu, "").trim();
    const divider = /\s+v\.?\s+/i.exec(source);
    if (!divider) return [];
    return [source.slice(0, divider.index).split(/\s[—–]\s/).pop().trim(), source.slice(divider.index + divider[0].length).split(/\s[—–]\s/)[0].trim()];
  }
  function candidatesForEvent(event){
    const sport = sportForEvent(event);
    if (!sport) return [];
    return allTeams.filter(team => team.sport === sport);
  }
  function teamForLabel(event, label, usedIds = new Set()){
    const sport = sportForEvent(event);
    const gender = genderForEvent(event, sport);
    const candidates = candidatesForEvent(event).filter(team => !usedIds.has(team.id) && team.aliases.some(alias => containsAlias(label, alias)));
    if (!candidates.length) return null;
    const named = candidates.filter(team => containsAlias(label, team.displayName) || team.aliases.some(alias => alias !== team.countryCode && alias.length > 8 && containsAlias(label, alias)));
    const pool = named.length ? named : candidates;
    return pool.find(team => gender && team.gender === gender) || pool.find(team => team.gender === "mixed") || pool.find(team => team.gender === "male") || pool[0];
  }
  function identitiesForEvent(event){
    const explicitIds = (Array.isArray(event?.participantIds) ? event.participantIds : []).map(canonicalId).map(teamForId).filter(Boolean);
    if (explicitIds.length >= 2) return explicitIds.slice(0, 2);
    const usedIds = new Set(explicitIds.map(team => team.id));
    const resolved = [...explicitIds];
    matchupLabels(event).forEach(label => {
      const team = teamForLabel(event, label, usedIds);
      if (!team) return;
      usedIds.add(team.id);
      resolved.push(team);
    });
    return resolved.slice(0, 2);
  }
  function participantIdsForEvent(event){ return identitiesForEvent(event).map(team => team.id); }
  function markForTeam(team){
    if (!team) return null;
    const logo = Object.freeze({ primary:team.assetPath, light:team.assetPath, dark:team.assetPath, icon:team.assetPath, iconLight:team.assetPath, iconDark:team.assetPath, backgroundLight:"light", backgroundDark:"light" });
    return Object.freeze({
      id:team.id,
      label:team.displayName,
      url:team.assetPath,
      logo,
      fit:"contain",
      aliases:team.aliases,
      sourceUrl:team.sourceUrl,
      assetSourceUrl:team.assetSourceUrl,
      sha256:team.sha256,
      retrievedAt:team.retrievedAt,
      assetKind:team.assetKind,
      assetClass:team.assetClass,
      rightsStatus:team.rightsStatus,
      permissionReviewStatus:team.permissionReviewStatus,
      provenance:team.provenance,
      displayUse:team.displayUse,
      teamKind:"national",
      isNationalTeam:true,
    });
  }
  const participantMarks = Object.freeze(Object.fromEntries(allTeams.map(team => [team.id, markForTeam(team)])));
  const participants = Object.freeze(allTeams.map(team => Object.freeze({ id:team.id, canonicalName:team.displayName, displayName:team.displayName, shortName:team.displayName, teamKind:"national", isNationalTeam:true, countryCode:team.countryCode, metadata:Object.freeze({ titleAliases:team.aliases, gender:team.gender, sport:team.sport }) })));
  const participantsById = Object.freeze(Object.fromEntries(participants.map(participant => [participant.id, participant])));
  function teamsForDomain(domainId){ return allTeams.filter(team => team.sportDomainId === domainId); }
  const groups = Object.freeze(Array.from(new Set(allTeams.map(team => team.sportDomainId))).map(domainId => Object.freeze({
    domainId,
    label:domainId.replace(/^sport:/, "").replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()),
    sections:Object.freeze([Object.freeze({ label:"International", teams:Object.freeze(teamsForDomain(domainId)) })]),
  })));

  return Object.freeze({
    schemaVersion:"national-team-identities.v1",
    baselineCount:58,
    retrievedAt:RETRIEVED_AT,
    policy:Object.freeze({ order:Object.freeze(["team-logo", "federation-crest", "coat-of-arms"]), prohibited:Object.freeze(["flag", "monogram", "remote-runtime-url"]), athleteNationalityFlags:"separate-and-unchanged" }),
    allTeams,
    teamsById,
    legacyIdMap,
    assetPaths,
    participants,
    participantsById,
    participantMarks,
    groups,
    canonicalId,
    teamForId,
    teamsForDomain,
    sportForEvent,
    isAflwRepresentative,
    identitiesForEvent,
    participantIdsForEvent,
    markForTeam,
  });
});
