'use strict';
const unused=['dateOfBirth','heightInCm','recruitedFrom','debutYear'];
function player(record){const result={...record};for(const key of unused)delete result[key];return result;}
function directory(document){return {...document,players:document.players.map(player)};}
module.exports={unused,player,directory};
