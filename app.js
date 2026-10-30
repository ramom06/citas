import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getFirestore,collection,doc,onSnapshot,query,where,writeBatch,setDoc} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const FIREBASE={
    apiKey:"AIzaSyCYuUoNwb40sz1SdrAFUs8_1UOiv7qFWWM",
    authDomain:"citas-d8273.firebaseapp.com",
    projectId:"citas-d8273",
    appId:"1:694909879847:web:8fedd1ed7006492a0b3002"
};

const ADMIN_EMAIL="rmartinespana@gmail.com";
const D0={c:false,o:"09:30",x:"20:00"};

let CFG={salon:"Peluquería",wa:"744644953",step:30,days:14,sched:[{c:true,o:"09:30",x:"20:00"},{...D0},{...D0},{...D0},{...D0},{...D0},{...D0}]};
let SERVICES=[{n:"Corte",time:30},{n:"Lavado y peinado",time:45},{n:"Corte y peinado",time:60},{n:"Tinte",time:90},{n:"Mechas",time:150},{n:"Mechas y corte",time:180},{n:"Recogido",time:60}];

const $=document.getElementById("app");
if(FIREBASE.apiKey==="AIzaSyCYuUoNwb40sz1SdrAFUs8_1UOiv7qFWWM"){
    $.innerHTML='<div class="card"><b>Falta configurar Firebase.</b><p>Sigue los pasos del README y pega tu configuración en <code>index.html</code>.</p></div>';throw new Error("sin config")}
const app=initializeApp(FIREBASE),db=getFirestore(app),auth=getAuth(app);
const S={tab:"cliente",step:1,name:"",phone:"",svc:0,date:null,time:null,note:"",cells:new Set(),books:[],owner:false,done:null,busy:false,msg:"",em:"",pw:"",err:"",draft:null};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tm=h=>{const[a,b]=h.split(":");return+a*60+ +b};
const hm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const key=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const DN=["dom","lun","mar","mié","jue","vie","sáb"],DF=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const dayOf=k=>{const[y,m,d]=k.split("-").map(Number);return CFG.sched[new Date(y,m-1,d).getDay()]};
const lbl=k=>{const[y,m,d]=k.split("-").map(Number);return DN[new Date(y,m-1,d).getDay()]+" "+d+"/"+m};
const dates=()=>{const r=[],t=new Date();for(let i=0;r.length<CFG.days&&i<90;i++){const d=new Date(t.getFullYear(),t.getMonth(),t.getDate()+i);if(!CFG.sched[d.getDay()].c)r.push(d)}return r};
const cellsOf=(start,end)=>{const r=[];for(let i=Math.floor(start/15);i<Math.ceil(end/15);i++)r.push(i);return r};
function free(k,start,dur){
 const sd=dayOf(k);if(sd.c||start<tm(sd.o)||start+dur>tm(sd.x))return false;
 if(k===key(new Date())){const n=new Date();if(start<=n.getHours()*60+n.getMinutes())return false}
 return !cellsOf(start,start+dur).some(i=>S.cells.has(k+"_"+i));
}

function times(k){
    const dur=SERVICES[S.svc].time,r=[],sd=dayOf(k);
    if(sd.c)return r;
    for(let m=tm(sd.o);
    m<tm(sd.x);m+=CFG.step)
    if(free(k,m,dur))r.push(m); 
    return r}

function view(){
 if(!S.owner&&(S.tab==="agenda"||S.tab==="ajustes"))S.tab="cliente";
 const tabs=S.owner?`<div class="tabs">${[["cliente","Reservar"],["agenda","Agenda"],["ajustes","Ajustes"]].map(([v,t])=>`<button class="${S.tab===v?"on":""}" data-a="tab" data-v="${v}">${t}</button>`).join("")}</div>`:"";
 const sub={agenda:"Tus próximas citas",ajustes:"Configura horario y servicios",login:"Acceso administradora"}[S.tab]||"Reserva tu cita en un minuto";
 const body=S.tab==="agenda"?agenda():S.tab==="ajustes"?ajustes():S.tab==="login"?login():client();
 $.innerHTML=`<h1>${esc(CFG.salon)}</h1><p class="sub">${sub}</p>${tabs}${body}<p class="mut" style="text-align:center;margin-top:24px"><a href="#" data-a="auth" style="color:var(--mut)">${S.owner?"Cerrar sesión de administradora":"Acceso administradora"}</a></p>`;
}

