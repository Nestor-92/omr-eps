(function(){
"use strict";
var VERSION="v8";
var scanRows=[],scanRatios=[];

function q(s){return document.querySelector(s)}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]})}
function cfg(){return config()}
function legacyProfile(){return {name:"basket5",rows:[
 {label:"Possessions de l'équipe",boxes:15,top:91},
 {label:"Tirs tentés",boxes:15,top:127},
 {label:"Tirs favorables",boxes:12,top:163},
 {label:"Tirs non favorables",boxes:12,top:199},
 {label:"Paniers sur tirs favorables",boxes:10,top:234}
]}}
function activeProfile(c){return {name:"active",rows:c.rows.map(function(r){return {label:r.label,boxes:r.boxes,top:r.y+7}})}}

function borderInk(gray,top,n,c){
 var S=5,take=Math.min(n,10),total=0,count=0;
 for(var j=0;j<take;j++){
  var x=Math.round((c.x0+j*(c.box+c.gap))*S),y=Math.round(top*S),b=Math.round(c.box*S);
  var rs=[new cv.Rect(x,Math.max(0,y-2),b,5),new cv.Rect(x,Math.max(0,y+b-2),b,5),new cv.Rect(Math.max(0,x-2),y,5,b),new cv.Rect(Math.max(0,x+b-2),y,5,b)];
  rs.forEach(function(rr){
   if(rr.x>=0&&rr.y>=0&&rr.x+rr.width<=gray.cols&&rr.y+rr.height<=gray.rows){
    var roi=gray.roi(rr),bin=new cv.Mat();cv.threshold(roi,bin,160,255,cv.THRESH_BINARY_INV);
    total+=cv.countNonZero(bin)/(bin.rows*bin.cols);count++;roi.delete();bin.delete();
   }
  });
 }
 return count?total/count:0;
}
function chooseProfile(gray,c){
 var lp=legacyProfile(),scores=lp.rows.map(function(r){return borderInk(gray,r.top,r.boxes,c)});
 var avg=scores.slice(1).reduce(function(a,b){return a+b},0)/4;
 return avg>.16?lp:activeProfile(c);
}
async function readOneV8(file,c){
 var src=await fileMat(file),wr=rectify(src,c),gray=new cv.Mat();cv.cvtColor(wr,gray,cv.COLOR_RGBA2GRAY);
 var profile=chooseProfile(gray,c),values=[],amb=false;
 profile.rows.forEach(function(r){
  var vals=[];for(var j=0;j<r.boxes;j++)vals.push(darkness(gray,c.x0+j*(c.box+c.gap),r.top,c.box));
  values.push(vals.filter(function(v){return v>.18}).length);
  if(vals.some(function(v){return v>.08&&v<.45}))amb=true;
 });
 src.delete();wr.delete();gray.delete();
 return {fiche:file.name.replace(/\.[^.]+$/,""),values:values,profile:profile.name,profileRows:profile.rows,verification:amb?"A_VERIFIER":"OK"};
}
function ratioName(ra){return (ra.label||"").trim()||((scanRows[ra.num]?scanRows[ra.num].label:"Indicateur")+" / "+(scanRows[ra.den]?scanRows[ra.den].label:"Indicateur"))}
function ratioVal(r,ra){var n=Number((r.values||[])[ra.num]||0),d=Number((r.values||[])[ra.den]||0);return {n:n,d:d,pct:d>0?Math.max(0,Math.min(100,n/d*100)):null}}

