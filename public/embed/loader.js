/* SpatialAble Embed Loader v0.1.0 | (c) 2026 SpatialAble */
(()=>{var O=e=>{throw TypeError(e)};var R=(e,t,r)=>t.has(e)||O("Cannot "+r);var o=(e,t,r)=>(R(e,t,"read from private field"),r?r.call(e):t.get(e)),p=(e,t,r)=>t.has(e)?O("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),d=(e,t,r,s)=>(R(e,t,"write to private field"),s?s.call(e,r):t.set(e,r),r),c=(e,t,r)=>(R(e,t,"access private method"),r);var J="__SA_API_BASE__",k=J;function y(e){k=e.replace(/\/$/,"")}async function U(e){let t=await fetch(`${k}/api/embed/init`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:e})});if(!t.ok){let r=await t.json().catch(()=>({}));return{valid:!1,tier:"",style_profile:null,config:{allowed_types:[],impression_remaining:null},error:r.error||`HTTP ${t.status}`}}return t.json()}async function D(e){let t=new URLSearchParams;t.set("token",e.token),e.asset&&t.set("asset",e.asset),e.productId&&t.set("product-id",e.productId),e.productType&&t.set("product-type",e.productType);let r=await fetch(`${k}/api/embed/resolve?${t}`);if(!r.ok){let s=await r.json().catch(()=>({}));return{type:e.productType||"hero",assets:[],resolved:!1,expires_in:0,error:s.error||`HTTP ${r.status}`}}return r.json()}async function q(e,t){let r=JSON.stringify({token:e,events:t}),s=`${k}/api/embed/impression`;typeof navigator<"u"&&navigator.sendBeacon?navigator.sendBeacon(s,new Blob([r],{type:"application/json"})):fetch(s,{method:"POST",headers:{"Content-Type":"application/json"},body:r,keepalive:!0}).catch(()=>{})}function z(e){if(!e)return"";let t=[];if(e.primary_color&&t.push(`--sa-primary: ${e.primary_color}`),e.secondary_color&&t.push(`--sa-secondary: ${e.secondary_color}`),e.accent_color&&t.push(`--sa-accent: ${e.accent_color}`),e.font_family&&t.push(`--sa-font: ${e.font_family}`),e.border_radius&&t.push(`--sa-radius: ${e.border_radius}`),e.background_color&&t.push(`--sa-bg: ${e.background_color}`),e.text_color&&t.push(`--sa-text: ${e.text_color}`),e.custom_vars)for(let[r,s]of Object.entries(e.custom_vars))t.push(`--sa-${r}: ${s}`);return t.length>0?t.join(`;
    `)+";":""}var P=`
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    font-family: var(--sa-font, system-ui, -apple-system, sans-serif);
    color: var(--sa-text, #1a1a1a);
    background: var(--sa-bg, transparent);
    border-radius: var(--sa-radius, 0);
    line-height: 1.5;
    box-sizing: border-box;
  }

  :host([hidden]) {
    display: none;
  }

  * {
    box-sizing: border-box;
  }

  .sa-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  /* Loading skeleton */
  .sa-loading {
    width: 100%;
    aspect-ratio: 4/3;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: sa-shimmer 1.5s ease-in-out infinite;
    border-radius: var(--sa-radius, 0);
  }

  @keyframes sa-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* Error state */
  .sa-error {
    width: 100%;
    aspect-ratio: 4/3;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f8f8;
    color: #999;
    font-size: 14px;
    border-radius: var(--sa-radius, 0);
    border: 1px dashed #ddd;
  }

  /* Image styles */
  .sa-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: var(--sa-radius, 0);
  }

  /* 3D viewer */
  .sa-viewer {
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: var(--sa-radius, 0);
    overflow: hidden;
  }

  .sa-viewer model-viewer {
    width: 100%;
    height: 100%;
  }
`;var S=!1,H=!1;function Q(){return S?Promise.resolve():H?new Promise(e=>{let t=setInterval(()=>{S&&(clearInterval(t),e())},100)}):(H=!0,new Promise(e=>{let t=document.createElement("script");t.type="module",t.src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js",t.onload=()=>{S=!0,e()},t.onerror=()=>{H=!1,e()},document.head.appendChild(t)}))}async function j(e){let t=await fetch(e);if(!t.ok)throw new Error(`Asset fetch failed: ${t.status}`);let r=await t.blob();return URL.createObjectURL(r)}async function A(e,t){if(t.content_type==="model/gltf-binary"&&(await Q(),S))try{let r=await j(t.url),s=document.createElement("div");s.className="sa-viewer";let i=document.createElement("model-viewer");i.setAttribute("alt",t.alt),i.setAttribute("auto-rotate",""),i.setAttribute("camera-controls",""),i.setAttribute("shadow-intensity","1"),i.setAttribute("tone-mapping","neutral"),i.setAttribute("style","width:100%;height:100%"),i.addEventListener("load",()=>URL.revokeObjectURL(r)),i.setAttribute("src",r),s.appendChild(i),e.innerHTML="",e.appendChild(s);return}catch{}if(t.content_type.startsWith("video/"))try{let r=await j(t.url),s=document.createElement("video");s.className="sa-image",s.autoplay=!0,s.muted=!0,s.loop=!0,s.playsInline=!0,s.setAttribute("playsinline",""),s.onloadeddata=()=>URL.revokeObjectURL(r),s.src=r,e.innerHTML="",e.appendChild(s);return}catch{}try{let r=await j(t.url),s=document.createElement("img");s.className="sa-image",s.alt=t.alt,s.draggable=!1,s.addEventListener("contextmenu",i=>i.preventDefault()),s.onload=()=>URL.revokeObjectURL(r),s.src=r,e.innerHTML="",e.appendChild(s)}catch{e.innerHTML='<div class="sa-error">Failed to load media</div>'}}var W=`
  .sa-gallery {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .sa-gallery-main {
    width: 100%;
    aspect-ratio: 4/3;
    position: relative;
    overflow: hidden;
    border-radius: var(--sa-radius, 0);
    background: #f8f8f8;
  }

  .sa-gallery-thumbs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px;
    scrollbar-width: thin;
  }

  .sa-gallery-thumb {
    width: 60px;
    height: 60px;
    flex-shrink: 0;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    opacity: 0.6;
    transition: opacity 0.2s, border-color 0.2s;
    background: #f0f0f0;
  }

  .sa-gallery-thumb:hover {
    opacity: 0.9;
  }

  .sa-gallery-thumb.active {
    border-color: var(--sa-primary, #333);
    opacity: 1;
  }

  .sa-gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }

  .sa-gallery-thumb-3d {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: #666;
    background: #e8e8e8;
  }
`;async function F(e,t){if(t.length===0){e.innerHTML='<div class="sa-error">No media available</div>';return}if(t.length===1){let n=document.createElement("div");n.className="sa-container",e.innerHTML="",e.appendChild(n),await A(n,t[0]);return}let r=document.createElement("style");r.textContent=W,e.appendChild(r);let s=document.createElement("div");s.className="sa-gallery";let i=document.createElement("div");i.className="sa-gallery-main",s.appendChild(i);let m=document.createElement("div");m.className="sa-gallery-thumbs",s.appendChild(m);let w=0;function f(n){w=n,m.querySelectorAll(".sa-gallery-thumb").forEach((u,_)=>{u.classList.toggle("active",_===n)}),i.innerHTML="",A(i,t[n])}t.forEach((n,x)=>{let u=document.createElement("div");if(u.className=`sa-gallery-thumb ${x===0?"active":""}`,n.content_type==="model/gltf-binary")u.classList.add("sa-gallery-thumb-3d"),u.textContent="3D";else{let _=document.createElement("img");_.src=n.url,_.alt=n.alt,_.draggable=!1,u.appendChild(_)}u.addEventListener("click",()=>f(x)),m.appendChild(u)}),e.innerHTML="",e.appendChild(s),await A(i,t[0]),e.setAttribute("tabindex","0"),e.addEventListener("keydown",n=>{n.key==="ArrowRight"||n.key==="ArrowDown"?(n.preventDefault(),f((w+1)%t.length)):(n.key==="ArrowLeft"||n.key==="ArrowUp")&&(n.preventDefault(),f((w-1+t.length)%t.length))})}var K=300*1e3,G=new Map,C=new Map,I=[],M="",$=null;function X(e,t,r,s){M=e,I.push({asset_id:t,product_ref:r,type:s}),$||($=setTimeout(B,5e3))}function B(){I.length>0&&M&&(q(M,[...I]),I=[]),$=null}typeof window<"u"&&(window.addEventListener("beforeunload",B),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&B()}));async function Z(e){let t=G.get(e);if(t&&Date.now()-t.cached_at<K)return t.data;let r=C.get(e);if(r)return r;let s=U(e).then(i=>(C.delete(e),i.valid&&G.set(e,{data:i,cached_at:Date.now()}),i)).catch(i=>(C.delete(e),{valid:!1,tier:"",style_profile:null,config:{allowed_types:[],impression_remaining:null},error:String(i)}));return C.set(e,s),s}var E,l,g,b,v,h,a,N,V,Y,L,T=class extends HTMLElement{constructor(){super();p(this,a);p(this,E);p(this,l);p(this,g);p(this,b,!1);p(this,v,null);p(this,h,null);d(this,E,this.attachShadow({mode:"closed"})),d(this,g,document.createElement("style")),o(this,g).textContent=P,o(this,E).appendChild(o(this,g)),d(this,l,document.createElement("div")),o(this,l).className="sa-container",o(this,E).appendChild(o(this,l))}connectedCallback(){o(this,l).innerHTML='<div class="sa-loading"></div>',d(this,h,new IntersectionObserver(r=>{for(let s of r)s.isIntersecting&&!o(this,b)&&(c(this,a,N).call(this),o(this,h)?.unobserve(this))},{rootMargin:"200px"})),o(this,h).observe(this)}disconnectedCallback(){o(this,h)?.disconnect(),d(this,h,null),o(this,v)?.abort(),d(this,v,null)}attributeChangedCallback(r,s,i){r==="api-base"&&i&&y(i),o(this,b)&&(r==="asset"||r==="product-id"||r==="product-type")&&(d(this,b,!1),c(this,a,N).call(this))}};E=new WeakMap,l=new WeakMap,g=new WeakMap,b=new WeakMap,v=new WeakMap,h=new WeakMap,a=new WeakSet,N=async function(){let r=this.getAttribute("token");if(!r){c(this,a,L).call(this,"Missing token");return}let s=this.getAttribute("api-base");s&&y(s),o(this,v)?.abort(),d(this,v,new AbortController);try{let i=await Z(r);if(!i.valid){c(this,a,L).call(this,i.error||"Invalid subscription");return}i.style_profile&&c(this,a,V).call(this,i.style_profile),i.style_profile?.font_url&&c(this,a,Y).call(this,i.style_profile.font_url);let m=this.getAttribute("asset"),w=this.getAttribute("product-id"),f=this.getAttribute("product-type")||"hero",n=await D({token:r,asset:m||void 0,productId:w||void 0,productType:f});if(!n.resolved||n.assets.length===0){c(this,a,L).call(this,"No media found");return}d(this,b,!0),f==="gallery"&&n.assets.length>1?await F(o(this,l),n.assets):(o(this,l).innerHTML="",await A(o(this,l),n.assets[0]));let x=n.assets[0];X(r,x.id,w||m||void 0,f)}catch(i){if(i.name==="AbortError")return;c(this,a,L).call(this,"Failed to load media"),console.error("[sa-media]",i)}},V=function(r){let s=z(r);s&&(o(this,g).textContent=P+`
:host { ${s} }`)},Y=function(r){if(!document.querySelector(`link[href="${r}"]`)){let s=document.createElement("link");s.rel="stylesheet",s.href=r,document.head.appendChild(s)}},L=function(r){o(this,l).innerHTML=`<div class="sa-error">${r}</div>`},T.observedAttributes=["token","asset","product-id","product-type","api-base"];(function(){let e=document.querySelectorAll('script[src*="loader"]');for(let t of e){let r=t.src;if(r.includes("spatialable")||r.includes("sa-media")||r.includes("loader")){try{let s=new URL(r);(s.hostname==="localhost"||s.hostname==="127.0.0.1")&&y(s.origin)}catch{}break}}if(typeof window.__SA_CONFIG__=="object"){let t=window.__SA_CONFIG__;t.apiBase&&y(t.apiBase)}})();customElements.get("sa-media")||customElements.define("sa-media",T);window.SpatialAble={version:"0.1.0",setApiBase:y};})();