function login(){
    return `<div class="card"><label>Email</label><input id="em" type="email" autocomplete="username" value="${esc(S.em)}"><label>Contraseña</label><input id="pw" type="password" autocomplete="current-password"><p class="err">${esc(S.err)}</p><button class="p" data-a="dologin">Entrar</button></div>`}

function client(){
 if(S.done){const d=S.done,m=encodeURIComponent(`Hola, soy ${d.name}. He reservado ${d.svc} el ${lbl(d.date)} a las ${hm(d.start)}.`);
  return `<div class="card"><p class="ok">¡Cita reservada!</p><p><b>${esc(d.svc)}</b><br>${lbl(d.date)} a las ${hm(d.start)} (${d.dur} min)</p>
  <p class="mut">Tu hueco ya está en la agenda. Si quieres, avisa también por WhatsApp.</p>
  <a class="wa" href="https://wa.me/${CFG.wa}?text=${m}" target="_blank" rel="noopener">Avisar por WhatsApp (opcional)</a>
  <button class="p" data-a="again">Reservar otra cita</button></div>`}
 if(S.step===1){const ok=S.name.trim().length>1&&S.phone.replace(/\D/g,"").length>=9;
  return `<div class="card"><label>Nombre</label><input id="name" value="${esc(S.name)}" autocomplete="name">
  <label>Teléfono</label><input id="phone" type="tel" value="${esc(S.phone)}" autocomplete="tel">
  <label>Servicio</label><select id="svc">${SERVICES.map((s,i)=>`<option value="${i}" ${i===S.svc?"selected":""}>${esc(s.n)} · ${s.time>=60?Math.floor(s.time/60)+" h"+(s.time%60?" "+s.time%60+" min":""):s.time+" min"}</option>`).join("")}</select>
  <button class="p" id="next1" data-a="next" ${ok?"":"disabled"}>Ver días y horas</button></div>`}
 const ds=dates();if(!S.date||!ds.some(d=>key(d)===S.date))S.date=key(ds[0]);const ts=times(S.date);
 return `<div class="card"><div class="mut">${esc(S.name)} · ${esc(SERVICES[S.svc].n)} (${SERVICES[S.svc].time} min)</div>
 <h2>Elige día</h2><div class="days">${ds.map(d=>{const k=key(d);return `<button class="d ${k===S.date?"on":""}" data-a="date" data-v="${k}">${DN[d.getDay()]}<b>${d.getDate()}</b></button>`}).join("")}</div>
 <h2>Elige hora</h2>${ts.length?`<div class="times">${ts.map(m=>`<button class="t ${m===S.time?"on":""}" data-a="time" data-v="${m}">${hm(m)}</button>`).join("")}</div>`:`<p class="mut">No quedan huecos este día para este servicio. Prueba otro día.</p>`}
 <label>Nota (opcional)</label><textarea id="note" rows="2" maxlength="300" placeholder="Ej: quiero un tono más claro">${esc(S.note)}</textarea>
 <p class="err">${esc(S.msg)}</p>
 <button class="p" data-a="book" ${S.time==null||S.busy?"disabled":""}>${S.busy?"Guardando…":"Confirmar cita"}</button>
 <button style="width:100%;margin-top:8px" data-a="back">← Cambiar mis datos</button></div>`;
}

