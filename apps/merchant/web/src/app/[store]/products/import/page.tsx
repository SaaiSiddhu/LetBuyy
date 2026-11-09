'use client'
import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Page, PageHeader, Card, Section, Button, Banner, Textarea } from '@letbuyy/ui'
import { ProductCsvImportSchema, ProductImportCapabilitiesSchema, ProductImportJobSchema, ProductImportRowsPageSchema,
    ProductImportHistoryPageSchema, PRODUCT_IMPORT_MAX_BYTES, type ProductImportJob,
    type ProductImportRowsPage, type ProductImportHistoryPage } from '@letbuyy/shared-types'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { productImportMessage } from '@/lib/products/product-import-messages'
import { readProductImport, retainProductImport, clearProductImport, type PendingProductImport } from '@/lib/products/product-import-journal'

function importError(error:unknown,fallback='The import outcome could not be confirmed.'){
    return error instanceof Error?error.name==='ZodError'?'The import response could not be verified. Refresh imports.':error.message:fallback
}
export default function ProductImportsPage(){
    const {store}=useParams<{store:string}>(),scope=useMerchantSecurityContext(store)
    if(!scope.siteId)return <Page><Banner variant="critical">Reload the selected store before opening CSV imports.</Banner></Page>
    return <Workspace key={`${scope.actorId}:${scope.siteId}`} store={store} actorId={scope.actorId} siteId={scope.siteId}/>
}
function Workspace({store,actorId,siteId}:{store:string;actorId:string;siteId:string}) {
    const [source,setSource]=useState(''),[filename,setFilename]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null)
    const [supported,setSupported]=useState(false),[supportError,setSupportError]=useState<string|null>(null),[pending,setPending]=useState<PendingProductImport|null>(null)
    const [history,setHistory]=useState<ProductImportHistoryPage|null>(null),[historyPage,setHistoryPage]=useState(1)
    const [job,setJob]=useState<ProductImportJob|null>(null),[rows,setRows]=useState<ProductImportRowsPage|null>(null),[rowPage,setRowPage]=useState(1),[filter,setFilter]=useState('all')
    const alive=useRef(false),inFlight=useRef(false),controller=useRef<AbortController|null>(null),securityEpoch=useRef(0)
    useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort()}},[])
    function check(){if(!alive.current)throw new Error('Account or store context changed.')}
    function dependencies(){if(!navigator.locks)throw new Error('This browser cannot retain an import safely. Use a browser with secure request locking.');return {storage:window.localStorage,locks:navigator.locks}}
    async function request(query:string,method='GET',body?:unknown,key?:string):Promise<unknown> {
        check();const captured=controller.current!,epoch=securityEpoch.current;let response:Response
        try{response=await fetch(`/api/stores/${encodeURIComponent(store)}/products/import${query}`,{method,cache:'no-store',
            signal:AbortSignal.any([captured.signal,AbortSignal.timeout(20000)]),headers:{'X-LetBuyy-Merchant-Context':actorId,
                ...(body?{'Content-Type':'application/json'}:{}),...(key?{'X-Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})})}
        catch{check();throw new Error(method==='GET'?'Import status is unavailable. Refresh the original request.':'The import could not be confirmed. Recover the original registration before sending another file.')}
        const value=await response.json().catch(()=>null);check()
        if(response.status===401||response.status===403||(response.status===409&&value?.error?.code==='SESSION_CONTEXT_CHANGED')){
            securityEpoch.current++;setSupported(false);setHistory(null);setJob(null);setRows(null);setSource('');setFilename('')
            setSupportError('Store access changed. Reload this store.');throw new Error('Store access changed. Reload this store.')
        }
        if(controller.current!==captured||captured.signal.aborted||securityEpoch.current!==epoch)throw new Error('A newer access check superseded this request. Refresh imports.')
        if(!response.ok)throw Object.assign(new Error(value?.error?.message||'The original import outcome could not be confirmed.'),{code:value?.error?.code,status:response.status})
        if(!value||!Object.hasOwn(value,'data'))throw new Error('Import response could not be confirmed.')
        return value.data
    }
    function verifyJob(value:unknown,original?:PendingProductImport|ProductImportJob){
        const result=ProductImportJobSchema.parse(value)
        if(result.actor_id!==actorId||result.store_id!==siteId||(original&&('key'in original
            ?result.idempotency_key!==original.key||result.source_sha256!==original.sourceSha256
            :result.id!==original.id||result.idempotency_key!==original.idempotency_key||result.source_sha256!==original.source_sha256)))throw new Error('Original import identity changed.')
        return result
    }
    const jobData=(value:unknown)=>value&&typeof value==='object'&&'job'in value?value.job:undefined
    async function run(work:()=>Promise<void>){
        if(inFlight.current||!alive.current)return;inFlight.current=true;controller.current?.abort();controller.current=new AbortController();setBusy(true);setError(null)
        try{await work()}catch(e){if(alive.current)setError(importError(e))}
        finally{inFlight.current=false;if(alive.current)setBusy(false)}
    }
    async function readHistory(page=historyPage){
        const result=ProductImportHistoryPageSchema.parse(await request(`?page=${page}&limit=20`))
        if(result.meta.actor_id!==actorId||result.meta.store_id!==siteId||result.meta.page!==page||result.meta.per_page!==20)throw new Error('Import history scope changed.')
        check();setHistory(result)
    }
    async function readJob(id:string,page=rowPage,status=filter){
        const current=verifyJob(jobData(await request(`?view=job&id=${encodeURIComponent(id)}`)))
        if(current.id!==id)throw new Error('Import job changed.')
        const result=ProductImportRowsPageSchema.parse(await request(`?view=rows&id=${encodeURIComponent(id)}&page=${page}&limit=20&status=${status}`))
        if(result.meta.actor_id!==actorId||result.meta.store_id!==siteId||result.meta.job_id!==id||result.meta.page!==page||result.meta.per_page!==20
            ||(status!=='all'&&result.data.some(r=>r.status!==status)))throw new Error('Import rows scope changed.')
        check();setJob(current);setRows(result)
    }
    async function capability(){
        const captured=controller.current,epoch=securityEpoch.current
        try{const caps=ProductImportCapabilitiesSchema.parse(await request('?view=capabilities'))
            if(caps.actor_id!==actorId||caps.store_id!==siteId)throw new Error('Import capability context changed.')
            if(controller.current!==captured||securityEpoch.current!==epoch)return
            check();setSupported(true);setSupportError(null)
        }catch(e){check();if(controller.current!==captured||securityEpoch.current!==epoch)return;setSupported(false);setSupportError(importError(e,'New imports are unavailable.'))}
    }
    async function refresh(){await run(async()=>{
        const {storage,locks}=dependencies();setPending(await readProductImport({actorId,siteId},storage,locks,check))
        await Promise.all([readHistory(),capability()]);if(job)await readJob(job.id)
    })}
    useEffect(()=>{let retired=false;queueMicrotask(()=>{if(!retired)void refresh()});return()=>{retired=true}},[]) // The keyed workspace owns one actor/store lifetime.
    async function recover(){await run(async()=>{
        const {storage,locks}=dependencies(),saved=await readProductImport({actorId,siteId},storage,locks,check)
        if(!saved){setPending(null);return}
        const known=jobData(await request(`?view=key&key=${saved.key}`))
        if(known===null)throw new Error('No registered job was found. Choose the exact original CSV and submit with its retained request.')
        const confirmed=verifyJob(known,saved);await clearProductImport(saved,storage,locks,check);setPending(null);setJob(confirmed);setRowPage(1);setFilter('all');setRows(null)
        await readJob(confirmed.id,1,'all');await readHistory()
    })}
    async function submit(){await run(async()=>{
        const bytes=new TextEncoder().encode(source);if(!source.trim()||bytes.length>PRODUCT_IMPORT_MAX_BYTES)throw new Error('Use a nonempty CSV of at most one MiB.')
        const valid=ProductCsvImportSchema.safeParse({store_id:siteId,csv:source,contract_version:2,idempotency_key:'00000000-0000-4000-8000-000000000000'})
        if(!valid.success)throw new Error(valid.error.issues[0]?.message||'Split this CSV into smaller files.')
        const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');check()
        const {storage,locks}=dependencies(),saved=await retainProductImport({actorId,siteId},hash,storage,locks,check);setPending(saved)
        let known=jobData(await request(`?view=key&key=${saved.key}`))
        if(known===null){
            try{known=jobData(await request('','POST',{store_id:siteId,csv:source,contract_version:2,idempotency_key:saved.key},saved.key))}
            catch(e){const refusal=e as {code?:string;status?:number};if((refusal.code==='INVALID_CSV'&&refusal.status===400)||(refusal.code==='IMPORT_TOO_LARGE'&&refusal.status===413)){await clearProductImport(saved,storage,locks,check);setPending(null)}throw e}
        }
        const confirmed=verifyJob(known,saved);await clearProductImport(saved,storage,locks,check);setPending(null);setSource('');setFilename('');setJob(confirmed);setRowPage(1);setFilter('all');setRows(null)
        await readJob(confirmed.id,1,'all');setHistoryPage(1);await readHistory(1)
    })}
    async function stopRegistration(){
        if(!pending||busy||!window.confirm('Stop the original request, including a late registration? Products already committed remain; review them before importing another file.'))return
        await run(async()=>{
            const {storage,locks}=dependencies(),saved=await readProductImport({actorId,siteId},storage,locks,check)
            if(!saved)throw new Error('The pending request changed. Refresh imports.')
            const confirmed=verifyJob(jobData(await request('','PUT',{store_id:siteId,idempotency_key:saved.key,source_sha256:saved.sourceSha256,contract_version:2},saved.key)),saved)
            if(!['stopped','completed','blocked'].includes(confirmed.status))throw new Error('The original stop could not be confirmed. Keep the request for recovery.')
            await clearProductImport(saved,storage,locks,check);setPending(null);setSource('');setFilename('');setJob(confirmed);setRowPage(1);setFilter('all');setRows(null)
            await readJob(confirmed.id,1,'all');setHistoryPage(1);await readHistory(1)
        })
    }
    async function command(action:'retry'|'stop'){
        if(!job||busy)return
        if(action==='stop'&&!window.confirm('Stop the remaining rows? Already committed products remain.'))return
        const original=job
        await run(async()=>{const current=verifyJob(jobData(await request('','PATCH',{action,store_id:siteId,job_id:original.id,idempotency_key:original.idempotency_key,contract_version:2},original.idempotency_key)),original)
            setJob(current);await readJob(original.id);await readHistory()})
    }
    return <Page><PageHeader title="CSV imports" description="Create products and recover the original import." breadcrumbs={[{label:'Products',href:`/${store}/products`},{label:'CSV imports'}]} secondaryActions={[{label:'Refresh',onClick:refresh,disabled:busy}]}/>
        {error&&<Banner variant="critical">{error}</Banner>}{supportError&&<Banner variant="warning">{supportError}</Banner>}
        {pending&&<Banner variant="warning">An original registration needs confirmation. Keep its CSV. <Button disabled={busy} onClick={recover}>Recover original registration</Button><Button disabled={busy} onClick={stopRegistration}>Stop original request</Button></Banner>}
        <Section><Card><p>Up to 500 rows and one MiB per request. Large quoted files may need to be split. Creates active products; existing products are not updated. Required: name. Optional: price (rupees), description, category, stock, tags, images. Separate tags and image URLs with semicolons. Unsupported columns are refused.</p>
            <label>Choose UTF-8 CSV <input aria-label="Choose CSV" type="file" accept=".csv,text/csv" disabled={busy||!supported} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;void run(async()=>{
                if(file.size>PRODUCT_IMPORT_MAX_BYTES||file.size===0)throw new Error('Use a CSV of at most one MiB.')
                const bytes=await file.arrayBuffer();check();let decoded:string
                try{decoded=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw new Error('Choose a valid UTF-8 CSV.')}
                setSource(decoded);setFilename(file.name)
            })}}/></label>{filename&&<p>{filename}</p>}
            <p><a download="product-import-template.csv" href="data:text/csv;charset=utf-8,name%2Cprice%2Cdescription%2Ccategory%2Cstock%2Ctags%2Cimages%0AExample%20product%2C10.50%2C%2C%2C0%2C%2C%0A">Download template</a></p>
            <Textarea label="CSV contents" value={source} onChange={e=>setSource(e.target.value)} disabled={busy||!supported} rows={6} maxLength={PRODUCT_IMPORT_MAX_BYTES}/>
            <Button onClick={submit} disabled={busy||!supported}>{pending?'Submit original CSV':'Start import'}</Button>
        </Card></Section>
        {job&&<Section title="Original import"><Card><p>{job.id}</p><p aria-live="polite">{job.total_rows===0?'Registration was stopped before any rows were accepted.':`${job.status}: ${job.row_count}/${job.total_rows} products committed · ${job.pending_rows} pending · ${job.failed_rows} failed · ${job.stopped_rows} stopped.`}</p>
            {job.error_code&&<p>{productImportMessage(job.error_code)}</p>}
            <Button disabled={busy} onClick={()=>run(()=>readJob(job.id))}>Refresh status</Button>{job.resumable&&<Button disabled={busy} onClick={()=>command('retry')}>Resume original rows</Button>}
            {['queued','running','failed'].includes(job.status)&&<Button disabled={busy} onClick={()=>command('stop')}>Stop remaining rows</Button>}
            <label>Row status <select value={filter} disabled={busy} onChange={e=>{const next=e.target.value;setFilter(next);setRowPage(1);setRows(null);void run(()=>readJob(job.id,1,next))}}>{['all','queued','completed','failed','stopped'].map(s=><option key={s}>{s}</option>)}</select></label>
            {rows&&<><ul>{rows.data.map(row=><li key={row.id}>Row {row.ordinal}: {row.status}{row.product_id?<>{' · '}<a href={`/${encodeURIComponent(store)}/products/${encodeURIComponent(row.product_id)}`}>View product</a></>:row.error_code?` · ${productImportMessage(row.error_code)}`:''}</li>)}</ul>
                <Button disabled={busy||rowPage<=1} onClick={()=>{setRows(null);setRowPage(rowPage-1);void run(()=>readJob(job.id,rowPage-1))}}>Previous rows</Button> Page {rowPage} · {rows.meta.total} matching rows <Button disabled={busy||!rows.meta.has_next} onClick={()=>{setRows(null);setRowPage(rowPage+1);void run(()=>readJob(job.id,rowPage+1))}}>Next rows</Button></>}
        </Card></Section>}
        <Section title="Import history"><Card>{history&&<>{history.meta.total===0?<p>No CSV imports for this account and store.</p>:<ul>{history.data.map(item=><li key={item.id}><Button disabled={busy} onClick={()=>{setJob(null);setRows(null);setRowPage(1);setFilter('all');void run(()=>readJob(item.id,1,'all'))}}>{item.total_rows===0?'Registration stopped':`${item.status} · ${item.row_count}/${item.total_rows} committed`} · {new Date(item.created_at).toLocaleString()}</Button></li>)}</ul>}
            <Button disabled={busy||historyPage<=1} onClick={()=>{setHistory(null);setHistoryPage(historyPage-1);void run(()=>readHistory(historyPage-1))}}>Previous imports</Button> Page {historyPage} <Button disabled={busy||!history.meta.has_next} onClick={()=>{setHistory(null);setHistoryPage(historyPage+1);void run(()=>readHistory(historyPage+1))}}>Next imports</Button></>}</Card></Section>
    </Page>
}
