(function(root){
 'use strict';
 function build(fixture,{showResults=false}={}){
  const details=document.createElement('details');details.className='tennis-tie-details';details.style.flexBasis='100%';
  const summary=document.createElement('summary');summary.textContent='Tie details';details.append(summary);
  const line=value=>{const p=document.createElement('p');p.textContent=value;details.append(p);};
  line([fixture.roundLabel,fixture.venue,fixture.broadcaster].filter(Boolean).join(' · '));
  if(showResults&&fixture.score)line(`${fixture.status==='completed'?'Result':'Tie score (in progress)'}: ${fixture.score}${fixture.outcomeText?' · '+fixture.outcomeText:''}`);
  for(const match of fixture.rubbers||[]){
   const sides=[...(match.sides||[])].sort((a,b)=>(fixture.participantIds||[]).indexOf(a.teamId)-(fixture.participantIds||[]).indexOf(b.teamId));
   const names=sides.length?sides.map(s=>s.names.join(' / ')).join(' v '):'Players to be confirmed';
   const label=`${match.order}. ${match.matchType}: ${names}`;
   // A winner-first score must identify its winner; the no-results view never
   // inherits the source article's winner-first presentation order.
   if(showResults&&match.status==='completed')line(`${label} — ${match.sides[0].names.join(' / ')} won ${match.score}`);
   else if(showResults&&match.status==='not-required')line(`${match.order}. Doubles — not required`);
   else line(label+(match.conditional?' · if required':''));
  }
  const source=document.createElement('a');source.href=fixture.resultSourceUrl||fixture.sourceUrl;source.textContent='Official schedule and results';source.target='_blank';source.rel='noopener noreferrer';details.append(source);
  return details;
 }
 root.NOTHINGSPORTS_TENNIS_TIE_DETAILS={build};
})(globalThis);
