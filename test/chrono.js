/* OMR EPS — extension chronologique expérimentale. Données traitées localement. */
(()=>{'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pupils=[], readings=[], active=null, corrections=new Map();
const CONFIG_STORE='omreps_chrono_config_test_v1';
const markers=[[14,14],[196,14],[14,283],[196,283]];
const ROWS_PER_PAGE=30, ROW_START=91, ROW_PITCH=6, BOX_SIZE=4.2;
const boxColumns=c=>c.hand?.length?[[99,107,115,123],[153,161,169,177]]:[[51,59,67,75],[112,120,128,136]];
const clean=s=>String(s??'').trim();
const norm=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const get=(r,...keys)=>{let k=Object.keys(r).find(k=>keys.map(norm).includes(norm(k)));return k?r[k]:''};
function mode(){let on=$('sheetMode').value==='chrono';$('chronoCreate').classList.toggle('hidden',!on);$('classicCreate').classList.toggle('hidden',on);$('chronoScan').classList.toggle('hidden',!on);$('configSummary').textContent=on?'Mode chronologique : importer les pages et utiliser le bouton de lecture chronologique.':'Mode historique';$('analyse').classList.toggle('hidden',on);$('photos').classList.toggle('hidden',on);$('pdfResults').classList.toggle('hidden',on);$('csv').classList.toggle('hidden',on);$('exports').classList.add('hidden')}
$('sheetMode').addEventListener('change',mode);mode();
function parsePupilSheet(sheet){
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',blankrows:false});
 const headerIndex=rows.findIndex(row=>row.some(v=>norm(v)==='nom') && row.some(v=>['vma','prenom','prenom','identifiant','id','classe'].includes(norm(v))));
 if(headerIndex<0)throw Error('En-têtes introuvables : ajouter une ligne avec « Nom » et « VMA » (ou « Prénom », « ID », « Classe »).');
 const headers=rows[headerIndex].map(clean);
 const prefix=rows.slice(0,headerIndex).flat().map(clean).find(v=>/^classe\s*[:\-]?\s*\S+/i.test(v));
 const defaultClass=prefix?prefix.replace(/^classe\s*[:\-]?\s*/i,'').trim():'';
 const result=rows.slice(headerIndex+1).filter(row=>row.some(v=>clean(v)!=='')).map((row,i)=>{
   const fields={};headers.forEach((h,j)=>{if(h)fields[h]=row[j]??''});
   return {id:clean(get(fields,'identifiant','id','numero','numéro'))||'E'+String(i+1).padStart(4,'0'),nom:clean(get(fields,'nom')),prenom:clean(get(fields,'prenom','prénom')),classe:clean(get(fields,'classe'))||defaultClass,fields};
 });
 if(!result.length)throw Error('Aucun élève trouvé sous la ligne d’en-têtes.');
 if(result.some(p=>!p.nom&&!p.prenom))throw Error('Certaines lignes ne contiennent pas de nom : vérifier le tableau.');
 if(new Set(result.map(p=>p.id)).size!==result.length)throw Error('Identifiants en double. Corriger le fichier.');
 return {result,defaultClass};
}
$('chImport').addEventListener('change',async e=>{let file=e.target.files[0];if(!file)return;try{
 if(!window.XLSX)throw Error('Bibliothèque Excel non chargée (connexion nécessaire).');
 let b=await file.arrayBuffer(),wb=XLSX.read(b,{type:'array'}),parsed=parsePupilSheet(wb.Sheets[wb.SheetNames[0]]);
 pupils=parsed.result;
 $('chImportStatus').textContent=pupils.length+' élève(s) importé(s) avec nom'+(parsed.defaultClass?' — classe '+parsed.defaultClass:'')+'. Vérifie les noms avant de générer le PDF.';
}catch(err){pupils=[];$('chImportStatus').textContent='Import impossible : '+err.message;}});
function setup(){let steps=Math.max(1,Math.min(120,Number($('chSteps').value)||30));let cats=[$('chCat1').value,$('chCat2').value].map(s=>s.split(';').map(clean).filter(Boolean));if(cats.some(a=>a.length<2||a.length>4))throw Error('Chaque indicateur doit avoir entre 2 et 4 catégories.');let c={title:clean($('chTitle').value)||'Observation chronologique',unit:clean($('chUnit').value)||'Étape',steps,cats,field:clean($('chField').value)||'VMA',pages:Math.ceil(steps/ROWS_PER_PAGE),hand:($('chHand').value.split(';').map(clean).filter(Boolean))};if(c.hand.length>2)throw Error('Deux indicateurs manuscrits maximum par fiche.');if(c.hand.some(x=>x.length>18))throw Error('Intitulé manuscrit trop long (18 caractères maximum).');c.sig=String([c.title,c.unit,c.steps,c.cats.map(a=>a.join('|')).join('/'),c.field,...(c.hand||[])].join('~').split('').reduce((h,ch)=>((h*31+ch.charCodeAt(0))>>>0),2166136261));return c}
function remember(c){try{localStorage.setItem(CONFIG_STORE,JSON.stringify(c))}catch(e){}}
function restore(){try{let c=JSON.parse(localStorage.getItem(CONFIG_STORE)||'null');if(c&&c.sig&&c.steps&&Array.isArray(c.cats)){active=c;return true}}catch(e){}return false}
function packConfig(c){return btoa(unescape(encodeURIComponent(JSON.stringify([c.title,c.unit,c.steps,c.cats,c.field,...(c.hand?.length?[c.hand]:[])]))))}
function unpackConfig(data){let a=JSON.parse(decodeURIComponent(escape(atob(data))));if(!Array.isArray(a)||(a.length!==5&&a.length!==6))throw Error('Configuration QR invalide');let [title,unit,steps,cats,field,hand=[]]=a;if(typeof title!=='string'||typeof unit!=='string'||typeof field!=='string'||!Number.isInteger(steps)||steps<1||steps>120||!Array.isArray(cats)||cats.length!==2||cats.some(x=>!Array.isArray(x)||x.length<2||x.length>4||x.some(v=>typeof v!=='string')))throw Error('Configuration QR incorrecte');if(!Array.isArray(hand)||hand.length>2||hand.some(x=>typeof x!=='string'||x.length>18))throw Error('Colonnes manuscrites incorrectes');let c={title,unit,steps,cats,field,hand,pages:Math.ceil(steps/ROWS_PER_PAGE)};c.sig=String([c.title,c.unit,c.steps,c.cats.map(a=>a.join('|')).join('/'),c.field,...(c.hand||[])].join('~').split('').reduce((h,ch)=>((h*31+ch.charCodeAt(0))>>>0),2166136261));return c}
function qrText(c,p,page){let named=$('chQRIdentity').value==='name'&&clean(p.nom+' '+p.prenom);let who=named?encodeURIComponent(JSON.stringify([p.nom,p.prenom,p.classe])):'';return 'OMREPS-'+(c.hand?.length?'CH3':'CH2')+'|'+packConfig(c)+'|'+encodeURIComponent(p.id)+'|'+page+'|'+c.pages+(named?'|'+who:'')}
function drawQR(pdf,c,p,page){let q=new QRious({value:qrText(c,p,page),size:350,level:'L',padding:12});pdf.addImage(q.toDataURL('image/png'),'PNG',151,30,40,40)}
function drawPage(d,c,p,page){let from=page*ROWS_PER_PAGE,n=Math.min(ROWS_PER_PAGE,c.steps-from),left=21,xCols=boxColumns(c),size=BOX_SIZE,ys=[];
 d.setFillColor(0);markers.forEach(([x,y])=>d.rect(x-3,y-3,6,6,'F'));
 d.setFont('helvetica','bold');d.setFontSize(14);d.text(c.title.slice(0,46),105,28,{align:'center'});
 d.setFont('helvetica','normal');d.setFontSize(9);d.text('Eleve : '+(p.nom+' '+p.prenom).trim().slice(0,45),left,41);d.text('Classe : '+p.classe.slice(0,35),left,47);d.text('ID : '+p.id.slice(0,30),left,53);
 let val=get(p.fields,c.field);d.text(c.field.slice(0,18)+' : '+String(val||'________').slice(0,20),left,59);
 drawQR(d,c,p,page+1);d.setFontSize(8);d.text('Page '+(page+1)+' / '+c.pages+' — noircir une case par groupe.',left,68);
 d.setFont('helvetica','bold');d.setFontSize(8);d.text(c.unit.slice(0,12),left,87);
 c.cats.forEach((arr,k)=>{
   let base=c.hand?.length?(k?151:98):(k?110:48);
   d.setFont('helvetica','bold');d.setFontSize(8);d.text('Indicateur '+(k+1),base,73);
   d.setFont('helvetica','normal');d.setFontSize(6.5);
   // La légende reste lisible même avec des intitulés longs.
   arr.forEach((v,j)=>{let letter=String(j+1);let label=letter+' = '+v;
     d.text(label.slice(0,c.hand?.length?17:24),base+(j%2)*(c.hand?.length?26:37),78+Math.floor(j/2)*4);
     d.setFont('helvetica','bold');d.setFontSize(8);
     d.text(letter,xCols[k][j]+size/2,87,{align:'center'});
     d.setFont('helvetica','normal');d.setFontSize(6.5);
   });
 });
 if(c.hand?.length){d.setFont('helvetica','bold');d.setFontSize(7);c.hand.forEach((name,j)=>d.text(name.slice(0,18),j?60:30,87));}
 for(let i=0;i<n;i++){let y=ROW_START+i*ROW_PITCH;ys.push(y);d.setDrawColor(220);d.setLineWidth(0.12);d.line(20,y+5.8,c.hand?.length?190:150,y+5.8);if(c.hand?.length){d.setDrawColor(210);c.hand.forEach((_,j)=>{let x=j?60:30;d.line(x,y+5.2,x+25,y+5.2)});}d.setFont('helvetica','normal');d.setFontSize(8);d.text(String(from+i+1),left,y+4);d.setDrawColor(0,0,0);d.setLineWidth(0.35);c.cats.forEach((arr,k)=>arr.forEach((_,j)=>d.rect(xCols[k][j],y,size,size)));d.setLineWidth(0.2);}
 d.setFontSize(7);d.text('OMR EPS — repères noirs visibles ; cases bien noircies.',left,276);
}
$('chGenerate').onclick=()=>{try{if(!window.jspdf||!window.QRious)throw Error('Bibliothèques PDF/QR indisponibles.');let c=setup(),ps=pupils.length?pupils:[{id:'ANONYME',nom:'',prenom:'',classe:'',fields:{}}];let d=new jspdf.jsPDF({unit:'mm',format:'a4'}),first=true;for(let p of ps)for(let page=0;page<c.pages;page++){if(!first)d.addPage();first=false;drawPage(d,c,p,page)}active=c;remember(c);d.save('omr_eps_chronologique.pdf');$('chImportStatus').textContent=ps.length+' fiche(s), '+c.pages+' page(s) par fiche. Configuration prête pour la lecture.';}catch(e){alert('Génération : '+e.message)}};
function cvFromFile(file){return new Promise((resolve,reject)=>{let im=new Image(),url=URL.createObjectURL(file);im.onload=()=>{let can=document.createElement('canvas');can.width=im.naturalWidth;can.height=im.naturalHeight;can.getContext('2d').drawImage(im,0,0);URL.revokeObjectURL(url);resolve(cv.imread(can))};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Image illisible'))};im.src=url})}
function corners(src){let gray=new cv.Mat(),bw=new cv.Mat(),cs=new cv.MatVector(),h=new cv.Mat();try{cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.threshold(gray,bw,110,255,cv.THRESH_BINARY_INV);cv.findContours(bw,cs,h,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);let W=gray.cols,H=gray.rows,a=[];for(let i=0;i<cs.size();i++){let co=cs.get(i),r=cv.boundingRect(co),area=cv.contourArea(co);co.delete();if(area>180&&r.width>14&&r.height>14&&r.width/r.height>.55&&r.width/r.height<1.55){let x=r.x+r.width/2,y=r.y+r.height/2;if((x<W*.3||x>W*.7)&&(y<H*.25||y>H*.75))a.push({x,y})}}if(a.length<4)throw Error('Repères non détectés');let targets=[[0,0],[W,0],[0,H],[W,H]],used=new Set();return targets.map(([x,y])=>{let ranked=a.map((p,i)=>({p,i,d:(p.x-x)**2+(p.y-y)**2})).sort((a,b)=>a.d-b.d),found=ranked.find(o=>!used.has(o.i));used.add(found.i);return found.p})}finally{gray.delete();bw.delete();cs.delete();h.delete()}}
function rectify(src){let pts=corners(src),S=5,s=cv.matFromArray(4,1,cv.CV_32FC2,pts.flatMap(p=>[p.x,p.y])),d=cv.matFromArray(4,1,cv.CV_32FC2,markers.flatMap(p=>[p[0]*S,p[1]*S])),M=cv.getPerspectiveTransform(s,d),out=new cv.Mat();cv.warpPerspective(src,out,M,new cv.Size(1050,1485));s.delete();d.delete();M.delete();return out}
function decode(wr){if(typeof jsQR==='undefined')throw Error('Lecteur QR indisponible');let can=document.createElement('canvas');can.width=wr.cols;can.height=wr.rows;cv.imshow(can,wr);let ctx=can.getContext('2d');let img=ctx.getImageData(750,140,205,205),r=jsQR(img.data,img.width,img.height,{inversionAttempts:'attemptBoth'});if(!r){let full=ctx.getImageData(0,0,can.width,can.height);r=jsQR(full.data,full.width,full.height,{inversionAttempts:'attemptBoth'})}if(!r||!/^OMREPS-CH[123]\|/.test(r.data))throw Error('QR chronologique non reconnu');let bits=r.data.split('|');if(bits[0]==='OMREPS-CH2'||bits[0]==='OMREPS-CH3'){let config=unpackConfig(bits[1]);let identity=null;if(bits[5]){try{let a=JSON.parse(decodeURIComponent(bits[5]));if(Array.isArray(a)&&a.length===3&&a.every(x=>typeof x==='string'&&x.length<=100))identity={nom:a[0],prenom:a[1],classe:a[2]}}catch(e){throw Error('Identité QR illisible')}}return {sig:config.sig,config,id:decodeURIComponent(bits[2]),page:Number(bits[3]),pages:Number(bits[4]),identity}}return {sig:bits[1],config:null,id:decodeURIComponent(bits[2]),page:Number(bits[3]),pages:Number(bits[4])}}
function fill(gray,x,y){let S=5,pad=.65,rect=new cv.Rect(Math.round((x+pad)*S),Math.round((y+pad)*S),Math.round((BOX_SIZE-2*pad)*S),Math.round((BOX_SIZE-2*pad)*S)),roi=gray.roi(rect),bin=new cv.Mat();try{cv.threshold(roi,bin,150,255,cv.THRESH_BINARY_INV);return cv.countNonZero(bin)/(bin.rows*bin.cols)}finally{roi.delete();bin.delete()}}
async function read(file,c){let src=await cvFromFile(file),wr,gray;try{wr=rectify(src);let meta=decode(wr);if(meta.config)c=meta.config;if(!c)throw Error('Ancienne fiche CH1 : activer sa configuration manuellement.');if(meta.sig!==c.sig||meta.pages!==c.pages||meta.page<1||meta.page>c.pages)throw Error('La configuration ne correspond pas au QR code de cette fiche. Réutiliser les paramètres exacts de création, sans regénérer de PDF.');gray=new cv.Mat();cv.cvtColor(wr,gray,cv.COLOR_RGBA2GRAY);let xCols=boxColumns(c),n=Math.min(ROWS_PER_PAGE,c.steps-(meta.page-1)*ROWS_PER_PAGE),records=[],amb=false;for(let i=0;i<n;i++){let vals=[],issues=[];for(let k=0;k<2;k++){let v=c.cats[k].map((_,j)=>fill(gray,xCols[k][j],ROW_START+i*ROW_PITCH));let hits=v.map((x,j)=>({x,j})).filter(o=>o.x>.24);let uncertain=v.some(x=>x>.10&&x<=.24);let status=hits.length>1?'multiple':hits.length===0?'empty':uncertain?'uncertain':'ok';if(status!=='ok')amb=true;issues.push({status,hits:hits.map(h=>h.j),scores:v.map(x=>Number(x.toFixed(2)))});vals.push(status==='ok'?hits[0].j:null)}records.push({step:(meta.page-1)*ROWS_PER_PAGE+i+1,vals,issues})}return {...meta,records,amb,file:file.name,config:c}}finally{src.delete();if(wr)wr.delete();if(gray)gray.delete()}}
restore();
$('chAnalyse').onclick=async()=>{if(!window.cvReady){alert('OpenCV se charge encore.');return}let fs=[...$('chPhotos').files];if(!fs.length){alert('Ajouter les photos.');return}readings=[];corrections.clear();$('chProgress').classList.remove('hidden');for(let i=0;i<fs.length;i++){ $('chProgress').textContent='Lecture '+(i+1)+'/'+fs.length;try{let result=await read(fs[i],active);if(!active){active=result.config;remember(active)}if(result.config.sig!==active.sig)throw Error('Cette photo correspond à un autre modèle de fiche : analyser séparément les modèles différents.');readings.push(result)}catch(e){readings.push({file:fs[i].name,error:e.message})}}if(active){$('chConfigStatus').textContent='Configuration reconnue depuis le QR code autonome.';render();$('chCSV').classList.remove('hidden');$('chClassCSV').classList.remove('hidden')}else $('chConfigStatus').textContent='Aucune fiche reconnue. Pour les anciennes fiches CH1, active leur configuration manuellement.'};
function aggregate(){
 let groups=new Map();
 for(let r of readings){
  if(r.error)continue;
  if(!groups.has(r.id))groups.set(r.id,{id:r.id,identity:r.identity||null,pages:new Set(),data:new Map(),issues:new Map(),amb:false,duplicate:false});
  let g=groups.get(r.id);if(r.identity)g.identity=r.identity;
  if(g.pages.has(r.page))g.duplicate=true;
  g.pages.add(r.page);
  for(let a of r.records){
   g.data.set(a.step,[...a.vals]);
   g.issues.set(a.step,a.issues);
  }
 }
 for(let g of groups.values()){
  for(let [step,issues] of g.issues){
   for(let k=0;k<2;k++){
    let key=JSON.stringify([g.id,step,k]);
    if(corrections.has(key))g.data.get(step)[k]=corrections.get(key);
    else if(issues[k].status!=='ok')g.amb=true;
   }
  }
 }
 return [...groups.values()];
}
function stats(g,k){
 let counts=active.cats[k].map(()=>0),total=0;
 for(let v of g.data.values())if(v[k]!==null){counts[v[k]]++;total++}
 return {counts,total};
}
function render(){
 let c=active,html='<h3>Tableau de bord enseignant — classe</h3>';
 let groups=aggregate();
 let okCount=groups.filter(g=>!g.amb&&!g.duplicate&&g.pages.size===c.pages).length;
 html+='<p class="small">'+groups.length+' élève(s) identifié(s) · '+okCount+' fiche(s) complète(s) sans anomalie · '+readings.filter(r=>r.error).length+' photo(s) non reconnue(s). Les pourcentages sont calculés sur les réponses valides.</p>';
 html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>Élève</th><th>Pages</th>';
 for(let k=0;k<2;k++)for(let cat of c.cats[k])html+='<th>'+esc(cat)+' (%)</th>';
 html+='<th>Contrôle</th></tr></thead><tbody>';
 for(let g of groups){let p=pupils.find(p=>p.id===g.id),name=p?`${p.prenom} ${p.nom}`:g.identity?`${g.identity.prenom} ${g.identity.nom}`:g.id;
  html+='<tr style="border-top:1px solid #ddd"><td>'+esc(name)+'</td><td>'+g.pages.size+'/'+c.pages+'</td>';
  for(let k=0;k<2;k++){let st=stats(g,k);for(let count of st.counts)html+='<td style="text-align:center">'+(st.total?(100*count/st.total).toFixed(1):'—')+'</td>'}
  html+='<td>'+(g.duplicate?'Doublon · ':'')+(g.pages.size<c.pages?'Page manquante · ':'')+(g.amb?'À vérifier':'OK')+'</td></tr>';
 }
 html+='</tbody></table></div><h3>Résultats détaillés par élève</h3>';
 for(let r of readings.filter(r=>r.error))html+='<p class="warn">'+esc(r.file)+' : '+esc(r.error)+'</p>';
 for(let g of aggregate()){
  let p=pupils.find(p=>p.id===g.id),name=p?`${p.prenom} ${p.nom} (${p.classe})`:g.identity?`${g.identity.prenom} ${g.identity.nom} (${g.identity.classe})`:g.id;
  let unresolved=0, corrected=0, issuesHtml='';
  for(let [step,issues] of [...g.issues].sort((a,b)=>a[0]-b[0])){
   for(let k=0;k<2;k++){
    let issue=issues[k],key=JSON.stringify([g.id,step,k]),fixed=corrections.has(key);
    if(issue.status==='ok'&&!fixed)continue;
    if(fixed)corrected++;else unresolved++;
    let desc=issue.status==='multiple'?'Plusieurs cases noircies':issue.status==='empty'?'Aucune case reconnue':issue.status==='uncertain'?'Marquage incertain':'Réponse corrigée';
    let selected=g.data.get(step)?.[k];
    issuesHtml+='<div style="padding:9px 0;border-bottom:1px solid #ddd"><strong>'+esc(c.unit)+' '+step+' — Indicateur '+(k+1)+'</strong> : '+desc+(fixed?' (corrigée)':'')+'<div style="margin-top:6px"><label>Correction : <select class="ch-fix" data-id="'+esc(g.id)+'" data-step="'+step+'" data-k="'+k+'"><option value=""'+(selected===null?' selected':'')+'>Non renseigné / invalide</option>';
    c.cats[k].forEach((cat,j)=>issuesHtml+='<option value="'+j+'"'+(selected===j?' selected':'')+'>'+esc(cat)+'</option>');
    issuesHtml+='</select></label></div></div>';
   }
  }
  html+='<div class="result-card"><b>'+esc(name)+'</b><p class="small">'+g.pages.size+'/'+c.pages+' page(s)';
  if(g.duplicate)html+=' · doublon de page';
  if(unresolved)html+=' · '+unresolved+' anomalie(s) à vérifier';
  if(corrected)html+=' · '+corrected+' correction(s)';
  html+='</p>';
  for(let k=0;k<2;k++){
   let st=stats(g,k);
   html+='<b>Indicateur '+(k+1)+'</b><div class="metrics">';
   c.cats[k].forEach((cat,j)=>html+='<div class="metric"><div class="metric-label">'+esc(cat)+'</div><div class="metric-value">'+st.counts[j]+'</div><small>'+(st.total?(100*st.counts[j]/st.total).toFixed(1)+' %':'—')+'</small></div>');
   html+='</div>';
  }
  html+='<details><summary><strong>Voir les '+c.steps+' minutes — '+esc(name)+'</strong></summary><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>'+esc(c.unit)+'</th><th>'+esc(c.labels?.[0]||"Indicateur 1")+'</th><th>'+esc(c.labels?.[1]||"Indicateur 2")+'</th></tr></thead><tbody>';
  for(let step=1;step<=c.steps;step++){let v=g.data.get(step)||[null,null];html+='<tr style="border-top:1px solid #ddd"><td>'+step+'</td>'+v.map((x,k)=>'<td>'+(x===null?'À vérifier / non renseigné':esc(c.cats[k][x]))+'</td>').join('')+'</tr>'}
  html+='</tbody></table></div></details>';
  if(issuesHtml)html+='<details><summary><strong>Contrôle ligne par ligne : '+unresolved+' à vérifier, '+corrected+' corrigée(s)</strong></summary>'+issuesHtml+'</details>';
  html+='</div>';
 }
 $('chResults').innerHTML=html;
 $('chResults').querySelectorAll('.ch-fix').forEach(sel=>sel.addEventListener('change',()=>{
  let key=JSON.stringify([sel.dataset.id,Number(sel.dataset.step),Number(sel.dataset.k)]);
  corrections.set(key,sel.value===''?null:Number(sel.value));
  render();
 }));
}
function saveCSV(name,lines){let csv='\ufeff'+lines.map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(';')).join('\r\n');let a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('chClassCSV').onclick=()=>{if(!active)return;let c=active,lines=[['identifiant','nom','prénom','classe','pages','anomalie','doublon']];for(let k=0;k<2;k++)for(let cat of c.cats[k])lines[0].push('Indicateur '+(k+1)+' — '+cat+' (%)');for(let g of aggregate()){let p=pupils.find(p=>p.id===g.id),row=[g.id,p?.nom||g.identity?.nom||'',p?.prenom||g.identity?.prenom||'',p?.classe||g.identity?.classe||'',g.pages.size+'/'+c.pages,g.amb?'A_VERIFIER':'OK',g.duplicate?'OUI':'NON'];for(let k=0;k<2;k++){let st=stats(g,k);for(let count of st.counts)row.push(st.total?(100*count/st.total).toFixed(1):'')}lines.push(row)}saveCSV('omr_eps_synthese_classe.csv',lines)};
$('chCSV').onclick=()=>{if(!active)return;let c=active,lines=[['identifiant','nom','prénom','classe',c.field,'étape','indicateur 1','indicateur 2','statut indicateur 1','statut indicateur 2','vérification']];for(let g of aggregate()){let p=pupils.find(p=>p.id===g.id);for(let step=1;step<=c.steps;step++){let v=g.data.get(step)||[null,null];let issues=g.issues.get(step);let statuses=[0,1].map(k=>{let key=JSON.stringify([g.id,step,k]);return corrections.has(key)?'CORRIGE':issues?issues[k].status.toUpperCase():'PAGE_ABSENTE'});lines.push([g.id,p?.nom||g.identity?.nom||'',p?.prenom||g.identity?.prenom||'',p?.classe||g.identity?.classe||'',p?get(p.fields,c.field):'',step,...v.map((x,k)=>x===null?'':c.cats[k][x]),...statuses,g.duplicate||statuses.some(x=>!['OK','CORRIGE'].includes(x))?'A_VERIFIER':'OK'])}}let csv='\ufeff'+lines.map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(';')).join('\r\n');let a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='omr_eps_chronologique_resultats.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
})();
