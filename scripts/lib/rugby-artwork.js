'use strict';
const manifest=require('../../data/canonical/rugby-artwork.v1.json');
const assets=new Map(manifest.assets.map(asset=>[asset.id,asset]));
function participant(id){return assets.get(id)||assets.get({'team:rugby:fijian-drua':'team:rugby:wr-3701'}[id]);}
function competition(item){return assets.get('competition:'+item.family)||assets.get(item.family);}
function decorate(record){const asset=participant(record.id||record.participantId);return asset?{...record,logoUrl:asset.path,logoDarkUrl:asset.path,crestSourceUrl:asset.sourceUrl}:record;}
function fixture(event){
 const item=require('../../config/rugby-coverage').competitions.find(c=>c.id===event.competitionId),mark=item&&competition(item);
 if(!/^rugby/.test(event.key||''))return event;
 return {...event,...(mark?{competitionLogoUrl:mark.path,competitionLogoSourceUrl:mark.sourceUrl,competitionName:item.label}:{}),...(event.participants?{participants:event.participants.map(decorate)}:{}),...(event.participantSlots?{participantSlots:event.participantSlots.map(decorate)}:{})};
}
module.exports={participant,competition,decorate,fixture};
