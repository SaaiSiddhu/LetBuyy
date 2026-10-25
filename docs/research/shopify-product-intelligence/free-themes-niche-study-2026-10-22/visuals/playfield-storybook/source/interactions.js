/* Local presentation interactions only. No API, identity or payment requests. */
document.querySelectorAll('.prototype-action').forEach(el=>el.addEventListener('click',()=>{
 document.querySelector('.toast')?.remove();
 const notice=document.createElement('div');notice.className='toast';notice.setAttribute('role','status');notice.textContent='Visual reference only. This action needs the canonical service integration.';document.body.append(notice);setTimeout(()=>notice.remove(),4500);
}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=document.querySelector('.mobile-menu[open]');if(menu){menu.removeAttribute('open');menu.querySelector('summary').focus();}}});
const filterForm=document.querySelector('#filter-form');
if(filterForm){
 const age=document.querySelector('#filter-age'),interest=document.querySelector('#filter-interest'),sort=document.querySelector('#sort');
 function apply(){
  const cards=[...document.querySelectorAll('#results .product-card')];let count=0;
  cards.forEach(card=>{const match=(!age.value||card.dataset.age===age.value)&&(!interest.value||card.dataset.interest===interest.value);card.hidden=!match;if(match)count++;});
  if(sort.selectedIndex===1)cards.sort((a,b)=>Number(a.querySelector('.card-bottom strong').textContent.replace(/[^0-9]/g,''))-Number(b.querySelector('.card-bottom strong').textContent.replace(/[^0-9]/g,''))).forEach(c=>document.querySelector('#results').append(c));
  document.querySelector('#result-title').textContent=(interest.value||'Activities')+(age.value?' for ages '+age.value.replace(' years',''):' · all ages');
  document.querySelector('#result-count').textContent=count+' activities'+(count?' · Showing 1–'+count:'');
  document.querySelector('#no-results').hidden=count>0;
  document.querySelectorAll('#applied-chips [data-clear]').forEach(chip=>chip.hidden=!({age,interest}[chip.dataset.clear].value));
  const url=new URL(location);url.searchParams.set('age',age.value);url.searchParams.set('interest',interest.value);history.replaceState(null,'',url);
 }
 const params=new URLSearchParams(location.search);if(params.has('age')){const raw=params.get('age');age.value=raw==='6–8 years'||raw==='3–5 years'||raw===''?raw:'6–8 years';}if(params.has('interest'))interest.value=params.get('interest');
 filterForm.addEventListener('submit',e=>{e.preventDefault();apply();});
 document.querySelectorAll('[data-clear]').forEach(el=>el.addEventListener('click',()=>{({age,interest}[el.dataset.clear]).value='';apply();}));
 document.querySelector('#clear-all').addEventListener('click',()=>{age.value='';interest.value='';apply();});apply();
}
