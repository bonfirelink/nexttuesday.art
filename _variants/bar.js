(function(){
var V=[["I","Threshold","threshold"],["II","Night","night"],["III","Salon","salon"],["IV","Portal","portal"],["V","Grimoire","grimoire"]],
p=location.pathname,m=p.split("/")[1],c=V.findIndex(function(v){return v[2]===m}),
rest=c<0?"/":p.slice(m.length+1)||"/",
h=document.createElement("div"),s=h.attachShadow({mode:"open"});
function href(v){return"/"+v[2]+rest+location.search+location.hash}
s.innerHTML='<style>'+
':host{all:initial}'+
'nav{position:fixed;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:2px;height:40px;padding:0 6px;box-sizing:border-box;max-width:calc(100vw - 16px);background:rgba(14,10,12,.72);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.18);border-radius:20px;font:12px/1 system-ui,-apple-system,sans-serif;letter-spacing:.08em;color:#eee;transition:transform .3s,opacity .3s}'+
'nav.h{transform:translate(-50%,calc(100% + 24px));opacity:0}'+
'a,button{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 7px;border-radius:16px;color:inherit;cursor:pointer;white-space:nowrap}'+
'a:hover,button:hover{background:rgba(255,255,255,.12)}'+
'a:focus-visible,button:focus-visible{outline:2px solid #fff;outline-offset:-2px}'+
'a[aria-current]{color:#e51d47;text-decoration:underline;text-underline-offset:4px;font-weight:600}'+
'.n{display:none;margin-left:4px}.o .n{display:inline}.o .r{display:none}'+
'.x{opacity:.6}'+
'@media(prefers-reduced-motion:reduce){nav{transition:none}}'+
'</style><nav aria-label="Design variants"></nav>';
var n=s.querySelector("nav");
var b=document.createElement("button");b.textContent="\u2234";b.setAttribute("aria-label","Design variants");b.setAttribute("aria-expanded","false");n.appendChild(b);
V.forEach(function(v,i){var a=document.createElement("a");a.href=href(v);
a.innerHTML=v[0]+'<span class="n">'+v[1]+'</span>';a.title=v[1];
if(i===c)a.setAttribute("aria-current","page");n.appendChild(a)});
var k=document.createElement("a");k.href="/";k.className="x";k.textContent="\u2302";k.title="All doors";k.setAttribute("aria-label","Back to the doors");n.appendChild(k);
function open(o){n.classList.toggle("o",o);b.setAttribute("aria-expanded",o)}
b.onclick=function(){open(!n.classList.contains("o"))};
addEventListener("pointerdown",function(e){if(e.composedPath().indexOf(h)<0)open(false)});
var y=scrollY;
addEventListener("scroll",function(){var d=scrollY-y;y=scrollY;
var end=innerHeight+scrollY>=document.documentElement.scrollHeight-8;
if(end||d<-4||scrollY<10)n.classList.remove("h");
else if(d>4&&!n.classList.contains("o")&&!s.activeElement)n.classList.add("h")},{passive:true});
addEventListener("keydown",function(e){
if(e.key==="Escape")return open(false);
var t=e.target,tg=t&&t.tagName;
if(e.metaKey||e.ctrlKey||e.altKey||(t&&(t.isContentEditable||tg==="INPUT"||tg==="TEXTAREA"||tg==="SELECT")))return;
var d=e.key==="]"?1:e.key==="["?-1:0;
if(d)location.href=href(V[((c<0?(d>0?-1:0):c)+d+5)%5])});
document.body.appendChild(h);
})();
