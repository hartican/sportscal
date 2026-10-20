'use strict';
const policy=require('../../config/cricket-editorial-policy');
const fields=policy.fields;
const reviewFingerprint=entry=>require('node:crypto').createHash('sha256').update(JSON.stringify([fields.map(field=>entry[field]||''),entry.evidenceMode,entry.editorialPhase,entry.coverageThrough||null,entry.validUntil,entry.sourceObservations,entry.facts,entry.paragraphClaims])).digest('hex');
const normal=text=>String(text||'').replace(/\s+/g,' ').trim();
const dated=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===value.slice(0,10);
const instant=value=>dated(value)&&value.includes('T');
const knownFailures=/\b(?:two reasonable ideas collide|moving (?:its|their|the) pieces|something more tangible than a selection slogan|selection slogan|ideas? (?:collide|clash)|chess(?:board| pieces)?|dressing room asks|sustained partnerships and disciplined pressure|only time will tell|everything to play for|How it is unfolding)\b|\?/i;
const structuredState=/\b(?:stumps|day\s+\d+|(?:resume|resumption|restart)\s+(?:at|time)|rain delay|play suspended)\b|\b\d+\s*[\/-]\s*\d+\b|\b\d+(?:\.\d+)?\s+overs\b/i;
function origin(source){
  const value=normal(source?.originId).toLowerCase();
  // Origin is the reporting organisation/agency, never the syndicating host.
  if(/\breuters\b/.test(value))return 'reuters';
  if(/\baap\b|australian associated press/.test(value))return 'aap';
  return value;
}
function journalistic(source){return source?.reportingType==='journalism'&&source.accessible===true&&dated(source.publishedAt)&&normal(source.author)&&normal(source.publisher)&&origin(source);}
function independentSupport(claim,sources){
  const origins=new Set(),bases=new Set();
  for(const evidence of claim.support||[]){
    const source=sources[evidence.sourceIndex],key=origin(source),basis=normal(evidence.basisId);
    if(!journalistic(source)||!basis||origins.has(key)||bases.has(basis))continue;
    origins.add(key);bases.add(basis);
  }
  return origins.size;
}
function metadata(entry){
  return Object.fromEntries(['editorialPolicyVersion','evidenceMode','coverageThrough','validUntil'].map(field=>[field,entry[field]]).concat([['phase',entry.editorialPhase],['reviewed',entry.editorialReview?.verdict==='pass']]));
}
function issues(entry,event={},now=new Date()){
  const errors=[],fail=text=>errors.push(text),sources=entry.sourceObservations||[],claims=entry.facts||[];
  if(entry.editorialPolicyVersion!==policy.version)fail('Cricket policy version required.');
  if(!['synthesis','fact-brief','withheld'].includes(entry.evidenceMode))fail('Explicit cricket evidence mode required.');
  if(!['preview','ongoing','recap'].includes(entry.editorialPhase))fail('Explicit cricket editorial phase required.');
  if(!instant(entry.researchedAt)||Date.parse(entry.researchedAt)>+now||+now-Date.parse(entry.researchedAt)>72*3600000)fail('Fresh research observation required.');
  if(!instant(entry.validUntil)||Date.parse(entry.validUntil)<=+now)fail('Unexpired validity deadline required.');
  if(entry.editorialPhase==='ongoing'){
    const coverage=Date.parse(entry.coverageThrough);
    if(!instant(entry.coverageThrough)||coverage>+now||+now-coverage>=policy.DAY)fail('Current reporting requires a coverage cutoff within 24 hours.');
    if(Date.parse(entry.validUntil)>coverage+policy.DAY)fail('Current reporting cannot outlive evidence by more than 24 hours.');
  }
  const start=Date.parse(event.startTimeUtc||'');
  if(entry.editorialPhase==='preview'&&Number.isFinite(start)&&Date.parse(entry.validUntil)>start)fail('Preview validity cannot extend beyond the confirmed start.');
  if(entry.editorialPhase!==policy.phase(event,now))fail('Research phase does not match the structured fixture state.');
  const review=entry.editorialReview;
  if(review?.verdict!=='pass'||!instant(review.reviewedAt)||Date.parse(review.reviewedAt)>+now||Date.parse(review.reviewedAt)<Date.parse(entry.researchedAt)||!['support','attribution','phase','spoilers','duplication','style'].every(check=>review.checks?.includes(check)))fail('Separate complete editorial review required.');
  if(review?.contentSha256!==reviewFingerprint(entry)||typeof review?.passId!=='string'||!normal(review.passId)||typeof review?.draftPassId!=='string'||!normal(review.draftPassId)||normal(review.passId)===normal(review.draftPassId))fail('Review must bind the exact evidence/copy in a separate pass.');
  const usage=entry.researchUsage;
  if(!usage||!Number.isInteger(usage.searches)||usage.searches<0||usage.searches>2||!Number.isInteger(usage.articleReads)||usage.articleReads<0||usage.articleReads>6||usage.drafts!==1||usage.reviews!==1||![0,1].includes(usage.corrections))fail('Research/draft/review allowance exceeded or unrecorded.');
  const text=fields.map(field=>entry[field]||'').join(' '),words=normal(text).split(/\s+/).filter(Boolean);
  for(const field of fields)if(String(entry[field]||'').length>(field==='hook'?180:700))fail('Paragraph exceeds compatibility length: '+field);
  const paragraphs=fields.map(field=>normal(entry[field])).filter(Boolean);
  if(new Set(paragraphs).size!==paragraphs.length)fail('Duplicate editorial paragraphs.');
  if(words.length>150)fail('Cricket editorial must not exceed 150 words.');
  if(knownFailures.test(text))fail('Rejected filler, metaphor or rhetorical question.');
  if(structuredState.test(text))fail('Match score, day and status belong to structured match data.');
  if(entry.evidenceMode==='withheld'){
    if(normal(text)||!normal(entry.withheldReason))fail('Withheld editorial requires empty paragraphs and a reason.');
    return errors;
  }
  if(!normal(text)||!claims.length)fail('Nonempty editorial requires supported claims.');
  if(sources.length!==(entry.sources||[]).length)fail('Complete source observations required.');
  sources.forEach((source,index)=>{
    if(source.url!==entry.sources?.[index]||!/^https:\/\//.test(source.url||'')||!normal(source.name)||!normal(source.publisher)||!normal(source.author)||!origin(source)||!dated(source.publishedAt)||Date.parse(source.publishedAt)>+now||!dated(source.retrievedAt)||source.accessible!==true||!instant(source.checkedAt)||Date.parse(source.checkedAt)>Date.parse(entry.researchedAt)||!['journalism','official-announcement','governing-body-reporting'].includes(source.reportingType)||!['official','broadcaster','reputable'].includes(source.sourceType))fail('Incomplete or inaccessible source '+index+'.');
    if(source.updatedAt!=null&&(!dated(source.updatedAt)||Date.parse(source.updatedAt)<Date.parse(source.publishedAt)))fail('Invalid source update date '+index+'.');
  });
  const byId=new Map(claims.map(claim=>[claim.claimId,claim]));
  if(byId.size!==claims.length||claims.some(claim=>!normal(claim.claimId)))fail('Claims require unique stable identifiers.');
  claims.forEach(claim=>{
    if(!['fact','opinion','disputed'].includes(claim.claimType)||!normal(claim.statement)||!claim.sourceIndexes?.length||!claim.support?.length)fail('Claim type and support required: '+claim.claimId);
    if((claim.claimType!=='fact'||entry.evidenceMode==='fact-brief')&&!normal(claim.attribution))fail('Named attribution required: '+claim.claimId);
    if(claim.supersededAt||claim.expiresAt&&Date.parse(claim.expiresAt)<=+now)fail('Superseded or expired claim: '+claim.claimId);
    if(claim.claimType==='disputed'&&!claim.contradictorySupport?.length)fail('Disputed claims require contradictory evidence.');
    for(const evidence of [...(claim.support||[]),...(claim.contradictorySupport||[])]){
      if(!Number.isInteger(evidence.sourceIndex)||!sources[evidence.sourceIndex]||!normal(evidence.excerpt)||!normal(evidence.basisId)||!(claim.sourceIndexes||[]).includes(evidence.sourceIndex))fail('Invalid claim support: '+claim.claimId);
    }
    if(claim.agreement===true&&independentSupport(claim,sources)<2)fail('Agreement is not independently supported: '+claim.claimId);
    for(const quote of claim.quotes||[])if(!normal(quote.speaker)||!normal(quote.text)||!claim.support.some(s=>normal(s.excerpt).includes(normal(quote.text))))fail('Unverified quote: '+claim.claimId);
  });
  const used=new Set();
  for(const field of fields){
    const spans=entry.paragraphClaims?.[field]||[];
    if(normal(spans.map(span=>span.text).join(' '))!==normal(entry[field]))fail('Every sentence requires a claim mapping: '+field);
    for(const span of spans){
      if(!span.claimIds?.length)fail('Unmapped editorial sentence: '+field);
      for(const id of span.claimIds||[]){
        const claim=byId.get(id);used.add(id);
        if(!claim)fail('Unknown mapped claim '+id);
        else if((claim.claimType!=='fact'||entry.evidenceMode==='fact-brief')&&!normal(span.text).includes(normal(claim.attribution)))fail('Attribution missing from published sentence: '+id);
        if(/[“”"]/.test(span.text)&&!claim?.quotes?.some(quote=>normal(span.text).includes(normal(quote.text))))fail('Quotation has no verified support: '+id);
      }
    }
  }
  if(entry.evidenceMode==='synthesis'){
    const support=claims.filter(c=>used.has(c.claimId)).flatMap(c=>c.support||[]).filter(s=>journalistic(sources[s.sourceIndex]));
    const count=Math.min(new Set(support.map(s=>origin(sources[s.sourceIndex]))).size,new Set(support.map(s=>s.basisId)).size);
    if(count<2)fail('Synthesis requires two independent journalistic origins.');
  }
  if(/\b(?:consensus|agree(?:s|ment)?|widely (?:believed|accepted))\b/i.test(text)&&!claims.some(c=>used.has(c.claimId)&&c.agreement===true&&independentSupport(c,sources)>=2))fail('Consensus language lacks claim-level agreement.');
  return errors;
}
function assertPublicationApproved(entries){
  if(!entries.some(entry=>entry.editorialPolicyVersion===policy.version))return;
  const approval=require('../../config/cricket-editorial-approval.json');
  if(approval.policyVersion!==policy.version||!instant(approval.initialSampleApprovedAt)||!normal(approval.approvalEvidence))throw Error('Initial cricket sample approval is pending; retain local drafts without publication.');
}
module.exports={issues,metadata,origin,independentSupport,knownFailures,structuredState,assertPublicationApproved,reviewFingerprint};
