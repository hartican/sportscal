(function(root){
  'use strict';
  function normalizePreferences(raw){const p=raw&&typeof raw==='object'?raw:{};return {enabled:p.enabled===true,gameByCompetition:p.gameByCompetition?.['competition:premier-league']==='fpl-classic'?{'competition:premier-league':'fpl-classic'}:{}};}
  root.NOTHINGSPORTS_FANTASY_DEADLINES={normalizePreferences};
})(globalThis);
