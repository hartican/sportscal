"use strict";

// Real people only; server-owned curator personas supply the approved weight.
function peerResults(rows, { viewerId = null, phase, detail = false } = {}){
  const latest = new Map();
  const timestamp = row => Date.parse(row.updated_at || row.updatedAt || row.submitted_at || row.created_at || "") || 0;
  for (const row of rows || []){
    const user = row.user_id || row.userId;
    const rating = Number(row.rating);
    if (!user || row.demo === true || row.modelled === true || row.phase !== phase || !Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    if (!latest.has(user) || timestamp(row) >= timestamp(latest.get(user))) latest.set(user, row);
  }
  const own = latest.get(viewerId);
  const peers = [...latest.entries()].filter(([id]) => id !== viewerId).map(([,row]) => row);
  const count = peers.length;
  const rawAverage=require('../config/epic-classics').average(peers);
  const average = rawAverage===null?null:Math.round(rawAverage*10)/10;
  const result = { phase, count, average, rawAverage, weighting:'curators-8x', early:count > 0 && count < 3, source:"real-users", excludesViewer:true };
  if (!detail) return result;
  const distribution = [1,2,3,4,5].map(rating => {
    const votes = peers.filter(row => Number(row.rating) === rating).length;
    return { rating, count:votes, percent:count ? Math.round(votes / count * 1000) / 10 : 0 };
  });
  const tagCounts = new Map();
  peers.forEach(row => new Set(row.tags || []).forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  return { ...result, distribution, tags:[...tagCounts].map(([tag,count]) => ({tag,count})).sort((a,b) => b.count-a.count || a.tag.localeCompare(b.tag)),
    comparison:own && count ? { rating:Number(own.rating), difference:Math.round((Number(own.rating)-average)*10)/10, sameRatingCount:distribution.find(bin => bin.rating === Number(own.rating)).count } : null };
}
module.exports = { peerResults };
