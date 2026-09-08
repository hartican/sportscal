'use strict';
const server=require('./nothingscore-server'),{supabaseServiceRequest:request}=require('./supabase-server');
const TABLE='nothingsports_user_follows';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function setFollow(body,user,{api=server,request:query=request}={}){
 if(!user?.id)throw Object.assign(new Error("Sign in to follow people."),{status:401});
 if(!uuid.test(body.targetProfileId||''))throw Object.assign(new Error('Choose a public profile.'),{status:400});
 const following=body.following!==false;
 const target=(await api.rows(api.TABLES.profiles,{profile_id:`eq.${body.targetProfileId}`,...(following?{visibility:'eq.visible'}:{}),select:'user_id,profile_id',limit:'1'}))[0];
 if(!target || target.user_id===user.id || (following && (await api.personaFor(target.user_id)).moderation_flag))throw Object.assign(new Error('That profile cannot be followed.'),{status:400});
 if(following)await query(`/rest/v1/${TABLE}?on_conflict=follower_user_id,followed_user_id`,{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{follower_user_id:user.id,followed_user_id:target.user_id}});
 else await query(`/rest/v1/${TABLE}?follower_user_id=eq.${user.id}&followed_user_id=eq.${target.user_id}`,{method:'DELETE'});
 return {targetProfileId:target.profile_id,following};
}
async function followingProfileIds(user,{request:query=request}={}){
 if(!user)return new Set();
 const follows=await query(`/rest/v1/${TABLE}?follower_user_id=eq.${user.id}&select=followed_user_id`);
 if(!follows.length)return new Set();
 const profiles=await query(`/rest/v1/${server.TABLES.profiles}?user_id=in.(${follows.map(f=>f.followed_user_id).join(',')})&visibility=eq.visible&select=profile_id`);
 return new Set(profiles.map(p=>p.profile_id));
}
module.exports={setFollow,followingProfileIds};
