// Presentation navigation only. No API, credentials, persistence or commerce effects.
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-proposed]');
 if(b){let n=document.querySelector('#prototype-feedback');if(!n){n=document.createElement('div');n.id='prototype-feedback';n.setAttribute('role','status');n.style.cssText='position:fixed;bottom:16px;left:16px;right:16px;max-width:560px;background:#142236;color:white;padding:16px 20px;border-radius:4px;z-index:30;font:14px/1.5 Inter,Arial,sans-serif;box-shadow:0 4px 20px #0003';document.body.append(n);}n.textContent='Visual reference only. This proposed action requires the canonical LetBuyy integration.';setTimeout(()=>n.remove(),4500);}
 const p=event.target.closest('[data-toggle-password]');if(p){const input=p.parentElement.querySelector('input');input.type=input.type==='password'?'text':'password';p.setAttribute('aria-label',input.type==='password'?'Show password':'Hide password');}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.mobile-menu[open]').forEach(d=>{d.open=false;d.querySelector('summary').focus()});document.querySelector('#prototype-feedback')?.remove()}});
if(new URLSearchParams(location.search).has('neutral')){document.body.classList.add('neutral');document.querySelectorAll('.wordmark').forEach(e=>e.textContent='Store');document.querySelectorAll('.eyebrow').forEach(e=>e.textContent=e.textContent.replace(/NODEWORKS/g,'MODEL'));}
