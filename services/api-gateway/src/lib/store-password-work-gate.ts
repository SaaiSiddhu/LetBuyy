import {AppError} from './errors';
const unavailable=()=>new AppError('Store access is unavailable',503,'STOREFRONT_ACCESS_UNAVAILABLE');
type Waiting={start:()=>void};
/** Isolate-local memory/work bound only. It carries no credential authority. */
export class StorePasswordWorkGate {
 private active=false;
 private readonly waiting:Waiting[]=[];
 constructor(private readonly maxPending=4,private readonly waitMs=1000,private readonly now:()=>number=()=>performance.now()){
  if(!Number.isSafeInteger(maxPending)||maxPending<0||!Number.isSafeInteger(waitMs)||waitMs<1)throw new Error('Invalid password work bounds');
 }
 async run<T>(work:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
  if(signal?.aborted)throw unavailable();
  if(!this.active){this.active=true;return this.execute(work,signal);}
  if(this.waiting.length>=this.maxPending)throw unavailable();
  return new Promise<T>((resolve,reject)=>{
   let queued=true;const deadline=this.now()+this.waitMs;
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
   const cancel=()=>{if(!queued)return;queued=false;const index=this.waiting.indexOf(entry);if(index>=0)this.waiting.splice(index,1);cleanup();reject(unavailable());};
   const entry:Waiting={start:()=>{
    if(!queued)return;
    queued=false;cleanup();
    if(signal?.aborted||this.now()>=deadline){reject(unavailable());this.advance();return;}
    this.execute(work,signal).then(resolve,reject);
   }};
   const timer=setTimeout(cancel,this.waitMs);
   this.waiting.push(entry);signal?.addEventListener('abort',cancel,{once:true});
   if(signal?.aborted)cancel();
  });
 }
 private async execute<T>(work:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
  try{const result=await work();if(signal?.aborted)throw unavailable();return result;}
  finally{this.advance();}
 }
 private advance(){const next=this.waiting.shift();if(next){this.active=true;next.start();}else this.active=false;}
}
