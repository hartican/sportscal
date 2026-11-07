'use strict';
const officialTitle='Formula 1 Gulf Air Bahrain Grand Prix in Malaysia';
const sources=[
 {id:'source:f1:bahrain-relocation-2026',name:'Formula 1 and FIA confirm Bahrain Grand Prix relocation to Malaysia',url:'https://www.formula1.com/en/latest/article/formula-1-and-fia-confirm-malaysia-will-join-2026-calendar-as-host-venue-for-bahrain-grand-prix.6lL7vjFEM2VVynRHvg1TCf',sourceType:'official',checkedAt:'2026-09-29T23:17:33.658Z'},
 {id:'source:f1:bahrain-safety-2026',name:'Formula 1 statement on April races and regional safety',url:'https://www.formula1.com/en/latest/article/bahrain-and-saudi-arabian-grands-prix-will-not-take-place-in-april.1hnqllVG85RSt8pbFc5Ivx',sourceType:'official',checkedAt:'2026-09-29T23:17:33.658Z'}
];
const synopsis=`The ${officialTitle} brings the championship to Sepang on 2–4 October 2026. The event was relocated following safety concerns over regional conflict in the Middle East, which prevented the original April race in Bahrain. F1 and the FIA prioritised the safety of teams, officials and fans when arranging the replacement venue.`;
function applies(event){return (event.key||event.sportKey)==='f1'&&String(event.date||event.startTimeUtc||'').startsWith('2026-10')&&(event.circuitId==='circuit:f1:bahrain'||/bahrain/i.test(event.id||''));}
function title(name){return String(name||'').replace(/Bahrain GP(?: \(Malaysia\))?/, 'Bahrain GP (Malaysia)');}
module.exports={officialTitle,sources,synopsis,applies,title};
