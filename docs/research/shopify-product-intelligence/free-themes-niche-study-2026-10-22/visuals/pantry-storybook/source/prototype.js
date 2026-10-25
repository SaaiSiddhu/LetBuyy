// Visual reference only. No network requests, persistence, account or payment effects.
if(new URLSearchParams(location.search).has('neutral'))document.body.classList.add('neutral');
document.querySelectorAll('button').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();let n=document.getElementById('prototype-status');if(!n){n=document.createElement('p');n.id='prototype-status';n.setAttribute('role','status');n.className='info';b.parentNode.append(n)}n.textContent='Visual reference control. Canonical integration is required before this can perform an action.'}));
