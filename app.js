
var DB={}, scanKo=0, SK='kifa_v14';
var stream=null, scanActive=false, scanLoop=null, jsqrLoaded=false;
var ntimer=null;
var CYAN='#00FFCC',VIOLET='#7B00FF',ROSE='#FF006E',OR='#C9A84C',BLANC='#FFFFFF',NOIR='#080818';

function dbSave(){try{localStorage.setItem(SK,JSON.stringify(DB));}catch(e){}}
function dbLoad(){try{var d=localStorage.getItem(SK);if(d)DB=JSON.parse(d);}catch(e){DB={};}}

function notif(msg,type){
  var el=document.getElementById('notif');
  el.textContent=msg;
  el.className='notif '+(type==='ok'?'n-ok':'n-err');
  if(ntimer)clearTimeout(ntimer);
  ntimer=setTimeout(function(){el.className='notif';},3500);
}

function nav(p){
  var tabs=['dash','scan','list','gen','adm'],i;
  for(i=0;i<tabs.length;i++){
    document.getElementById('t-'+tabs[i]).className='nb'+(tabs[i]===p?' on':'');
    document.getElementById('pane-'+tabs[i]).className='pane'+(tabs[i]===p?' on':'');
  }
  if(p==='dash')drawDash();
  if(p==='scan')drawScanKpi();
  if(p==='list')drawList();
  if(p==='gen')fillSel();
  if(p!=='scan')stopCam();
}

function nextNum(){
  var keys=Object.keys(DB),nums=[],i,p,n;
  for(i=0;i<keys.length;i++){p=keys[i].split('-');n=parseInt(p[p.length-1]);if(n>0)nums.push(n);}
  return nums.length?Math.max.apply(null,nums)+1:1;
}

function drawDash(){
  var all=Object.values(DB),tot=all.length,ent=0,att,p1,p2,i,rec=[],h,t,html='';
  for(i=0;i<all.length;i++){if(all[i].scanned)ent++;}
  att=tot-ent;p1=tot?Math.round(ent/tot*100):0;p2=Math.min(100,Math.round(tot/180*100));
  document.getElementById('k-tot').textContent=tot;
  document.getElementById('k-ent').textContent=ent;
  document.getElementById('k-att').textContent=att;
  document.getElementById('k-fcfa').textContent=(tot*10000).toLocaleString('fr-FR');
  document.getElementById('p1t').textContent=p1+'%';document.getElementById('p1b').style.width=p1+'%';
  document.getElementById('p2t').textContent=p2+'%';document.getElementById('p2b').style.width=p2+'%';
  document.getElementById('f2').textContent=(tot*10000).toLocaleString('fr-FR')+' FCFA';
  document.getElementById('f3').textContent=ent;
  document.getElementById('f4').textContent=(att*10000).toLocaleString('fr-FR')+' FCFA';
  for(i=0;i<all.length;i++){if(all[i].scanned)rec.push(all[i]);}
  rec.sort(function(a,b){return new Date(b.scanned_at)-new Date(a.scanned_at);});
  rec=rec.slice(0,5);
  var el=document.getElementById('d-rec');
  if(!rec.length){el.innerHTML='<div class="empty"><span class="ei">🕐</span>Aucune entrée encore.</div>';return;}
  for(i=0;i<rec.length;i++){
    t=rec[i];h=new Date(t.scanned_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    html+='<div class="tr"><span class="bdg b-ok">Entré</span><div class="ti"><div class="tr-r">'+t.ref+'</div><div class="tr-n">'+t.nom+'</div></div><div class="tr-t">'+h+'</div></div>';
  }
  el.innerHTML=html;
}

function drawScanKpi(){
  var all=Object.values(DB),ent=0,att=0,i;
  for(i=0;i<all.length;i++){if(all[i].scanned)ent++;else att++;}
  document.getElementById('st').textContent=all.length;
  document.getElementById('se').textContent=ent;
  document.getElementById('sa').textContent=att;
  document.getElementById('sk').textContent=scanKo;
}

function valider(ref){
  if(!ref)return;
  ref=ref.trim().toUpperCase();
  if(ref.indexOf('KFP-')!==0)ref='KFP-2026-'+ref.replace(/[^0-9]/g,'').padStart(4,'0');
  var t=DB[ref],el=document.getElementById('sc-res'),h;
  el.style.display='block';
  if(!t){
    scanKo++;el.className='res r-wr';
    el.innerHTML='<span class="ri">⚠️</span><div class="rn">Ticket inconnu</div><div class="rm">'+ref+' introuvable.</div>';
  }else if(t.scanned){
    scanKo++;h=new Date(t.scanned_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    el.className='res r-ko';
    el.innerHTML='<span class="ri">🚫</span><div class="rn">'+t.nom+'</div><div class="rm">Déjà scanné à '+h+'</div>';
  }else{
    t.scanned=true;t.scanned_at=new Date().toISOString();DB[ref]=t;dbSave();
    el.className='res r-ok';
    el.innerHTML='<span class="ri">✅</span><div class="rn">'+t.nom+'</div><div class="rm">Accès autorisé — bonne soirée !</div>';
    document.getElementById('sc-in').value='';
  }
  drawScanKpi();
  setTimeout(function(){el.style.display='none';},7000);
}

function startCam(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    notif('Caméra non disponible.','err');return;
  }
  if(jsqrLoaded){doStartCam();return;}
  notif('Chargement scanner...','ok');
  var s=document.createElement('script');s.src='jsqr.js';
  s.onload=function(){jsqrLoaded=true;doStartCam();};
  s.onerror=function(){notif('Scanner non disponible.','err');};
  document.head.appendChild(s);
}

function doStartCam(){
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false})
  .then(function(s){
    stream=s;
    var v=document.getElementById('cam-video');v.srcObject=s;v.play();
    document.getElementById('btn-cam').style.display='none';
    document.getElementById('btn-stop').style.display='block';
    scanActive=true;scanQR();
  }).catch(function(){notif('Autorise la caméra dans Chrome.','err');});
}

