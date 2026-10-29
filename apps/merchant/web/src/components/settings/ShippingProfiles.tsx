'use client'

import { useState } from 'react'
import { Button, Card, Section, Input, Badge, Banner } from '@letbuyy/ui'
import { CreateShippingProfileSchema, UpdateShippingProfileSchema, type ShippingProfile } from '@letbuyy/shared-types'
import { parseShippingHandlingFeeMinor } from '@letbuyy/checkout-core'

type ProfileForm = {id:string;name:string;fee:string;cod:boolean;revision?:string}
export function ShippingProfiles({store,profiles,onChanged}: {store:string;profiles:ShippingProfile[];onChanged:()=>Promise<void>}) {
    const [form,setForm]=useState<ProfileForm|null>(null)
    const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null)
    const save=async (input:ProfileForm,makeDefault=false) => {
        if(busy)return
        setError(null)
        const fee=parseShippingHandlingFeeMinor(input.fee)
        const payload={name:input.name.trim(),handling_fee_minor:fee,cod_enabled:input.cod,
            ...(input.revision?{expected_revision:input.revision,...(makeDefault?{is_default:true}:{})}:{id:input.id})}
        const checked=input.revision?UpdateShippingProfileSchema.safeParse(payload):CreateShippingProfileSchema.omit({store_id:true}).safeParse(payload)
        if(fee===null || !checked.success){setError('Enter a profile name and a non-negative handling charge with up to two decimal places.');return}
        setBusy(true)
        try {
            const response=await fetch(`/api/stores/${encodeURIComponent(store)}/shipping/profiles${input.revision?`/${encodeURIComponent(input.id)}`:''}`,{
                method:input.revision?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(checked.data),
            })
            const result=await response.json().catch(()=>null)
            if(!response.ok)throw new Error(result?.error?.message || 'The profile could not be saved. Reload settings and try again.')
            setForm(null);await onChanged()
        } catch(error){setError(error instanceof Error?error.message:'Shipping profile is unavailable.')}
        finally{setBusy(false)}
    }
    const edit=(profile:ShippingProfile):ProfileForm=>({id:profile.id,name:profile.name,fee:String(profile.handling_fee_minor/100),cod:profile.cod_enabled,revision:profile.updated_at})
    return <Card><Section title="Shipping profiles" description="Group products that share delivery rules. Products without a specific profile inherit your default. Handling charges are added once to the selected delivery rate."
        action={<Button className="shrink-0 whitespace-nowrap" variant="secondary" disabled={busy || Boolean(form)} onClick={()=>{setError(null);setForm({id:crypto.randomUUID(),name:'',fee:'0',cod:true})}}>Add profile</Button>}>
        <p className="mb-[var(--lb-space-3)] text-sm text-[var(--lb-color-text-subdued)]">Each checkout currently uses one shipping profile. Products from different profiles need separate orders; no unrelated delivery rate is substituted.</p>
        {error && <Banner variant="critical" title="Shipping profile needs attention">{error}</Banner>}
        <div className="space-y-[var(--lb-space-3)]">
            {profiles.length===0 && <p className="text-[var(--lb-color-text-subdued)]">Your general delivery zones apply until you add a profile. The first profile becomes your default.</p>}
            {profiles.map(profile=><div key={profile.id} className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                <div><h3 className="font-semibold">{profile.name}</h3><p className="text-sm text-[var(--lb-color-text-subdued)]">{profile.handling_fee_minor?`₹${(profile.handling_fee_minor/100).toLocaleString('en-IN')} handling charge`:'No handling charge'} · {profile.cod_enabled?'COD allowed':'Prepaid only'}</p></div>
                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">{profile.is_default?<Badge label="Default" variant="success"/>:<Button variant="secondary" size="sm" disabled={busy} onClick={()=>void save(edit(profile),true)}>Make default</Button>}
                    <Button variant="secondary" size="sm" disabled={busy} onClick={()=>{setError(null);setForm(edit(profile))}}>Edit profile</Button></div>
            </div>)}
        </div>
        {form && <div className="mt-[var(--lb-space-4)] grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)] sm:grid-cols-2">
            <Input label="Profile name" value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/>
            <Input label="Handling charge (₹)" type="number" min={0} step="0.01" value={form.fee} onChange={event=>setForm({...form,fee:event.target.value})}/>
            <label className="flex items-center gap-[var(--lb-space-2)]"><Input unstyled type="checkbox" checked={form.cod} onChange={event=>setForm({...form,cod:event.target.checked})}/>Allow cash on delivery for this profile</label>
            <div className="flex gap-[var(--lb-space-2)]"><Button loading={busy} onClick={()=>void save(form)}>Save profile</Button><Button variant="secondary" disabled={busy} onClick={()=>setForm(null)}>Cancel</Button></div>
        </div>}
    </Section></Card>
}