function agenda(){
 const b=[...S.books].sort((a,c)=>a.date.localeCompare(c.date)||a.start-c.start);
 if(!b.length)return `<div class="card mut">No hay citas reservadas por ahora.</div>`;
 let h="",last="";
 for(const x of b){if(x.date!==last){h+=`<h2>${lbl(x.date)}</h2>`;last=x.date}
  h+=`<div class="card"><div class="row"><div><b>${hm(x.start)}–${hm(x.end)}</b> · ${esc(x.svc)}<br>${esc(x.name)} · <a href="tel:${esc(x.phone)}" style="color:var(--ac)">${esc(x.phone)}</a>${x.note?`<br><span class="mut">“${esc(x.note)}”</span>`:""}</div><button class="x" data-a="del" data-v="${x.id}">Borrar</button></div></div>`}
 return h;
}

function ajustes(){
 const d=S.draft;if(!d)return "";
 return `<div class="card"><b>Datos generales</b>
 <label>Nombre del negocio</label><input data-f="salon" value="${esc(d.cfg.salon)}">
 <label>WhatsApp (con prefijo, sin +)</label><input data-f="wa" inputmode="numeric" value="${esc(d.cfg.wa)}">
 <label>Días por delante que se pueden reservar</label><input data-f="days" type="number" min="1" max="60" value="${d.cfg.days}">
 <label>Intervalo entre horas (minutos)</label><select data-f="step">${[15,30,60].map(n=>`<option ${n===d.cfg.step?"selected":""}>${n}</option>`).join("")}</select></div>
 <div class="card"><b>Horario</b>${d.cfg.sched.map((s,i)=>`<div class="row" style="align-items:center;margin-top:10px;gap:8px"><label style="margin:0;min-width:110px;font-weight:500"><input type="checkbox" style="width:auto" data-f="so_c" data-i="${i}" ${s.c?"":"checked"}> ${DF[i]}</label><input type="time" data-f="so" data-i="${i}" value="${s.o}"><input type="time" data-f="sx" data-i="${i}" value="${s.x}"></div>`).join("")}<p class="mut">Marca los días que abres y pon la hora de apertura y de cierre.</p></div>
 <div class="card"><b>Servicios y duración</b>${d.services.map((s,i)=>`<div class="row" style="align-items:center;margin-top:10px;gap:8px"><input data-f="vn" data-i="${i}" value="${esc(s.n)}"><input data-f="vm" data-i="${i}" type="number" min="5" step="5" value="${s.m}" style="width:84px"><span class="mut">min</span><button class="x" data-a="svcdel" data-v="${i}">✕</button></div>`).join("")}<button style="width:100%;margin-top:12px" data-a="svcadd">+ Añadir servicio</button></div>
 <button class="p" data-a="save">Guardar cambios</button>`;
}

async function book(){
 const sv=SERVICES[S.svc],start=S.time,k=S.date;
 const ids=cellsOf(start,start+sv.time).map(i=>k+"_"+i);
 const rec={name:S.name.trim(),phone:S.phone.trim(),svc:sv.n,dur:sv.time,date:k,start,end:start+sv.time,note:S.note.trim(),cells:ids,created:Date.now()};
 S.busy=true;S.msg="";view();
 try{const b=writeBatch(db);ids.forEach((id,j)=>b.set(doc(db,"cells",id),{date:k,i:cellsOf(start,start+sv.time)[j]}));
  b.set(doc(collection(db,"bookings")),rec);await b.commit();S.done=rec;
 }catch(e){S.msg=(e.code==="permission-denied")?"Ese hueco acaba de ser reservado por otra persona. Elige otra hora.":"No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";S.time=null}
 S.busy=false;view();
}

async function save(){
 const d=S.draft;
 if(!d.services.length||d.services.some(s=>!s.n.trim())){alert("Cada servicio necesita un nombre.");return}
 if(d.cfg.sched.some(s=>!s.c&&tm(s.o)>=tm(s.x))){alert("Revisa el horario: la apertura debe ser antes del cierre.");return}
 try{await setDoc(doc(db,"config","main"),{cfg:d.cfg,services:d.services});alert("Guardado. Los clientes ya ven los cambios.")}catch(e){alert("No se pudo guardar.")}
}

