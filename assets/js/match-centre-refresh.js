/* Touch-only enhancement; the same refresh action is exposed as a button. */
(() => {
 'use strict';
 globalThis.createMatchCentreRefresh=({panel,enabled,refresh})=>{
  const indicator=document.createElement('div');indicator.className='mc-refresh-indicator';indicator.setAttribute('aria-hidden','true');
  const wheel=document.createElement('span');wheel.className='mc-refresh-wheel';indicator.append(wheel);panel.before(indicator);
  let start=null,distance=0,busy=false;
  function paint(value,loading=false){indicator.classList.toggle('visible',value>0||loading);indicator.classList.toggle('loading',loading);panel.style.transform=value?`translateY(${value}px)`:'';wheel.style.transform=loading?'':`rotate(${distance*2}deg)`;}
  function reset(){start=null;distance=0;paint(0,busy);}
  function begin(e){
   reset();if(!enabled()||busy||e.touches.length!==1||window.scrollY>1||[...document.querySelectorAll('dialog[open],[role="dialog"]')].some(n=>n.getClientRects().length))return;
   if(e.target.closest('button,a,input,textarea,select,summary,[role="button"],[contenteditable="true"]'))return;
   for(let n=e.target;n&&n!==document.body;n=n.parentElement){if(n.scrollHeight>n.clientHeight+1&&/auto|scroll/.test(getComputedStyle(n).overflowY))return;}
   start={x:e.touches[0].clientX,y:e.touches[0].clientY};
  }
  function move(e){
   if(!start)return;if(!enabled()||e.touches.length!==1||window.scrollY>1){reset();return;}
   const dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;
   if(Math.abs(dx)>Math.max(10,Math.abs(dy))||dy<0){reset();return;}
   if(dy<8)return;if(e.cancelable)e.preventDefault();distance=dy;paint(Math.min(88,dy*.55));
  }
  function end(){const armed=distance>=72;reset();if(armed&&enabled()&&!busy)void refresh();}
  panel.addEventListener('touchstart',begin,{passive:true});panel.addEventListener('touchmove',move,{passive:false});panel.addEventListener('touchend',end);panel.addEventListener('touchcancel',reset);
  return {setBusy(value){busy=value;paint(value?40:0,value);},cancel(){busy=false;reset();},get pulling(){return distance>0;}};
 };
})();
