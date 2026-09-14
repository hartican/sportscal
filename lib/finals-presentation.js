'use strict';

// Bracket slots retain their own identities. They are not public event titles.
function publicFixtureTitle(fixture){
  const title = fixture.displayName || fixture.name || '';
  const stage = String(fixture.stage || fixture.roundLabel || '');
  const identity = [fixture.key, fixture.competitionId, fixture.sportDomainId, fixture.id].join(' ');
  const league = /(?:^|[:\s-])afl(?:[:\s-]|$)/i.test(identity) ? 'AFL'
    : /(?:^|[:\s-])nrl(?:[:\s-]|$)/i.test(identity) ? 'NRL' : null;
  const unresolved = /\b(?:winner|loser|tbc|[1-8](?:st|nd|rd|th))\b/i.test(title);
  if (!league || !unresolved) return title;
  if (/grand final/i.test(stage)) return `${league} Grand Final`;
  const label = stage.match(/(?:preliminary|qualifying|elimination|semi|wildcard)\s*final/i)?.[0];
  if (!label || /qualifying\s*&/i.test(stage)) return title;
  return `${league} ${label.replace(/\b\w/g, c => c.toUpperCase())}`;
}

module.exports = { publicFixtureTitle };
