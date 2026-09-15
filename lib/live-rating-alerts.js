'use strict';
const webpush = require('web-push');
const server = require('./nothingscore-server');
const crowd = require('./nsc-crowd');
const {supabaseServiceRequest, USER_STATE_TABLE, userStateFromRow} = require('./supabase-server');
const discovery = require('../config/discovery-catalogue');

function currentEpicRaters(votes, followed, profiles, recipient, now){
  return crowd.latestVotes(votes, {phase:'pulse', excludeUser:recipient, now})
    .filter(vote => vote.rating === 5 && followed.has(vote.userId) && profiles.get(vote.userId)?.visibility === 'visible')
    .map(vote => ({id:vote.userId, name:profiles.get(vote.userId).display_name}));
}
function payload(event, raters){
  const others = raters.length - 1;
  const subject = others ? `${raters[0].name} and ${others} other${others === 1 ? '' : 's'} you follow` : `${raters[0].name}, who you follow,`;
  return {
    title:'Your follows rated this EPIC',
    body:`${subject} just rated ${event.name} as EPIC. Tap for details.`,
    tag:`epic-${event.eventId || event.id}`,
    url:`/?event=${encodeURIComponent(event.eventId || event.id)}&liveRatings=1`,
  };
}
async function dispatch({now = new Date(), api = server, request = supabaseServiceRequest, send = webpush.sendNotification.bind(webpush)} = {}){
  const alerts = await api.rows('nothingsports_live_rating_alerts', {
    completed_at:'is.null', ready_at:`lte.${now.toISOString()}`, order:'ready_at.asc', limit:'100',
  });
  // The common run has no due EPIC work. Do not rebuild every event snapshot
  // merely to discover an empty outbox.
  if(!alerts.length)return {checked:0,sent:0,failed:0,skipped:0};
  await api.refreshEventSnapshots();
  let sent = 0, failed = 0, skipped = 0;
  for (const alert of alerts){
    const finish = () => request(`/rest/v1/nothingsports_live_rating_alerts?id=eq.${alert.id}`, {method:'PATCH', body:{completed_at:now.toISOString()}});
    const source = api.eventFor(alert.event_id);
    const event = source && api.eventWithTiming(source);
    if (!event){
      await finish(); skipped++; continue;
    }
    const state = userStateFromRow((await api.rows(USER_STATE_TABLE, {user_id:`eq.${alert.recipient_user_id}`, select:'*', limit:'1'}))[0]);
    const prefs = state?.preferences && discovery.migratePreferences(state.preferences);
    // Suppressed groups remain pending briefly: a changed rating may become EPIC again.
    if (!prefs || prefs.followFirst?.notifications?.enabled === false || prefs.followFirst?.notifications?.liveRatingsEnabled === false
){
      await finish(); skipped++; continue;
    }
    const follows = await api.rows('nothingsports_user_follows', {follower_user_id:`eq.${alert.recipient_user_id}`, select:'followed_user_id'});
    const followed = new Set(follows.map(follow => follow.followed_user_id));
    const recommendations = await api.rows('nothingsports_friend_activity', {alert_id:`eq.${alert.id}`, select:'rater_user_id,phase'});
    const identities = await api.identityMaps([...followed]);
    const raters = [...new Map(recommendations.filter(r=>followed.has(r.rater_user_id) && r.rater_user_id!==alert.recipient_user_id && identities.profiles.get(r.rater_user_id)?.visibility==='visible' && !identities.personas.get(r.rater_user_id)?.moderation_flag).map(r=>[r.rater_user_id,{id:r.rater_user_id,name:identities.profiles.get(r.rater_user_id).display_name}])).values()];
    if (!raters.length){await finish();skipped++;continue;}
    const installations = await api.rows('nothingsports_push_installations', {
      user_id:`eq.${alert.recipient_user_id}`, permission:'eq.granted', live_ratings_enabled:'eq.true', select:'installation_id,endpoint,p256dh,auth_key',
    });
    for (const installation of installations){
      const claimed = await request('/rest/v1/rpc/nothingsports_claim_live_rating_delivery', {
        method:'POST', body:{target_alert:alert.id, target_installation:installation.installation_id},
      });
      if (!claimed?.length) continue;
      let status = 'sent';
      try {
        await send({endpoint:installation.endpoint, keys:{p256dh:installation.p256dh, auth:installation.auth_key}}, JSON.stringify({...payload(event, raters),tag:`friend-picks-${alert.id}`}), {TTL:86400, urgency:'normal'});
        sent++;
      } catch (error){
        failed++;
        const code = Number(error.statusCode);
        // Retry only a confirmed rejection. An unknown transport outcome may already have delivered.
        status = code >= 500 || code === 429 ? 'pending' : code ? 'failed' : 'uncertain';
        if (claimed[0].attempts >= 3 && status === 'pending') status = 'failed';
      }
      await request(`/rest/v1/nothingsports_live_rating_deliveries?alert_id=eq.${alert.id}&installation_id=eq.${installation.installation_id}`, {
        method:'PATCH', body:{status, updated_at:now.toISOString()},
      });
    }
    if (!installations.length) await finish();
    if (installations.length){
      const deliveries = await api.rows('nothingsports_live_rating_deliveries', {alert_id:`eq.${alert.id}`, select:'installation_id,status'});
      // A concurrent worker may still be sending. Never close its retry window.
      if (installations.every(installation => deliveries.some(delivery => delivery.installation_id === installation.installation_id
        && ['sent','uncertain','failed'].includes(delivery.status)))) await finish();
    }
  }
  return {checked:alerts.length, sent, failed, skipped};
}
module.exports = {dispatch, currentEpicRaters, payload};
