'use client';
import {useState,useEffect} from 'react';
import {Banner,Button,Modal,useToast} from '@letbuyy/ui';
import {type useWarehouseCommands} from '@/lib/inventory/use-warehouse-commands';
type Recovery=ReturnType<typeof useWarehouseCommands>;
export function WarehouseCommandRecovery({commands,onResolved}:{commands:Recovery;onResolved:()=>void}) {
 const [confirm,setConfirm]=useState<unknown>(null),{notify}=useToast();
 useEffect(()=>{if(!commands.ready)setConfirm(null);},[commands.ready]);
 async function recover(stop:boolean) {
  const token=commands.scopeToken;
  try {
   const ack=await commands.recover(stop);
   if(!token?.active)return;
   setConfirm(null);notify({title:ack.command_receipt.outcome==='applied'?'Original warehouse request confirmed':'Original warehouse request stopped before it applied',variant:'success'});
   onResolved();
  }catch{/* The original intent remains visible for recovery. */}
 }
 if(!commands.ready&&!commands.error)return <Banner title="Checking saved warehouse requests" variant="info">Checking this account and store before enabling stock actions.</Banner>;
 if(!commands.pending&&!commands.error)return null;
 return <>
  <Banner title={commands.pending?'Warehouse request awaiting confirmation':'Warehouse actions unavailable'} variant="warning">
   <p>{commands.error??'Resolve the original request before starting another stock movement. Its original details are saved in this browser for recovery.'}</p>
   {commands.pending?<div className="flex flex-wrap gap-[var(--lb-space-2)]">
    <Button disabled={commands.busy||!commands.ready} onClick={()=>void recover(false)}>Retry original</Button>
    <Button variant="secondary" disabled={commands.busy||!commands.ready} onClick={()=>setConfirm(commands.scopeToken)}>Stop original</Button>
   </div>:<Button disabled={commands.busy} onClick={commands.checkSaved}>Check saved requests</Button>}
   {commands.pending&&!commands.ready&&<Button disabled={commands.busy} onClick={commands.checkSaved}>Check saved requests</Button>}
  </Banner>
  <Modal open={confirm!==null&&confirm===commands.scopeToken&&!!commands.scopeToken?.active}
   title="Stop the original request?" onClose={()=>setConfirm(null)}
   footer={<div className="flex gap-[var(--lb-space-2)]"><Button variant="secondary" disabled={commands.busy} onClick={()=>setConfirm(null)}>Back</Button><Button disabled={commands.busy} onClick={()=>void recover(true)}>Confirm stop</Button></div>}>
   <p>If it already applied, this confirms its outcome. Otherwise, it prevents that request from applying later. It does not undo a stock movement that already happened.</p>
   {commands.error&&<p role="alert">{commands.error}</p>}
  </Modal>
 </>;
}
