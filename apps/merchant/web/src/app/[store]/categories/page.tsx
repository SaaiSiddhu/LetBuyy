'use client'
import {useState,useRef,useLayoutEffect,useEffect}from 'react'
import {useParams}from 'next/navigation'
import {Page,PageHeader,Card,Section,Button,Input,Textarea,Banner,Badge,Table,ConfirmDialog,Checkbox}from '@letbuyy/ui'
import {ProductCategoryPageSchema,ProductCategoryReadSchema,confirmProductCategoryCommandResult,
 ProductCategoryCommandIntentSchema,type ProductCategoryRead,type ProductCategoryPage,type ProductCategoryCommandIntent}from '@letbuyy/shared-types'
import {useMerchantSecurityContext}from '@/components/security/MerchantSecurityContext'
import {readCategoryCommand,retainCategoryCommand,clearCategoryCommand,withCategoryExecution,type SavedCategoryCommand}from '@/lib/products/category-command-journal'

type Form={name:string;slug:string;description:string;image:string;parent:ProductCategoryRead|null;order:string;visible:boolean}
const blank=():Form=>({name:'',slug:'',description:'',image:'',parent:null,order:'0',visible:true})
const message=(e:unknown)=>e instanceof Error?(e.name==='ZodError'?'The category response could not be confirmed. Keep the original request.':e.message):'The original category outcome could not be confirmed.'
export default function CategoriesPage(){
 const {store}=useParams<{store:string}>(),scope=useMerchantSecurityContext(store)
 if(!scope.siteId)return <Page><Banner variant="critical">Reload the selected store before opening categories.</Banner></Page>
 return <Workspace key={`${scope.actorId}:${scope.siteId}`} store={store} actorId={scope.actorId} siteId={scope.siteId}/>
}
function Workspace({store,actorId,siteId}:{store:string;actorId:string;siteId:string}){
 const [page,setPage]=useState<ProductCategoryPage|null>(null),[pageNumber,setPageNumber]=useState(1),[search,setSearch]=useState('')
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[denied,setDenied]=useState(false)
 const [pending,setPending]=useState<SavedCategoryCommand|null>(null),[reviewable,setReviewable]=useState(false)
 const [editing,setEditing]=useState<ProductCategoryRead|null>(null),[form,setForm]=useState<Form|null>(null),[deleteRow,setDeleteRow]=useState<ProductCategoryRead|null>(null)
 const [discard,setDiscard]=useState(false)
 const [parents,setParents]=useState<ProductCategoryPage|null>(null),[parentSearch,setParentSearch]=useState(''),[parentPage,setParentPage]=useState(1)
 const alive=useRef(false),inFlight=useRef(false),controller=useRef<AbortController|null>(null),securityEpoch=useRef(0),access=useRef(true)
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort()}},[])
 const dirty=form!==null&&JSON.stringify([form.name,form.slug,form.description,form.image,form.parent?.id||null,form.order,form.visible])!==JSON.stringify(
  [editing?.name||'',editing?.slug||'',editing?.description||'',editing?.image_url||'',editing?.parent_id||null,String(editing?.display_order??0),editing?.is_visible??true])
 useEffect(()=>{
  if(!dirty||pending)return
  const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
  window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent)
 },[dirty,pending])
 function check(){if(!alive.current||!access.current)throw new Error('Account or store access changed. Reload this store.')}
 function dependencies(){if(!navigator.locks)throw new Error('This browser cannot retain a category save safely. Use a browser with secure request locking.');return {storage:window.localStorage,locks:navigator.locks}}
 async function request(query:string,method='GET',body?:unknown,key?:string){
  check();const epoch=securityEpoch.current,captured=controller.current!
  const response=await fetch(`/api/stores/${encodeURIComponent(store)}/categories${query}`,{method,cache:'no-store',
   signal:AbortSignal.any([captured.signal,AbortSignal.timeout(20000)]),headers:{'X-LetBuyy-Merchant-Context':actorId,
    ...(body?{'Content-Type':'application/json'}:{}),...(key?{'X-Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})})
  const value=await response.json().catch(()=>null);check()
  if(response.status===401||response.status===403||(response.status===409&&value?.error?.code==='SESSION_CONTEXT_CHANGED')){
   securityEpoch.current++;access.current=false;setDenied(true);setPage(null);setParents(null);setForm(null);setEditing(null)
   throw new Error('Store access changed. Reload this store.')
  }
  if(controller.current!==captured||captured.signal.aborted||epoch!==securityEpoch.current)throw new Error('A newer access check superseded this request. Reload categories.')
  if(!response.ok)throw Object.assign(new Error(value?.error?.message||'The category outcome could not be confirmed.'),{status:response.status,code:value?.error?.code})
  return value
 }
 async function run(work:()=>Promise<void>){
  if(inFlight.current||!alive.current||!access.current)return
  inFlight.current=true;controller.current?.abort();controller.current=new AbortController();setBusy(true);setError(null);setNotice(null)
  try{await work()}catch(e){if(alive.current)setError(message(e))}finally{inFlight.current=false;if(alive.current)setBusy(false)}
 }
 async function load(n=pageNumber,term=search){
  const result=ProductCategoryPageSchema.parse(await request(`?page=${n}&limit=20&search=${encodeURIComponent(term)}`))
  if(result.data.some(row=>row.store_id!==siteId)||result.meta.page!==n||result.meta.per_page!==20)throw new Error('Category page scope changed.')
  check();setPage(result);setPageNumber(n)
 }
 async function refresh(){await run(async()=>{
  const {storage,locks}=dependencies();setPending(await readCategoryCommand({actorId,siteId},storage,locks,check));setReviewable(false)
  await load()
 })}
 useEffect(()=>{let retired=false;queueMicrotask(()=>{if(!retired)void refresh()});return()=>{retired=true}},[]) // One keyed actor/store lifetime.
 async function send(){
  const {storage,locks}=dependencies()
  await withCategoryExecution({actorId,siteId},locks,check,async()=>{
   const saved=await readCategoryCommand({actorId,siteId},storage,locks,check)
   if(!saved){setPending(null);return}
   setPending(saved);setReviewable(false)
   const {operation,category_id:id,command}=saved.intent
   let value:unknown
   try{value=await request(id?`/${encodeURIComponent(id)}`:'',operation==='create'?'POST':operation==='update'?'PATCH':'DELETE',command,command.idempotency_key)}
   catch(e){const reason=e as {status?:number;code?:string}
    if(reason.status===400&&reason.code==='VALIDATION_ERROR'||reason.status===409&&['PRODUCT_CATEGORY_VERSION_CONFLICT','PRODUCT_CATEGORY_IN_USE','PRODUCT_CATEGORY_CONFLICT'].includes(reason.code||''))setReviewable(true)
    throw e
   }
   const receipt=confirmProductCategoryCommandResult(saved.intent,(value as {data?:unknown})?.data)
   if(receipt.store_id!==siteId||receipt.idempotency_key!==command.idempotency_key||receipt.operation!==operation||id&&receipt.id!==id
    ||'version'in command&&receipt.version<=command.version)throw new Error('The original category acknowledgement changed.')
   await clearCategoryCommand(saved,storage,locks,check);setPending(null);setReviewable(false);setForm(null);setEditing(null);setDeleteRow(null)
   setNotice(operation==='delete'?'Category deleted.':`Category saved. ${receipt.affected_products} assigned products updated.`)
  })
  await load()
 }
 async function save(){await run(async()=>{
  if(!form)return
  const fields={name:form.name.trim(),...(form.slug.trim()?{slug:form.slug.trim()}:{}),description:form.description.trim()||null,
   image_url:form.image.trim()||null,parent_id:form.parent?.id||null,display_order:Number(form.order),is_visible:form.visible}
  const intent=ProductCategoryCommandIntentSchema.parse({operation:editing?'update':'create',category_id:editing?.id||null,
   command:{...fields,store_id:siteId,idempotency_key:crypto.randomUUID(),...(editing?{version:editing.version}:{})}})
  const {storage,locks}=dependencies();const saved=await retainCategoryCommand({actorId,siteId},intent,storage,locks,check);setPending(saved);await send()
 })}
 async function remove(){await run(async()=>{
  if(!deleteRow)return
  const intent:ProductCategoryCommandIntent={operation:'delete',category_id:deleteRow.id,
   command:{store_id:siteId,idempotency_key:crypto.randomUUID(),version:deleteRow.version}}
  const {storage,locks}=dependencies();setPending(await retainCategoryCommand({actorId,siteId},intent,storage,locks,check));setDeleteRow(null);await send()
 })}
 async function review(){await run(async()=>{
  if(!reviewable)return
  const {storage,locks}=dependencies()
  await withCategoryExecution({actorId,siteId},locks,check,async()=>{
   const saved=await readCategoryCommand({actorId,siteId},storage,locks,check);if(!saved||!pending||JSON.stringify(saved)!==JSON.stringify(pending))throw new Error('The saved request changed. Reload categories.')
   const row=saved.intent.category_id?ProductCategoryReadSchema.parse((await request(`/${saved.intent.category_id}`)).data):null
   if(row&&(row.id!==saved.intent.category_id||row.store_id!==siteId))throw new Error('The current category scope changed.')
   // Only a definite rejection exposes this explicit review action. Unknown outcomes retain the original request.
   await clearCategoryCommand(saved,storage,locks,check);setPending(null);setReviewable(false)
   if(row)await open(row);else{setEditing(null);setForm(blank())}
   setNotice('Current category loaded. Review every field before starting a new save.')
  });await load()
 })}
 async function open(row?:ProductCategoryRead){
  const current=row?ProductCategoryReadSchema.parse((await request(`/${row.id}`)).data):null
  if(current&&(current.id!==row!.id||current.store_id!==siteId))throw new Error('The selected category changed.')
  let parent:ProductCategoryRead|null=null
  if(current?.parent_id){parent=ProductCategoryReadSchema.parse((await request(`/${current.parent_id}`)).data);if(parent.store_id!==siteId||parent.id!==current.parent_id)throw new Error('The parent category changed.')}
  check();setEditing(current);setForm(current?{name:current.name,slug:current.slug,description:current.description||'',image:current.image_url||'',parent,order:String(current.display_order),visible:current.is_visible}:blank());setParents(null);setParentPage(1);setParentSearch('')
 }
 async function findParents(n=1){
  const result=ProductCategoryPageSchema.parse(await request(`?page=${n}&limit=10&search=${encodeURIComponent(parentSearch)}`))
  if(result.meta.page!==n||result.meta.per_page!==10||result.data.some(row=>row.store_id!==siteId))throw new Error('Parent category scope changed.')
  setParents(result);setParentPage(n)
 }
 const disabled=busy||denied||!!pending
 const listDisabled=disabled||form!==null
 return <Page>
  <PageHeader identity="collections" recipe="index" title="Categories" description="Organize the labels assigned to your products." breadcrumbs={[{label:'Products'},{label:'Categories'}]}
   primaryAction={{label:'Add category',disabled:listDisabled,onClick:()=>{if(!listDisabled)void run(()=>open())}}}/>
  {error&&<Banner variant="critical" title="Category action could not be confirmed">{error}</Banner>}
  {notice&&<Banner variant="success">{notice}</Banner>}
  {pending&&<Banner variant="warning" title="Saved category request needs recovery">
   <p>Recover this original {pending.intent.operation} before making another category change.</p>
   <Button disabled={busy||denied} onClick={()=>void run(send)}>Retry original category request</Button>
   {reviewable&&<Button variant="secondary" disabled={busy||denied} onClick={()=>void review()}>Review current category after rejection</Button>}
  </Banner>}
  <Card><Section title="Category list" description={page?`${page.meta.total} categories. Counts below describe this page.`:'Category counts are unavailable until a read succeeds.'}>
   <div className="flex flex-wrap gap-[var(--lb-space-3)]">
    <Input label="Search categories" value={search} maxLength={200} disabled={busy||denied} onChange={e=>setSearch(e.target.value)}/>
    <Button disabled={busy||denied} onClick={()=>void run(()=>load(1))}>Search</Button>
    <Button variant="secondary" disabled={busy||denied} onClick={()=>void refresh()}>Refresh categories</Button>
   </div>
   {page&&<>
    <Table><thead><tr><th>Name</th><th>Path</th><th>Products</th><th>Children</th><th>Metadata visibility</th><th>Actions</th></tr></thead>
     <tbody>{page.data.map(row=><tr key={row.id}>
      <td>{row.name}</td><td>{row.path}</td><td>{row.products_count}</td><td>{row.children_count}</td><td><Badge label={row.is_visible?'Visible':'Hidden'} variant={row.is_visible?'success':'default'}/></td>
      <td><Button variant="ghost" disabled={listDisabled} onClick={()=>void run(()=>open(row))} aria-label={`Edit category ${row.name}`}>Edit</Button>
       <Button variant="ghost" disabled={listDisabled} onClick={()=>setDeleteRow(row)} aria-label={`Delete category ${row.name}`}>Delete</Button></td>
     </tr>)}</tbody></Table>
    {page.data.length===0&&<p>No categories match this page.</p>}
    <div className="flex gap-[var(--lb-space-3)]"><Button disabled={busy||denied||!page.meta.has_prev} onClick={()=>void run(()=>load(pageNumber-1))}>Previous categories</Button>
     <span>Page {pageNumber} of {Math.max(1,page.meta.total_pages)}</span><Button disabled={busy||denied||!page.meta.has_next} onClick={()=>void run(()=>load(pageNumber+1))}>Next categories</Button></div>
   </>}
  </Section></Card>
  {form&&<Card><Section title={editing?'Edit category':'New category'} description="Renaming a category updates assigned product labels together. Deleting requires moving its products and children first.">
   <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
    <Input label="Name" maxLength={100} disabled={disabled} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
    <Input label="Slug" maxLength={100} disabled={disabled} value={form.slug} helperText="Leave blank to generate a slug when creating a category." onChange={e=>setForm({...form,slug:e.target.value})}/>
    <Textarea label="Description" maxLength={500} disabled={disabled} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
    <Input label="Image URL" maxLength={2048} disabled={disabled} value={form.image} onChange={e=>setForm({...form,image:e.target.value})}/>
    <Input label="Display order" type="number" min={0} max={2147483647} disabled={disabled} value={form.order} onChange={e=>setForm({...form,order:e.target.value})}/>
    <Checkbox label="Visible category metadata" checked={form.visible} disabled={disabled} onChange={e=>setForm({...form,visible:e.target.checked})}/>
   </div>
   <p>Parent: {form.parent?.name||'Root category'}</p><Button variant="secondary" disabled={disabled} onClick={()=>setForm({...form,parent:null})}>Use root category</Button>
   <Input label="Find parent category" value={parentSearch} disabled={disabled} onChange={e=>setParentSearch(e.target.value)}/>
   <Button variant="secondary" disabled={disabled} onClick={()=>void run(()=>findParents())}>Find parent</Button>
   {parents&&<div>{parents.data.filter(row=>row.id!==editing?.id).map(row=><Button key={row.id} variant="ghost" disabled={disabled} onClick={()=>setForm({...form,parent:row})}>{row.name}</Button>)}
    <Button disabled={disabled||!parents.meta.has_prev} onClick={()=>void run(()=>findParents(parentPage-1))}>Previous parents</Button>
    <Button disabled={disabled||!parents.meta.has_next} onClick={()=>void run(()=>findParents(parentPage+1))}>Next parents</Button></div>}
   <div className="flex gap-[var(--lb-space-3)]"><Button disabled={disabled||!form.name.trim()||!form.order.trim()} onClick={()=>void save()}>{editing?'Update category':'Create category'}</Button>
    <Button variant="secondary" disabled={disabled} onClick={()=>{if(dirty)setDiscard(true);else{setForm(null);setEditing(null)}}}>Discard category fields</Button></div>
  </Section></Card>}
  <ConfirmDialog open={!!deleteRow} title="Delete empty category?" description={deleteRow?`Delete ${deleteRow.name}? Move its products and child categories first.`:''} confirmLabel="Delete category" cancelLabel="Keep category" destructive
   onConfirm={()=>{if(!disabled)void remove()}} onClose={()=>{if(!busy)setDeleteRow(null)}}/>
  <ConfirmDialog open={discard} title="Discard unsaved category fields?" description="The fields in this form have not been saved." confirmLabel="Discard fields" cancelLabel="Keep editing" destructive
   onConfirm={()=>{if(!disabled){setForm(null);setEditing(null);setDiscard(false)}}} onClose={()=>setDiscard(false)}/>
 </Page>
}
