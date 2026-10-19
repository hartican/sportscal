(function(root){
  'use strict';
  let sequence=0;
  function styles(doc){
    if(doc.getElementById('account-awareness-styles'))return;
    const style=doc.createElement('style');style.id='account-awareness-styles';
    style.textContent='.account-awareness-control{display:inline-flex;align-items:center;gap:7px;min-height:44px;max-width:100%;padding:6px 9px;border:1px solid var(--border,#b7bdc5);border-radius:999px;background:var(--panel-bg,transparent);color:var(--text,currentColor);font:inherit;font-size:12px;font-weight:750;cursor:pointer}.account-awareness-label{display:inline;white-space:nowrap}.account-awareness-avatar{display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;border-radius:50%;overflow:hidden;background:var(--soft-fill,#dce2e8);font-size:10px;line-height:1}.account-awareness-avatar img,.account-awareness-avatar svg{display:block;width:100%;height:100%;object-fit:cover}.account-awareness-control:focus-visible,.account-awareness-choice:focus-visible{outline:2px solid currentColor;outline-offset:3px}.account-awareness-dialog{box-sizing:border-box;width:min(360px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;margin:auto;padding:20px;border:1px solid var(--border,#b7bdc5);border-radius:16px;background:var(--bg-card,#fff);color:var(--text,#18212d);font:inherit}.account-awareness-dialog::backdrop{background:#0008}.account-awareness-dialog h2{margin:0 0 12px;font-size:18px;line-height:1.3}.account-awareness-dialog p{margin:10px 0;font-size:14px;line-height:1.5}.account-awareness-choices{display:grid;gap:8px;margin-top:18px}.account-awareness-choice{min-height:44px;padding:10px 12px;border:1px solid var(--border,#b7bdc5);border-radius:9px;background:transparent;color:inherit;font:inherit;font-size:14px;cursor:pointer}.account-awareness-choice-primary{background:var(--text,#18212d);color:var(--bg-card,#fff);border-color:var(--text,#18212d)}.account-awareness-feedback:empty{display:none}.account-awareness-feedback{display:block;font-size:12px;line-height:1.4}';
    doc.head.appendChild(style);
  }
  function create({host,model=root.NOTHINGSPORTS_ACCOUNT_AWARENESS,readSnapshot,openAccount}){
    // The host supplies facts/session from the frozen model contract. Account
    // navigation and action callbacks remain with the existing application.
    if(!host?.ownerDocument||!model||typeof readSnapshot!=='function'||typeof openAccount!=='function')throw new TypeError('Account UI needs a host, model and explicit state/account callbacks.');
    const doc=host.ownerDocument;styles(doc);
    const button=doc.createElement('button');button.type='button';button.className='account-awareness-control';
    const avatar=doc.createElement('span');avatar.className='account-awareness-avatar';avatar.setAttribute('aria-hidden','true');
    const label=doc.createElement('span');label.className='account-awareness-label';label.setAttribute('aria-live','polite');label.setAttribute('aria-atomic','true');
    const feedback=doc.createElement('span');feedback.className='account-awareness-feedback';feedback.setAttribute('role','status');
    button.append(avatar,label);host.append(button,feedback);
    let destroyed=false,previousScope=null,guestAcknowledgement=null,avatarKey='',avatarVersion=0,pending=null;
    const cancelled=reason=>({status:'cancelled',reason});
    function current(){
      const snapshot=readSnapshot(),view=model.accountView(snapshot.facts);
      return{view,scope:model.scopeFor(view,snapshot.session)};
    }
    function fallback(view){
      if(view.initials)avatar.textContent=view.initials;
      else avatar.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></svg>';
    }
    function render(){
      if(destroyed)return null;
      const context=current(),{view,scope}=context;
      if(previousScope&&!model.sameScope(previousScope,scope)){
        guestAcknowledgement=null;feedback.textContent='';
        if(pending?.stage==='dialog')pending.cancel('account-changed');
      }
      previousScope=scope;
      if(label.textContent!==view.label)label.textContent=view.label;
      button.setAttribute('aria-label',view.ariaLabel);button.title=view.ariaLabel;button.dataset.accountStatus=view.status;
      const key=JSON.stringify([view.accountId,view.avatarUrl,view.initials]);
      if(key!==avatarKey){
        avatarKey=key;const version=++avatarVersion;fallback(view);
        if(view.avatarUrl){
          const image=doc.createElement('img');image.alt='';image.decoding='async';
          image.onerror=()=>{if(!destroyed&&version===avatarVersion&&image.parentNode===avatar)fallback(view);};
          image.src=view.avatarUrl;avatar.replaceChildren(image);
        }
      }
      return context;
    }
    button.onclick=()=>{
      pending?.cancel('account-opened');feedback.textContent='';const context=render();
      if(!context)return;
      Promise.resolve().then(()=>openAccount({reason:'indicator',returnFocus:button,intentScope:context.scope})).catch(()=>{
        if(!destroyed&&model.sameScope(context.scope,current().scope))feedback.textContent='Account could not be opened. Please try again.';
      });
    };

    function prompt(ticket,decision,action,actionLabel,view){
      return new Promise(resolve=>{
        const dialog=doc.createElement('dialog');dialog.className='account-awareness-dialog';dialog.dataset.accountAwareness='';
        const title=doc.createElement('h2');title.id='account-awareness-title-'+(++sequence);
        const text=doc.createElement('p');
        if(decision==='prompt-guest'){
          title.textContent='You’re not signed in';
          text.textContent='Follows and saved fixtures will stay on this device. Sign in to keep changes with your account.';
        }else if(decision==='prompt-sign-in'){
          title.textContent=action==='rate'?'Sign in to rate':'Sign in to set a reminder';
          text.textContent=action==='rate'?'Your rating needs to be saved to your account.':'Sign in before turning on a reminder delivered by Nothing Sport.';
        }else{
          title.textContent=view.status==='checking'?'Checking your account':'Check your sign-in';text.textContent=view.status==='checking'?'Your sign-in is still being checked. You can open Account to check its status.':'Your account could not be confirmed. Open Account before making this change.';
        }
        text.id=title.id+'-detail';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',text.id);dialog.append(title,text);
        if(actionLabel){const target=doc.createElement('p');target.textContent=actionLabel;dialog.append(target);}
        const choices=doc.createElement('div');choices.className='account-awareness-choices';dialog.append(choices);
        let settled=false;
        const finish=choice=>{
          if(settled)return;settled=true;ticket.closeDialog=null;
          if(dialog.open)dialog.close();dialog.remove();
          if(choice!=='account'&&ticket.origin?.isConnected)ticket.origin.focus();
          resolve(choice);
        };
        const add=(text,choice,primary=false)=>{
          const b=doc.createElement('button');b.type='button';b.className='account-awareness-choice'+(primary?' account-awareness-choice-primary':'');b.textContent=text;b.onclick=()=>finish(choice);if(primary)b.autofocus=true;choices.append(b);
        };
        add(decision==='resolve-account'?'Open Account':'Sign in','account',true);
        if(decision==='prompt-guest')add('Continue on this device','local');
        add('Cancel','cancel');
        dialog.addEventListener('cancel',event=>{event.preventDefault();finish('cancel');});
        dialog.addEventListener('close',()=>finish('cancel'));
        ticket.closeDialog=()=>finish('cancel');doc.body.append(dialog);dialog.showModal();
      });
    }
    async function dispatch(action,options,context,ticket,decision){
      if(destroyed||ticket?.cancelled)return cancelled(ticket?.cancelled||'destroyed');
      const fresh=render();
      if(!model.sameScope(context.scope,fresh.scope))return cancelled('account-changed');
      if(model.actionDecision(action,fresh.view,{scope:fresh.scope,guestAcknowledgement})!==decision)return cancelled('account-unverified');
      if(options.isCurrent&&options.isCurrent()!==true)return cancelled('target-changed');
      try{
        const value=await options.perform({action,decision,view:fresh.view,scope:fresh.scope});
        if(destroyed||ticket?.cancelled||!model.sameScope(fresh.scope,current().scope))return cancelled('account-changed');
        return{status:'completed',decision,value};
      }catch(error){
        if(destroyed||ticket?.cancelled||!model.sameScope(fresh.scope,current().scope))return cancelled('account-changed');
        throw error;
      }
    }
    async function request(action,options={}){
      if(destroyed)return cancelled('destroyed');
      if(typeof options.perform!=='function')throw new TypeError('An explicit action callback is required.');
      const context=render(),decision=model.actionDecision(action,context.view,{scope:context.scope,guestAcknowledgement});
      if(decision==='continue-off'||decision==='continue-account'||decision==='continue-local')return dispatch(action,options,context,null,decision);
      if(decision==='cancel-stale')return cancelled('account-changed');
      if(pending)return cancelled('prompt-open');
      const ticket={stage:'dialog',origin:doc.activeElement,cancelled:'',closeDialog:null};
      let cancel;
      const cancellation=new Promise(resolve=>{cancel=resolve;});
      ticket.cancel=reason=>{if(ticket.cancelled)return;ticket.cancelled=reason;ticket.closeDialog?.();cancel(cancelled(reason));};
      pending=ticket;
      const workflow=async()=>{
        const choice=await prompt(ticket,decision,action,options.label,context.view);
        if(destroyed||ticket.cancelled)return cancelled(ticket.cancelled||'destroyed');
        if(choice==='cancel')return cancelled('dismissed');
        if(!model.sameScope(context.scope,current().scope))return cancelled('account-changed');
        if(choice==='local'){
          guestAcknowledgement=model.acknowledgeGuest(context.view,context.scope);
          return dispatch(action,options,context,ticket,'continue-local');
        }
        ticket.stage='account';
        // The host must resolve only an explicit, completed account journey.
        // These returned IDs cancel stale intent; they are not authentication.
        const result=await openAccount({reason:decision,action,label:options.label||'',returnFocus:ticket.origin,intentScope:context.scope});
        if(destroyed||ticket.cancelled)return cancelled(ticket.cancelled||'destroyed');
        if(!result?.signedIn)return{status:'account-required',decision};
        const fresh=render(),confirmed={appSessionId:result.appSessionId,accountEpoch:result.accountEpoch,accountId:result.accountId};
        if(context.scope.appSessionId!==fresh.scope.appSessionId||!model.sameScope(confirmed,fresh.scope))return cancelled('account-changed');
        const next=model.actionDecision(action,fresh.view,{scope:fresh.scope});
        if(next!=='continue-account')return{status:'account-required',decision:next};
        return dispatch(action,options,fresh,ticket,next);
      };
      try{return await Promise.race([workflow(),cancellation]);}
      finally{if(pending===ticket)pending=null;ticket.closeDialog?.();}
    }
    function destroy(){
      if(destroyed)return;destroyed=true;avatarVersion++;guestAcknowledgement=null;
      pending?.cancel('destroyed');button.remove();feedback.remove();
    }
    render();return Object.freeze({render,request,destroy});
  }
  root.NOTHINGSPORTS_ACCOUNT_AWARENESS_UI=Object.freeze({create});
})(typeof globalThis!=='undefined'?globalThis:this);
