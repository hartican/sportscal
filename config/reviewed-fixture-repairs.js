(function(root,factory){const api=factory();root.NOTHINGSPORTS_REVIEWED_FIXTURE_REPAIRS=api;if(typeof module==='object')module.exports=api;})(globalThis,function(){
 'use strict';
 // Dated official evidence: docs/quality/coverage-repair-20260930.md.
 const records={
  'fixture:cricket:espn:1525659':{name:'South Africa v Australia — First Test',displayTitleCompact:'South Africa v Australia — First Test',format:'Test',matchFormat:'Test',endDate:'2026-10-13',numberOfDays:5,startTimeUtc:'2026-10-09T07:30:00.000Z',venue:'Kingsmead, Durban',sourceName:'Cricket Australia',sourceUrl:'https://www.cricket.com.au/matches/series/CA%3A4568/'},
  'fixture:cricket:espn:1525660':{name:'South Africa v Australia — Second Test',displayTitleCompact:'South Africa v Australia — Second Test',format:'Test',matchFormat:'Test',endDate:'2026-10-22',numberOfDays:5,startTimeUtc:'2026-10-18T08:00:00.000Z',venue:"St George's Park, Gqeberha",sourceName:'Cricket Australia',sourceUrl:'https://www.cricket.com.au/matches/series/CA%3A4568/'},
  'fixture:cricket:espn:1525661':{name:'South Africa v Australia — Third Test',displayTitleCompact:'South Africa v Australia — Third Test',format:'Test',matchFormat:'Test',endDate:'2026-10-31',numberOfDays:5,startTimeUtc:'2026-10-27T08:30:00.000Z',venue:'Newlands, Cape Town',sourceName:'Cricket Australia',sourceUrl:'https://www.cricket.com.au/matches/series/CA%3A4568/'},
  'fixture:cricket:espn:1525658':{name:'CSA Invitation XI v Australia',displayTitleCompact:'CSA Invitation XI v Australia',format:'Warm-up',matchFormat:'Warm-up',playingFormat:'Warm-up',competitionName:'Australia tour of South Africa · Warm-up',venue:'NWC Oval, Potchefstroom',endDate:'2026-10-04',numberOfDays:2,endTimeUtc:null,startTimeUtc:'2026-10-03T08:00:00.000Z',sourceUrl:'https://www.cricket.com.au/matches/series',sourceName:'Cricket Australia'},
  'rugby-new-zealand-australia-2026-10-10':{name:'All Blacks v Wallabies',displayTitleCompact:'All Blacks v Wallabies',startTimeUtc:'2026-10-10T06:10:00.000Z',venue:'Eden Park, Auckland',competitionName:'Bledisloe Cup',roundLabel:'First Test',sourceUrl:'https://edenpark.co.nz/events/all-blacks-v-australia-saturday-10-october-2026/',sourceName:'Eden Park'},
  'fixture:rugby:wr:e492d961-1f1e-4c37-b9d7-e9fd811459be':{roundLabel:'Grand Final',stage:'Grand Final',isFinals:true,competitionName:'Super Rugby AUS',sourceUrl:'https://www.rugby.com.au/news/force-waratahs-rat-park-superrugby-aus-report-2026927'}
 };
 function facts(id){return records[id]||null;}
 return {facts};
});
