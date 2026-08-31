"use strict";

const admin=require("./admin-moderation");

async function usersHandler(request,response){
  admin.privateHeaders(response);
  try{
    if(!["GET","POST"].includes(request.method||"GET")){response.setHeader("Allow","GET, POST");response.status(405).json({error:"Admin users supports GET and POST only.",code:"method_not_allowed"});return}
    const actor=await admin.adminUser(request);
    if((request.method||"GET")==="GET"){response.status(200).json(await admin.usersPayload(admin.query(request,"q")));return}
    const body=admin.bodyOf(request),action=String(body.action||"");
    if(!admin.USER_ACTIONS.includes(action))throw new admin.AdminError("Unknown account action.",400,"unknown_account_action");
    if(body.confirm!==true)throw new admin.AdminError("Confirm this account action explicitly.",409,"admin_confirmation_required");
    const target=await admin.resolveSubject(body.subjectRef);
    const resolved=await admin.performAccountAction({action,targetUserId:target.id,actorUserId:actor.id});
    response.status(200).json({schemaVersion:"admin-users.v1",updated:true,action,...resolved});
  }catch(error){admin.errorResponse(error,response,"The owner user console is temporarily unavailable.")}
}

async function reportsHandler(request,response){
  admin.privateHeaders(response);
  try{
    if(!["GET","POST"].includes(request.method||"GET")){response.setHeader("Allow","GET, POST");response.status(405).json({error:"Admin reports supports GET and POST only.",code:"method_not_allowed"});return}
    const actor=await admin.adminUser(request);
    if((request.method||"GET")==="GET"){response.status(200).json(await admin.reportsPayload(admin.query(request,"status")));return}
    response.status(200).json({schemaVersion:"admin-reports.v1",...await admin.applyReportAction(admin.bodyOf(request),actor)});
  }catch(error){admin.errorResponse(error,response,"The moderation report console is temporarily unavailable.")}
}

module.exports=Object.freeze({reportsHandler,usersHandler});