function stopCam(){
  scanActive=false;
  if(scanLoop){cancelAnimationFrame(scanLoop);scanLoop=null;}
  if(stream){stream.getTracks().forEach(function(t){t.stop();});stream=null;}
  document.getElementById('cam-video').srcObject=null;
  document.getElementById('btn-cam').style.display='block';
  document.getElementById('btn-stop').style.display='none';
}

function scanQR(){
  if(!scanActive||!jsqrLoaded)return;
  var v=document.getElementById('cam-video');
  if(v.readyState===v.HAVE_ENOUGH_DATA){
    var c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;
    var ctx=c.getContext('2d');ctx.drawImage(v,0,0,c.width,c.height);
    try{
      var d=ctx.getImageData(0,0,c.width,c.height);
      var code=jsQR(d.data,d.width,d.height,{inversionAttempts:'dontInvert'});
      if(code&&code.data){
        var parts=code.data.split(' | ');
        valider(parts.length>1?parts[1]:code.data);
        stopCam();return;
      }
    }catch(e){}
  }
  scanLoop=requestAnimationFrame(scanQR);
}

function creerTicket(){
  var nom=document.getElementById('an').value.trim();
  if(!nom){notif('Entre le nom.','err');return;}
  var numRaw=document.getElementById('anum').value.trim();
  var num=numRaw?numRaw.padStart(4,'0'):String(nextNum()).padStart(4,'0');
  var ref='KFP-2026-'+num;
  if(DB[ref]){notif(ref+' existe déjà.','err');return;}
  DB[ref]={ref:ref,nom:nom,scanned:false,scanned_at:null,created_at:new Date().toISOString()};
  dbSave();
  document.getElementById('an').value='';document.getElementById('anum').value='';
  notif('Ticket '+ref+' créé pour '+nom+'.','ok');
  drawDash();fillSel();
}

function creerBatch(){
  var p=document.getElementById('bp').value.trim(),n=document.getElementById('bn').value.trim();
  var q=Math.min(parseInt(document.getElementById('bq').value)||1,50);
  if(!p||!n){notif('Entre prénom et nom.','err');return;}
  var next=nextNum(),i,num,ref,nom;
  for(i=0;i<q;i++){
    num=String(next++).padStart(4,'0');ref='KFP-2026-'+num;
    nom=q===1?p+' '+n:p+' '+n+' '+(i+1);
    DB[ref]={ref:ref,nom:nom,scanned:false,scanned_at:null,created_at:new Date().toISOString()};
  }
  dbSave();
  document.getElementById('bp').value='';document.getElementById('bn').value='';document.getElementById('bq').value='1';
  notif(q+' ticket(s) créé(s).','ok');drawDash();fillSel();
}

