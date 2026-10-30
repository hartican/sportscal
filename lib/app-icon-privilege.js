'use strict';
const policy=require('../config/app-icon-choice');
async function forUser(userId){
 const server=require('./nothingscore-server');
 // The existing ledger constrains each award to 1–25 points. 100 rows
 // therefore suffice to decide this privilege without reading a lifetime ledger.
 const rows=await server.rows(server.TABLES.points,{user_id:`eq.${userId}`,select:'points',limit:'100'});
 if(rows.some(row=>!Number.isSafeInteger(Number(row.points))||Number(row.points)<1))throw new Error('Points unavailable');
 const {canChooseIcon,minimumPoints}=policy.capability(rows.reduce((total,row)=>total+Number(row.points),0));
 return {canChooseIcon,minimumPoints};
}
module.exports={forUser};
