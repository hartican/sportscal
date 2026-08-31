(function attachNscVisual(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_NSC_VISUAL = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNscVisualModule(){
  "use strict";

  function ensureStyles(){
    if (document.getElementById("nsc-visual-styles")) return;
    const style = document.createElement("style");
    style.id = "nsc-visual-styles";
    style.textContent = `.nsc-visual{min-width:0;margin:12px 0 4px;padding:10px;border:1px solid var(--border);border-radius:11px;background:var(--panel-bg);overflow:hidden}.nsc-visual figcaption{color:var(--text);font-size:.72rem;font-weight:900}.nsc-visual svg{display:block;width:100%;height:auto;max-height:180px;margin-top:6px;overflow:visible}.nsc-legend{display:flex;flex-wrap:wrap;gap:7px 12px;margin-top:5px;color:var(--text-dim);font-size:.6rem}.nsc-legend span{display:inline-flex;align-items:center;gap:5px}.nsc-legend i{width:9px;height:9px;border-radius:3px;background:var(--accent)}.nsc-legend-modelled i{background:#ff4faf}.nsc-grid-line{stroke:color-mix(in srgb,var(--text-dim) 16%,transparent);stroke-width:1}.nsc-series-real,.nsc-series-modelled{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.nsc-series-modelled{stroke:#ff4faf;stroke-dasharray:6 5}.nsc-bar-real{fill:var(--accent)}.nsc-bar-modelled{fill:#ff4faf}.nsc-axis-label{fill:var(--text-dim);font:700 10px 'DM Sans',sans-serif}.nsc-percent-label{fill:var(--text);font:800 9px 'DM Sans',sans-serif}.nsc-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}`;
    document.head.appendChild(style);
  }

  function build(snapshot, { phaseName = "Build-up" } = {}){
    const phase = snapshot?.phase || "heat";
    const rows = phase === "pulse" ? snapshot?.series?.pulse : snapshot?.series?.distribution;
    if (!Array.isArray(rows) || !rows.length) return null;
    ensureStyles();
    const figure = document.createElement("figure");
    figure.className = "nsc-visual";
    const caption = document.createElement("figcaption");
    caption.textContent = phase === "pulse" ? "Five-minute Pulse" : `${phaseName} rating distribution`;
    const legend = document.createElement("div");
    legend.className = "nsc-legend";
    [["real","Community responses"],["modelled","Modelled responses"]].forEach(([kind,label]) => {
      const item = document.createElement("span");
      item.className = `nsc-legend-${kind}`;
      const swatch = document.createElement("i");
      swatch.setAttribute("aria-hidden","true");
      item.append(swatch, document.createTextNode(label));
      legend.appendChild(item);
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 300 120");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", caption.textContent);
    const add = (name, attributes) => {
      const node=document.createElementNS("http://www.w3.org/2000/svg",name);
      Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,String(value)));
      svg.appendChild(node);
      return node;
    };
    [1,2,3,4,5].forEach(value => {
      const y=100-(value-1)*20;
      add("line",{x1:22,y1:y,x2:292,y2:y,class:"nsc-grid-line"});
    });
    if (phase === "pulse"){
      const points = key => rows.map((row,index)=>row[key]==null?null:`${24+(rows.length===1?0:index*268/(rows.length-1))},${100-(Number(row[key])-1)*20}`).filter(Boolean).join(" ");
      const realPoints=points("realScore"),modelledPoints=points("modelledScore");
      if(realPoints)add("polyline",{points:realPoints,class:"nsc-series-real"});
      if(modelledPoints)add("polyline",{points:modelledPoints,class:"nsc-series-modelled"});
    } else {
      rows.forEach((row,index)=>{
        const x=35+index*53,realHeight=(Number(row.realPercent)||0)*.72,modelledHeight=(Number(row.modelledPercent??row.demoPercent)||0)*.72;
        add("rect",{x:x-10,y:100-realHeight,width:16,height:realHeight,class:"nsc-bar-real",rx:3});
        add("rect",{x:x+8,y:100-modelledHeight,width:16,height:modelledHeight,class:"nsc-bar-modelled",rx:3});
        const percentage=add("text",{x:x+7,y:Math.max(12,96-Math.max(realHeight,modelledHeight)),"text-anchor":"middle",class:"nsc-percent-label"});
        percentage.textContent=`${Number(row.displayPercent)||0}%`;
        const label=add("text",{x:x+7,y:115,"text-anchor":"middle",class:"nsc-axis-label"});
        label.textContent=String(row.rating);
      });
    }
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "nsc-visually-hidden";
    const table = document.createElement("table");
    const tableCaption=document.createElement("caption");
    tableCaption.textContent=`Accessible data for ${caption.textContent}`;
    table.appendChild(tableCaption);
    if(phase==="pulse"){
      table.innerHTML += "<thead><tr><th>Bucket</th><th>Score</th><th>Community responses</th><th>Modelled responses</th></tr></thead>";
      const body=document.createElement("tbody");
      rows.forEach(row=>{const tr=document.createElement("tr");[new Date(row.bucketStart).toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"}),row.score??"Building",row.realContributors,row.modelledContributors??row.demoContributors].forEach(value=>{const td=document.createElement("td");td.textContent=String(value);tr.appendChild(td)});body.appendChild(tr)});
      table.appendChild(body);
    }else{
      table.innerHTML += "<thead><tr><th>Rating</th><th>Community responses</th><th>Community percent</th><th>Modelled responses</th><th>Modelled percent</th><th>Displayed percent</th></tr></thead>";
      const body=document.createElement("tbody");
      rows.forEach(row=>{const tr=document.createElement("tr");[row.rating,row.realCount,`${row.realPercent}%`,row.modelledCount??row.demoCount,`${row.modelledPercent??row.demoPercent}%`,`${row.displayPercent}%`].forEach(value=>{const td=document.createElement("td");td.textContent=String(value);tr.appendChild(td)});body.appendChild(tr)});
      table.appendChild(body);
    }
    tableWrapper.appendChild(table);
    figure.append(caption,legend,svg,tableWrapper);
    return figure;
  }

  return Object.freeze({ build });
});
