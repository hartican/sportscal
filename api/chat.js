"use strict";
module.exports=function retiredChat(_request,response){
 response.setHeader('Cache-Control','no-store');
 response.status(410).json({error:'Chat has retired. Your fixtures, ratings and follows remain available.',code:'feature_retired'});
};