function reinit(){
  var ref=document.getElementById('rref').value.trim().toUpperCase();
  if(!ref)return;
  if(!DB[ref]){notif(ref+' introuvable.','err');return;}
  DB[ref].scanned=false;DB[ref].scanned_at=null;dbSave();
  notif(ref+' réinitialisé.','ok');
}

function vider(){
  if(!confirm('Supprimer TOUS les tickets ?'))return;
  DB={};dbSave();drawDash();drawList();fillSel();notif('Base vidée.','ok');
}

function drawList(){
  var q=document.getElementById('lq').value.toLowerCase();
  var f=document.getElementById('lf').value;
  var all=Object.values(DB),i,t,filtered=[],html='',h,rb;
  for(i=0;i<all.length;i++){
    t=all[i];
    if(q&&t.nom.toLowerCase().indexOf(q)<0&&t.ref.toLowerCase().indexOf(q)<0)continue;
    if(f==='att'&&t.scanned)continue;
    if(f==='ent'&&!t.scanned)continue;
    filtered.push(t);
  }
  filtered.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
  var el=document.getElementById('l-body');
  if(!filtered.length){el.innerHTML='<div class="empty"><span class="ei">🔍</span>Aucun résultat.</div>';return;}
  for(i=0;i<filtered.length;i++){
    t=filtered[i];
    h=t.scanned_at?new Date(t.scanned_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
    rb=t.scanned?'<button onclick="reinitRow(\''+t.ref+'\')">↺</button>':'';
    html+='<div class="tr"><span class="bdg '+(t.scanned?'b-ko':'b-ok')+'">'+(t.scanned?'Entré':'Attente')+'</span>'+
      '<div class="ti"><div class="tr-r">'+t.ref+'</div><div class="tr-n">'+t.nom+'</div></div>'+
      '<div class="tr-t">'+h+'</div>'+
      '<div class="tbs"><button class="gb" onclick="genFromList(\''+t.ref+'\')">🖼</button>'+rb+
      '<button onclick="delRow(\''+t.ref+'\')">🗑</button></div></div>';
  }
  el.innerHTML=html;
}

function reinitRow(ref){if(!DB[ref])return;DB[ref].scanned=false;DB[ref].scanned_at=null;dbSave();drawList();notif(ref+' réinitialisé.','ok');}
function delRow(ref){if(!confirm('Supprimer '+ref+' ?'))return;delete DB[ref];dbSave();drawList();fillSel();notif(ref+' supprimé.','ok');}

function exportCSV(){
  var all=Object.values(DB),i,t,h,lines=['Référence,Nom,Statut,Heure scan'];
  if(!all.length){notif('Aucun ticket.','err');return;}
  for(i=0;i<all.length;i++){
    t=all[i];h=t.scanned_at?new Date(t.scanned_at).toLocaleString('fr-FR'):'';
    lines.push(t.ref+',"'+t.nom+'",'+(t.scanned?'Entré':'En attente')+',"'+h+'"');
  }
  var ta=document.getElementById('csv-out');ta.value=lines.join('\n');ta.select();
  notif('CSV prêt — copie et colle.','ok');
}

function fillSel(){
  var sel=document.getElementById('gen-sel'),cur=sel.value,all=Object.values(DB),i,t,o;
  sel.innerHTML='<option value="">— Sélectionner —</option>';
  all.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
  for(i=0;i<all.length;i++){
    t=all[i];o=document.createElement('option');
    o.value=t.ref;o.textContent=t.ref+' — '+t.nom;
    if(t.ref===cur)o.selected=true;sel.appendChild(o);
  }
}

function onSel(){
  var ref=document.getElementById('gen-sel').value,t,parts;
  if(!ref||!DB[ref])return;
  t=DB[ref];parts=t.ref.split('-');
  document.getElementById('gen-nom').value=t.nom;
  document.getElementById('gen-num').value=parts[parts.length-1];
}

function genFromList(ref){if(!DB[ref])return;nav('gen');document.getElementById('gen-sel').value=ref;onSel();doGen();}

function doGen(){
  var nom=document.getElementById('gen-nom').value.trim()||'Participant';
  var numRaw=document.getElementById('gen-num').value.trim()||'0001';
  var ref='KFP-2026-'+numRaw.padStart(4,'0');
  var qrData='KIFA FLUO PARTY | '+ref+' | '+nom+' | 8 JUILLET 2026 | KIFA ROOFTOP BINGERVILLE';
  var div=document.getElementById('qr-tmp');div.innerHTML='';
  new QRCode(div,{text:qrData,width:180,height:180,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
  var tries=0;
  function tryRender(){
    var qc=div.querySelector('canvas');
    if(qc&&qc.width>0){renderTicket(nom,ref,qc);document.getElementById('gen-res').style.display='block';return;}
    var qi=div.querySelector('img');
    if(qi&&qi.complete&&qi.naturalWidth>0){renderTicket(nom,ref,qi);document.getElementById('gen-res').style.display='block';return;}
    if(qi&&!qi.complete){qi.onload=function(){renderTicket(nom,ref,qi);document.getElementById('gen-res').style.display='block';};return;}
    tries++;
    if(tries<30)setTimeout(tryRender,100);
    else{renderTicket(nom,ref,null);document.getElementById('gen-res').style.display='block';}
  }
  setTimeout(tryRender,300);
}

function dlTicket(){
  var c=document.getElementById('tc');
  if(!c||c.width===0){notif('Génère un ticket dabord.','err');return;}
  var nom=(document.getElementById('gen-nom').value||'ticket').trim().replace(/\s+/g,'_');
  var num=(document.getElementById('gen-num').value||'0000').trim();
  try{
    var a=document.createElement('a');
    a.download='Ticket_KIFA_'+nom+'_'+num+'.png';
    a.href=c.toDataURL('image/png');
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    notif('Ticket téléchargé !','ok');
  }catch(e){
    var w=window.open('','_blank');
    if(w){w.document.write('<img src="'+c.toDataURL('image/png')+'" style="max-width:100%">');w.document.close();}
  }
}

function rr(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function ha(hex,a){var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return 'rgba('+r+','+g+','+b+','+a+')';}

function renderTicket(nom,ref,qrImg){
  var c=document.getElementById('tc'),W=600,H=920;
  c.width=W;c.height=H;
  var ctx=c.getContext('2d');
  ctx.fillStyle='#0A0A0A';rr(ctx,0,0,W,H,20);ctx.fill();
  ctx.fillStyle=NOIR;
  ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(W-20,0);ctx.quadraticCurveTo(W,0,W,20);ctx.lineTo(W,460);ctx.lineTo(0,460);ctx.lineTo(0,20);ctx.quadraticCurveTo(0,0,20,0);ctx.closePath();ctx.fill();
  [{x:150,y:140,r:180,c:'#7B00FF',a:.10},{x:500,y:200,r:140,c:'#00FFCC',a:.08},{x:300,y:370,r:120,c:'#FF006E',a:.09},{x:90,y:380,r:80,c:'#00CFFF',a:.07},{x:560,y:420,r:100,c:'#FFD700',a:.06}].forEach(function(g){
    var gr=ctx.createRadialGradient(g.x,g.y,0,g.x,g.y,g.r);gr.addColorStop(0,ha(g.c,g.a*2));gr.addColorStop(1,ha(g.c,0));
    ctx.fillStyle=gr;ctx.beginPath();ctx.arc(g.x,g.y,g.r,0,Math.PI*2);ctx.fill();
  });
  ctx.strokeStyle=OR;ctx.lineWidth=1.2;rr(ctx,230,55,140,26,13);ctx.stroke();
  ctx.fillStyle=OR;ctx.font='700 10px Arial';ctx.textAlign='center';ctx.letterSpacing='3px';ctx.fillText('KIFA ROOFTOP',300,73);ctx.letterSpacing='0px';
  ctx.fillStyle=BLANC;ctx.font='900 54px Arial';ctx.fillText('FLUO',300,148);
  ctx.fillStyle=CYAN;ctx.font='900 54px Arial';ctx.fillText('PARTY',300,204);
  [[140,ROSE],[270,CYAN],[400,VIOLET]].forEach(function(x){ctx.fillStyle=x[1];ctx.fillRect(x[0],218,100,3);});
  ctx.fillStyle=BLANC;ctx.font='800 30px Arial';ctx.fillText('MERCREDI 8 JUILLET 2026',300,268);
  ctx.fillStyle='#AAAAAA';ctx.font='400 14px Arial';ctx.letterSpacing='1px';ctx.fillText('DÈS 17H — JUSQU\'À 01H',300,295);ctx.letterSpacing='0px';
  ctx.fillStyle=ha(CYAN,0.08);rr(ctx,60,355,480,46,10);ctx.fill();
  ctx.strokeStyle=CYAN;ctx.lineWidth=1;rr(ctx,60,355,480,46,10);ctx.stroke();
  ctx.fillStyle=CYAN;ctx.font='700 18px Arial';ctx.fillText('Ticket de '+nom,300,385);
  ctx.fillStyle='#111111';ctx.fillRect(0,420,W,46);
  ctx.fillStyle='#0A0A0A';ctx.beginPath();ctx.arc(0,443,20,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(W,443,20,0,Math.PI*2);ctx.fill();
  ctx.setLineDash([8,6]);ctx.strokeStyle='#333';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(30,443);ctx.lineTo(570,443);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#1A1A1A';rr(ctx,260,431,80,24,12);ctx.fill();ctx.strokeStyle='#333';ctx.lineWidth=.8;rr(ctx,260,431,80,24,12);ctx.stroke();
  ctx.fillStyle='#666';ctx.font='700 9px Arial';ctx.letterSpacing='2px';ctx.fillText('TICKET',300,447);ctx.letterSpacing='0px';
  ctx.fillStyle='#0D0D0D';ctx.fillRect(0,466,W,H-466);
  ctx.textAlign='left';ctx.fillStyle='#555';ctx.font='400 10px Arial';ctx.letterSpacing='2px';ctx.fillText('N° TICKET',80,510);ctx.letterSpacing='0px';
  ctx.fillStyle=BLANC;ctx.font='800 17px Arial';ctx.letterSpacing='2px';ctx.fillText('#'+ref,80,532);ctx.letterSpacing='0px';
  ctx.fillStyle=ha(VIOLET,0.15);rr(ctx,400,498,170,55,10);ctx.fill();ctx.strokeStyle=VIOLET;ctx.lineWidth=1;rr(ctx,400,498,170,55,10);ctx.stroke();
  ctx.textAlign='center';ctx.fillStyle='#BB88FF';ctx.font='400 9px Arial';ctx.letterSpacing='2px';ctx.fillText('TARIF ENTRÉE',485,517);ctx.letterSpacing='0px';
  ctx.fillStyle=BLANC;ctx.font='900 19px Arial';ctx.fillText('10 000 FCFA',485,542);
  ctx.strokeStyle='#222';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(60,565);ctx.lineTo(540,565);ctx.stroke();
  ctx.textAlign='left';ctx.fillStyle='#555';ctx.font='400 9px Arial';ctx.letterSpacing='2px';ctx.fillText('DÉTAILS',80,588);ctx.letterSpacing='0px';
  [['DATE','Mercredi 8 Juillet 2026'],['HEURE','17h00 — 01h00'],['LIEU','KIFA Rooftop, Bingerville'],['ADRESSE','Lagune Ébrié, Abidjan CI'],['PARTICIPANT',nom]].forEach(function(row,i){
    var y=610+i*26;ctx.fillStyle='#777';ctx.font='400 11px Arial';ctx.fillText(row[0],80,y);
    ctx.fillStyle=(row[0]==='PARTICIPANT')?CYAN:BLANC;ctx.font='700 11px Arial';ctx.fillText(row[1],200,y);
  });
  ctx.strokeStyle='#222';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(60,750);ctx.lineTo(540,750);ctx.stroke();
  ctx.textAlign='center';ctx.fillStyle='#444';ctx.font='400 9px Arial';ctx.letterSpacing='2px';ctx.fillText("QR CODE D'ACCÈS",300,770);ctx.letterSpacing='0px';
  var qs=110,qx=(W-qs)/2,qy=780;
  ctx.fillStyle='#FFF';rr(ctx,qx-8,qy-8,qs+16,qs+16,8);ctx.fill();
  ctx.strokeStyle=CYAN;ctx.lineWidth=2;rr(ctx,qx-8,qy-8,qs+16,qs+16,8);ctx.stroke();
  if(qrImg){try{ctx.drawImage(qrImg,qx,qy,qs,qs);}catch(e){}}
  ctx.fillStyle=OR;ctx.globalAlpha=.5;ctx.fillRect(0,H-6,W,3);ctx.globalAlpha=1;
  ctx.fillStyle='#333';ctx.font='400 8px Arial';ctx.letterSpacing='.5px';ctx.fillText('KIFA ROOFTOP — BINGERVILLE — LAGUNE ÉBRIÉ — ABIDJAN',300,H-10);
}

function clock(){
  var now=new Date(),h=now.getHours(),m=now.getMinutes(),s=now.getSeconds();
  document.getElementById('clk').textContent=(h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}

dbLoad();drawDash();fillSel();
setInterval(clock,1000);clock();
