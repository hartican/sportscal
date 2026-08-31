"use strict";

const admin=require("./admin-moderation");
const nscServer=require("./nothingscore-server");
const modelledPanel=require("../api/_nsc-modelled-panel");
const{SupabaseRequestError,publicError,supabaseServiceRequest}=require("./supabase-server");

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

function panelPayload(status){
  const environmentMode=modelledPanel.mode(process.env.NSC_DEMO_PANEL_MODE);
  return{
    schemaVersion:"admin-early-panel.v1",...status,environmentMode,
    effectivePublicEnabled:environmentMode==="public"&&status.configured&&status.publicEnabled,
  };
}
async function panelHandler(request,response){
  admin.privateHeaders(response);
  try{
    if(!["GET","POST"].includes(request.method||"GET")){response.setHeader("Allow","GET, POST");response.status(405).json({error:"Early panel controls support GET and POST only.",code:"method_not_allowed"});return}
    const actor=await admin.adminUser(request),now=new Date();
    const before=await nscServer.earlyPanelStatus(now);
    if((request.method||"GET")==="GET"){response.status(200).json(panelPayload(before));return}
    const body=admin.bodyOf(request),action=String(body.action||"");
    if(!["retire-early-panel","restore-early-panel"].includes(action))throw new admin.AdminError("Unknown Early panel action.",400,"unknown_early_panel_action");
    if(body.confirm!==true)throw new admin.AdminError("Confirm this Early panel action explicitly.",409,"admin_confirmation_required");
    if(action==="retire-early-panel"&&!before.eligibleToRetire)throw new admin.AdminError("The Early panel can be retired after 10 approved, unsuspended contributors have participated within 90 days.",409,"early_panel_not_eligible");
    const publicEnabled=action==="restore-early-panel";
    if(before.publicEnabled!==publicEnabled){
      const timestamp=now.toISOString();
      await supabaseServiceRequest(nscServer.rowsPath(nscServer.TABLES.rollout,{id:"eq.public"}),{method:"PATCH",headers:{Prefer:"return=minimal"},body:{public_enabled:publicEnabled,retired_at:publicEnabled?null:timestamp,retired_by:publicEnabled?null:actor.id,updated_at:timestamp}});
      const after={...before,publicEnabled,retiredAt:publicEnabled?null:timestamp,updatedAt:timestamp};
      await admin.audit({actorUserId:actor.id,targetUserId:null,action,before:{publicEnabled:before.publicEnabled,activeRealContributors90d:before.activeRealContributors90d,retirementThreshold:before.retirementThreshold},after:{publicEnabled:after.publicEnabled,activeRealContributors90d:after.activeRealContributors90d,retirementThreshold:after.retirementThreshold}});
      response.status(200).json({...panelPayload(after),updated:true,action});return;
    }
    response.status(200).json({...panelPayload(before),updated:false,action});
  }catch(error){
    if(error instanceof SupabaseRequestError){const outgoing=publicError(error);response.status(outgoing.status).json(outgoing.body);return}
    admin.errorResponse(error,response,"The Early panel control is temporarily unavailable.");
  }
}

module.exports=Object.freeze({panelHandler,reportsHandler,usersHandler,_test:Object.freeze({panelPayload})});