async function del(id){
 const x=S.books.find(b=>b.id===id);if(!x||!confirm("¿Borrar esta cita?"))return;
 try{const b=writeBatch(db);(x.cells||[]).forEach(c=>b.delete(doc(db,"cells",c)));b.delete(doc(db,"bookings",id));await b.commit()}catch(e){alert("No se pudo borrar.")}
}

$.addEventListener("input",e=>{const t=e.target,f=t.dataset.f;
 if(f&&S.draft){const k=+t.dataset.i,c=S.draft.cfg;
  if(f==="salon")c.salon=t.value;else if(f==="wa")c.wa=t.value.replace(/\D/g,"");else if(f==="days")c.days=Math.max(1,Math.min(60,+t.value||14));else if(f==="step")c.step=+t.value;
  else if(f==="so_c")c.sched[k].c=!t.checked;else if(f==="so")c.sched[k].o=t.value;else if(f==="sx")c.sched[k].x=t.value;
  else if(f==="vn")S.draft.services[k].n=t.value;else if(f==="vm")S.draft.services[k].m=Math.max(5,+t.value||30);return}
 const i=t.id;

 if(i==="name")S.name=t.value;else if(i==="phone")S.phone=t.value;else if(i==="note")S.note=t.value;else if(i==="em")S.em=t.value;else if(i==="pw")S.pw=t.value;else if(i==="svc"){S.svc=+t.value;S.time=null}
 const b=document.getElementById("next1");if(b)b.disabled=!(S.name.trim().length>1&&S.phone.replace(/\D/g,"").length>=9)});
$.addEventListener("click",async e=>{const b=e.target.closest("[data-a]");if(!b)return;const a=b.dataset.a,v=b.dataset.v;
 if(a==="auth"){e.preventDefault();if(S.owner){await signOut(auth);S.tab="cliente"}else{S.tab="login";S.err=""}}
 else if(a==="dologin"){try{await signInWithEmailAndPassword(auth,S.em.trim(),S.pw);S.pw=""}catch(x){S.err="Email o contraseña incorrectos.";view()}return}
 else if(a==="tab"){S.tab=v;if(v==="ajustes")S.draft=JSON.parse(JSON.stringify({cfg:CFG,services:SERVICES}))}
 else if(a==="svcadd"){S.draft.services.push({n:"Nuevo servicio",m:30})}
 else if(a==="svcdel"){S.draft.services.splice(+v,1)}
 else if(a==="save"){return save()}
 else if(a==="next"){S.step=2;S.date=null;S.time=null;S.msg=""}
 else if(a==="back"){S.step=1}
 else if(a==="date"){S.date=v;S.time=null}
 else if(a==="time"){S.time=+v}
 else if(a==="book"){return book()}
 else if(a==="again"){S.done=null;S.step=1;S.date=null;S.time=null;S.note="";S.msg=""}
 else if(a==="del"){return del(v)}
 view();
});

let unBooks=null;
onAuthStateChanged(auth,u=>{
 S.owner=!!(u&&u.email&&u.email.toLowerCase()===ADMIN_EMAIL.toLowerCase());
 if(unBooks){unBooks();unBooks=null}S.books=[];
 if(S.owner){S.tab=S.tab==="login"?"agenda":S.tab;
  unBooks=onSnapshot(query(collection(db,"bookings"),where("date",">=",key(new Date()))),s=>{S.books=s.docs.map(d=>({id:d.id,...d.data()}));if(S.tab==="agenda")view()},()=>{})}
 view();
});

onSnapshot(doc(db,"config","main"),s=>{if(s.exists()){const d=s.data();if(d.cfg)CFG={...CFG,...d.cfg};if(d.services&&d.services.length)SERVICES=d.services;if(S.svc>=SERVICES.length)S.svc=0;if(S.tab!=="ajustes"&&!S.busy&&!S.done)view()}},()=>{});
onSnapshot(query(collection(db,"cells"),where("date",">=",key(new Date()))),s=>{S.cells=new Set(s.docs.map(d=>d.id));if(!S.busy&&!S.done&&S.tab==="cliente"&&S.step===2&&document.activeElement.id!=="note")view()},()=>{});
view();