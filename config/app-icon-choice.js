(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NOTHINGSPORTS_APP_ICONS=api;})(globalThis,function(){
'use strict';
const DEFAULT='dark-full-colour',KEY='nsIcon';
const VARIANTS=Object.freeze([
 ['dark-full-colour','Dark glass'],['light-full-colour','Light glass'],['clear-glass','Clear glass'],['greyscale-dark','Grey dark'],['greyscale-light','Grey light'],['inverted','Pink glass'],['high-contrast-neon','Neon pink'],['monochrome-white','Monochrome']
].map(([id,label])=>Object.freeze({id,label})));
function normalize(id){return VARIANTS.some(v=>v.id===id)?id:DEFAULT;}
function capability(points){const n=typeof points==='number'&&Number.isFinite(points)?Math.max(0,points):0;return {points:n,minimumPoints:100,canChooseIcon:n>=100};}
return Object.freeze({DEFAULT,KEY,VARIANTS,normalize,capability});
});