function ensureUI(){
 var badge=document.querySelector("h1 + span");if(badge)badge.textContent=VERSION;
 var old=document.querySelector("#create .ratio-builder");if(old)old.remove();
 var progress=q("#progress");
 if(progress&&!q("#analysisTools")){
  var box=document.createElement("div");box.id="analysisTools";box.className="card hidden";box.style.cssText="background:#fafafa;margin-top:16px";
  box.innerHTML='<h3 style="margin-top:0">Personnaliser les résultats</h3><p class="small">Les indicateurs détectés apparaissent ci-dessous. Vous pouvez corriger leur nom puis créer les ratios à afficher en pourcentage.</p><div class="section-label">Nom des indicateurs</div><div id="resultLabels"></div><div class="section-label">Ratios / pourcentages</div><div id="scanRatios"></div><button id="addScanRatio" class="secondary">+ Ajouter un ratio / pourcentage</button>';
  progress.parentNode.insertBefore(box,q("#results"));
 }
 q("#addScanRatio").onclick=function(){
  if(scanRows.length<2)return;
  if(scanRatios.length>=6){alert("Maximum 6 ratios.");return}
  scanRatios.push({label:"",num:Math.min(1,scanRows.length-1),den:0});renderTools();renderResultsV8();
 };
}
function renderTools(){
 var labels=q("#resultLabels");labels.innerHTML="";
 scanRows.forEach(function(r,i){
  var d=document.createElement("div");d.className="grid";d.style.gridTemplateColumns="1fr";
  d.innerHTML='<input data-slabel="'+i+'" value="'+esc(r.label)+'">';labels.appendChild(d);
 });
 labels.querySelectorAll("[data-slabel]").forEach(function(x){x.oninput=function(e){var i=+e.target.dataset.slabel;scanRows[i].label=e.target.value||("Indicateur "+(i+1));renderTools();renderResultsV8()}});
 var el=q("#scanRatios");el.innerHTML="";
 var opts=scanRows.map(function(r,i){return '<option value="'+i+'">'+esc(r.label||("Indicateur "+(i+1)))+'</option>'}).join("");
 scanRatios.forEach(function(ra,i){
  var d=document.createElement("div");d.className="ratio-row";
  d.innerHTML='<input data-sri="'+i+'" data-srk="label" placeholder="Nom du ratio" value="'+esc(ra.label||"")+'"><select data-sri="'+i+'" data-srk="num">'+opts+'</select><select data-sri="'+i+'" data-srk="den">'+opts+'</select><button class="secondary" data-srdel="'+i+'">×</button>';
  el.appendChild(d);d.querySelector('[data-srk="num"]').value=String(ra.num);d.querySelector('[data-srk="den"]').value=String(ra.den);
 });
 el.querySelectorAll("[data-sri]").forEach(function(x){x.oninput=function(e){var i=+e.target.dataset.sri,k=e.target.dataset.srk;scanRatios[i][k]=k==="label"?e.target.value:+e.target.value;renderResultsV8()}});
 el.querySelectorAll("[data-srdel]").forEach(function(x){x.onclick=function(){scanRatios.splice(+x.dataset.srdel,1);renderTools();renderResultsV8()}});
}
function renderResultsV8(){
 if(!lastResults.length){q("#results").innerHTML="";return}
 var c=cfg(),html='<div class="result-head"><div><h3 style="margin:0;font-size:24px">Résultats</h3><div class="small">'+lastResults.length+' fiche'+(lastResults.length>1?"s":"")+' analysée'+(lastResults.length>1?"s":"")+'</div></div></div>';
 lastResults.forEach(function(r,idx){
  html+='<div class="result-card"><div class="result-title">'+esc(c.groupeEleve||("Fiche "+(idx+1)))+'</div><div class="result-meta">'+esc(r.fiche||"Sans nom")+(c.classe?" · "+esc(c.classe):"")+'</div>';
  if(r.erreur)html+='<div class="warn">⚠ Lecture impossible : '+esc(r.erreur)+'</div>';
  else{
   html+='<div class="section-label">Comptages</div><div class="metrics">';
   scanRows.forEach(function(row,i){html+='<div class="metric"><div class="metric-label">'+esc(row.label)+'</div><div><span class="metric-value">'+esc((r.values||[])[i]||0)+'</span><span class="metric-unit">occ.</span></div></div>'});
   html+='</div>';
   if(scanRatios.length){
    html+='<div class="section-label">Ratios et pourcentages</div><div class="ratios-view">';
    scanRatios.forEach(function(ra){var v=ratioVal(r,ra),pct=v.pct===null?null:Math.round(v.pct*10)/10,deg=pct===null?0:pct*3.6;html+='<div class="ratio-card"><div class="pie" style="background:conic-gradient(#222 0 '+deg+'deg,#e3e3e3 '+deg+'deg 360deg)"><div class="pie-center">'+(pct===null?"—":pct+"%")+'</div></div><div><div class="ratio-name">'+esc(ratioName(ra))+'</div><div class="ratio-big">'+(pct===null?"—":pct+" %")+'</div><div class="ratio-detail">'+v.n+" / "+v.d+(v.d===0?" · dénominateur nul":"")+'</div></div></div>'});
    html+='</div>';
   }
   html+=(String(r.verification||"").toLowerCase()!=="ok"?'<div class="warn">⚠ Vérification conseillée</div>':'<div class="ok">✓ Lecture effectuée</div>');
  }
  html+='</div>';
 });
 q("#results").innerHTML=html;
}
async function analyse(){
 if(!window.cvReady||typeof cv==="undefined"||!cv.Mat){alert("Le moteur d'analyse se charge encore. Réessayez dans quelques secondes.");return}
 var fs=Array.from(q("#photos").files);if(!fs.length){alert("Ajoutez au moins une photo.");return}
 saveConfig();var c=cfg();lastResults=[];scanRows=[];scanRatios=[];q("#progress").classList.remove("hidden");q("#exports").classList.add("hidden");q("#analysisTools").classList.add("hidden");q("#results").innerHTML="";
 for(var i=0;i<fs.length;i++){
  q("#progress").textContent="Lecture "+(i+1)+"/"+fs.length+" : "+fs[i].name;
  try{
   var r=await readOneV8(fs[i],c);lastResults.push(r);
   if(!scanRows.length){
    scanRows=r.profileRows.map(function(x){return {label:x.label,boxes:x.boxes}});
    if(r.profile==="basket5")scanRatios=[
     {label:"Tirs / possessions",num:1,den:0},
     {label:"Tirs favorables / tirs",num:2,den:1},
     {label:"Paniers sur tirs favorables / tirs favorables",num:4,den:2}
    ];
   }
  }catch(e){lastResults.push({fiche:fs[i].name,erreur:e.message,values:[]})}
 }
 q("#progress").textContent="Analyse terminée : "+lastResults.length+" fiche"+(lastResults.length>1?"s":"")+".";
 if(scanRows.length){q("#analysisTools").classList.remove("hidden");renderTools()}
 renderResultsV8();q("#exports").classList.remove("hidden");
}
function exportCSV(){
 if(!lastResults.length)return;
 var cols=["fiche"].concat(scanRows.map(function(r){return r.label}),scanRatios.map(function(r){return ratioName(r)+" (%)"}),["verification"]);
 var quote=function(v){return '"'+String(v==null?"":v).replaceAll('"','""')+'"'};
 var lines=lastResults.map(function(r){return [r.fiche].concat(scanRows.map(function(_,i){return (r.values||[])[i]??r.erreur??""}),scanRatios.map(function(ra){var v=ratioVal(r,ra);return v.pct===null?"":Math.round(v.pct*10)/10}),[r.verification||""]).map(quote).join(";")});
 var data="\ufeff"+cols.map(quote).join(";")+"\n"+lines.join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));a.download="resultats_omr.csv";a.click();
}
function exportPDF(){
 if(!lastResults.length)return;
 var jsPDF=window.jspdf.jsPDF,d=new jsPDF({unit:"mm",format:"a4"}),c=cfg();
 var clean=function(t){return String(t==null?"":t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g," ")};
 function header(){d.setFillColor(245,245,245);d.rect(0,0,210,34,"F");d.setTextColor(25);d.setFont("helvetica","bold");d.setFontSize(17);d.text(clean(c.title||"Resultats OMR EPS"),15,16);d.setFont("helvetica","normal");d.setFontSize(9);if(c.classe)d.text("Classe / groupe : "+clean(c.classe),15,25)}
 function pie(cx,cy,r,pct){d.setFillColor(230);d.circle(cx,cy,r,"F");if(pct!==null&&pct>0){d.setFillColor(45);var a0=-Math.PI/2,steps=Math.max(3,Math.ceil(pct/4));for(var i=0;i<steps;i++){var a1=a0+(pct/100)*2*Math.PI*i/steps,a2=a0+(pct/100)*2*Math.PI*(i+1)/steps;d.triangle(cx,cy,cx+r*Math.cos(a1),cy+r*Math.sin(a1),cx+r*Math.cos(a2),cy+r*Math.sin(a2),"F")}}d.setFillColor(255);d.circle(cx,cy,r*.58,"F");d.setTextColor(25);d.setFont("helvetica","bold");d.setFontSize(8);d.text(pct===null?"-":Math.round(pct*10)/10+"%",cx,cy+1.3,{align:"center"})}
 header();var y=45;
 lastResults.forEach(function(r,idx){
  var need=24+Math.ceil(scanRows.length/3)*24+Math.ceil(scanRatios.length/2)*36;if(y+need>284){d.addPage();header();y=45}
  d.setTextColor(25);d.setFont("helvetica","bold");d.setFontSize(13);d.text(clean(c.groupeEleve||("Fiche "+(idx+1))),15,y);d.setFont("helvetica","normal");d.setFontSize(8);d.setTextColor(105);d.text(clean(r.fiche||""),15,y+5);y+=12;
  if(r.erreur){d.setTextColor(140,80,0);d.text("Lecture impossible : "+clean(r.erreur),15,y);y+=12;return}
  d.setTextColor(100);d.setFont("helvetica","bold");d.setFontSize(8);d.text("COMPTAGES",15,y);y+=5;
  scanRows.forEach(function(row,i){var col=i%3,rr=Math.floor(i/3),x=15+col*61,yy=y+rr*24;d.setFillColor(247);d.roundedRect(x,yy,56,19,2,2,"F");d.setTextColor(90);d.setFont("helvetica","normal");d.setFontSize(7);d.text(clean(row.label).slice(0,29),x+4,yy+6);d.setTextColor(20);d.setFont("helvetica","bold");d.setFontSize(15);d.text(String((r.values||[])[i]||0),x+4,yy+15)});
  y+=Math.ceil(scanRows.length/3)*24+3;
  if(scanRatios.length){d.setTextColor(100);d.setFont("helvetica","bold");d.setFontSize(8);d.text("RATIOS ET POURCENTAGES",15,y);y+=5;scanRatios.forEach(function(ra,i){var col=i%2,rr=Math.floor(i/2),x=15+col*91,yy=y+rr*36,v=ratioVal(r,ra),pct=v.pct;d.setFillColor(250);d.roundedRect(x,yy,86,31,2,2,"F");pie(x+15,yy+15.5,10,pct);d.setTextColor(25);d.setFont("helvetica","bold");d.setFontSize(7.5);d.text(clean(ratioName(ra)).slice(0,31),x+30,yy+9);d.setFontSize(12);d.text(pct===null?"-":Math.round(pct*10)/10+" %",x+30,yy+18);d.setFont("helvetica","normal");d.setFontSize(7);d.setTextColor(105);d.text(v.n+" / "+v.d,x+30,yy+25)});y+=Math.ceil(scanRatios.length/2)*36+2}
  d.setDrawColor(225);d.line(15,y,195,y);y+=8;
 });
 d.save("resultats_omr.pdf");
}
function init(){
 ensureUI();
 q("#analyse").onclick=analyse;
 q("#csv").onclick=exportCSV;
 q("#pdfResults").onclick=exportPDF;
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();