"use strict";

const admin=require("../lib/admin-moderation");

module.exports=async function adminReportsHandler(request,response){
  admin.privateHeaders(response);
  try{
    if(!["GET","POST"].includes(request.method||"GET")){response.setHeader("Allow","GET, POST");response.status(405).json({error:"Admin reports supports GET and POST only.",code:"method_not_allowed"});return}
    const actor=await admin.adminUser(request);
    if((request.method||"GET")==="GET"){response.status(200).json(await admin.reportsPayload(admin.query(request,"status")));return}
    response.status(200).json({schemaVersion:"admin-reports.v1",...await admin.applyReportAction(admin.bodyOf(request),actor)});
  }catch(error){admin.errorResponse(error,response,"The moderation report console is temporarily unavailable.")}
};
