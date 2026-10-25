// Visual-study disclosure behavior only. No API, identity, cart or payment calls.
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const open=document.querySelector('details.menu[open]');
 if(open){open.open=false;open.querySelector('summary').focus();}
});
document.addEventListener('submit',event=>event.preventDefault());
