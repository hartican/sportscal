'use strict';
async function comments(eventId,{rows,results=false}){
 if(!results)return[];
 const quotes=await rows('classic_comments',{event_id:'eq.'+eventId,order:'position.asc',select:'comment_id,author_user_id,body,score',limit:'3'});if(!quotes.length)return[];
 const ids=[...new Set(quotes.map(q=>q.author_user_id))],filter='in.('+ids.join(',')+')';
 const [profiles,personas,blocked]=await Promise.all([rows('nsc_profiles',{user_id:filter,visibility:'eq.visible',select:'user_id,handle'}),rows('nsc_personas',{user_id:filter,select:'user_id,moderation_flag'}),rows('account_erasure_blocks',{user_id:filter,select:'user_id'})]);
 const denied=new Set([...blocked,...personas.filter(p=>p.moderation_flag)].map(p=>p.user_id)),handles=new Map(profiles.filter(p=>!denied.has(p.user_id)).map(p=>[p.user_id,p.handle]));
 return quotes.filter(q=>handles.get(q.author_user_id)).map(q=>({id:q.comment_id,handle:'@'+handles.get(q.author_user_id),body:q.body,score:q.score}));
}
module.exports={comments};
