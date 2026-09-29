
const matches=[
 {id:1,league:"LaLiga",time:"Hoy · 21:00",home:"Barcelona",away:"Atlético de Madrid",hi:"🔵🔴",ai:"🔴⚪",p:[54.2,25.1,20.7],confidence:"Alta",xg:[1.72,1.08]},
 {id:2,league:"Premier League",time:"Hoy · 16:30",home:"Man. City",away:"Arsenal",hi:"🔷",ai:"🔴",p:[56,24,20],confidence:"Alta",xg:[1.84,1.12]},
 {id:3,league:"LaLiga",time:"Hoy · 21:00",home:"Real Madrid",away:"Sevilla",hi:"⚪",ai:"🔴⚪",p:[62,20,18],confidence:"Alta",xg:[2.01,0.82]},
 {id:4,league:"Serie A",time:"Mañana · 20:45",home:"Inter",away:"Juventus",hi:"🔵⚫",ai:"⚫⚪",p:[48,27,25],confidence:"Media",xg:[1.43,1.04]}
];

let state={page:"home",selected:null,league:"Todas"};

function app(){
 const root=document.getElementById("app");
 root.innerHTML=`<div class="app">${state.page==="home"?home():state.page==="matches"?matchesPage():state.page==="analysis"?analysis():bets()}${nav()}</div>`;
}
function top(title="BetAI",sub="Analiza · Predice · Decide"){
 return `<header class="top"><div><div class="brand">⚽ ${title}</div><div class="sub">${sub}</div></div><button class="iconbtn" onclick="alert('Configuración: próximamente')">⚙</button></header>`;
}
function home(){
 return top()+`<section class="hero"><h1>Tu centro de análisis deportivo</h1><p>Probabilidades, estadísticas y simulaciones en un solo lugar. Esta primera versión utiliza datos de demostración.</p></section>
 <section class="section"><div class="sectionhead"><h2>Próximos partidos</h2><span class="link" onclick="go('matches')">Ver todos →</span></div>${matches.slice(0,3).map(matchCard).join("")}</section>`;
}
function matchCard(m){
 return `<div class="card" onclick="openMatch(${m.id})"><div style="display:flex;justify-content:space-between;align-items:center"><span class="sub">${m.league} · ${m.time}</span><span class="badge ${m.confidence==='Alta'?'high':'medium'}">${m.confidence}</span></div>
 <div class="match" style="margin-top:13px"><div class="team"><div class="logo">${m.hi}</div>${m.home}</div><div class="vs">VS</div><div class="team"><div class="logo">${m.ai}</div>${m.away}</div></div>
 <div class="probs">${["1","X","2"].map((x,i)=>`<div class="prob"><b>${m.p[i]}%</b><span>${x}</span></div>`).join("")}</div></div>`;
}
function matchesPage(){
 let arr=state.league==="Todas"?matches:matches.filter(m=>m.league===state.league);
 return top("Partidos","Calendario y probabilidades")+`<section class="section"><div class="filters">${["Todas","LaLiga","Premier League","Serie A"].map(x=>`<button class="pill ${state.league===x?'active':''}" onclick="filterLeague('${x}')">${x}</button>`).join("")}</div>${arr.map(matchCard).join("")}</section>`;
}
function analysis(){
 if(!state.selected)return `<section class="detailHeader"><button class="back" onclick="go('matches')">← Volver</button></section><div class="empty">Selecciona un partido para ver el análisis.</div>`;
 const m=state.selected;
 return `<section class="detailHeader"><button class="back" onclick="go('matches')">← Partidos</button><div class="card bigmatch"><div class="scoretitle">${m.league} · ${m.time}</div><div class="match" style="margin-top:16px"><div class="team"><div class="logo">${m.hi}</div>${m.home}</div><div class="vs">VS</div><div class="team"><div class="logo">${m.ai}</div>${m.away}</div></div>
 <div class="sectionhead"><h2>Probabilidades del modelo</h2><span class="badge high">${m.confidence}</span></div>${["1","X","2"].map((x,i)=>`<div class="metric"><strong>${x}</strong><div class="bar"><i style="width:${m.p[i]}%"></i></div><strong>${m.p[i]}%</strong></div>`).join("")}
 <div class="sectionhead"><h2>Goles esperados (xG)</h2></div><table class="table"><tr><td>${m.home}</td><td class="right">${m.xg[0]}</td></tr><tr><td>${m.away}</td><td class="right">${m.xg[1]}</td></tr></table>
 <div class="sectionhead"><h2>Marcadores simulados</h2></div><table class="table"><tr><td>1 - 0</td><td class="right">14.8%</td></tr><tr><td>2 - 0</td><td class="right">12.6%</td></tr><tr><td>1 - 1</td><td class="right">11.9%</td></tr><tr><td>2 - 1</td><td class="right">9.8%</td></tr></table>
 <p class="note">Las cifras son demostrativas. En la siguiente fase conectaremos datos reales y entrenaremos el modelo con histórico.</p>
 </div></section>`;
}
function bets(){
 return top("Mis apuestas","Registro personal")+`<section class="section"><div class="card"><div class="sectionhead"><h2>Resumen</h2></div><div class="probs"><div class="prob"><b class="positive">+0.0%</b><span>ROI</span></div><div class="prob"><b>0</b><span>Apuestas</span></div><div class="prob"><b>€0</b><span>Balance</span></div></div></div><div class="empty">Todavía no hay apuestas registradas.<br><span class="note">Podremos añadir seguimiento y paper betting en una próxima fase.</span></div></section>`;
}
function nav(){
 return `<nav class="nav">${[
 ["home","⌂","Inicio"],["matches","⚽","Partidos"],["bets","▣","Mis apuestas"],["analysis","⌁","Análisis"]
 ].map(([p,i,t])=>`<button class="${state.page===p?'active':''}" onclick="go('${p}')"><span class="ico">${i}</span>${t}</button>`).join("")}</nav>`;
}
function go(p){state.page=p;app();window.scrollTo(0,0)}
function openMatch(id){state.selected=matches.find(m=>m.id===id);state.page="analysis";app();window.scrollTo(0,0)}
function filterLeague(x){state.league=x;app()}
app();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))}
