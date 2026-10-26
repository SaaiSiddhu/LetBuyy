'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, Input, Select, Textarea, Mail, Copy, ArrowRight } from '@letbuyy/ui';

export const CONTACT_TOPICS = [
    { value: 'account', label: 'Account or access' },
    { value: 'purchase', label: 'Purchase or license' },
    { value: 'installation', label: 'Adding or updating a theme' },
    { value: 'creator', label: 'Creator listing or package' },
    { value: 'privacy', label: 'Privacy, policy, or rights' },
    { value: 'other', label: 'Something else' },
];

export interface ContactDraftFields { name: string; email: string; topic: string; theme: string; reference: string; message: string }
type FieldErrors = Partial<Record<keyof ContactDraftFields, string>>;
type PreparedEmail = { url: string; body: string; subject: string };
const EMAIL = /^[^\s@<>?&#]+@[^\s@<>?&#]+\.[^\s@<>?&#]+$/;

/** Local email preparation only; this does not submit a support request. */
export function prepareContactEmail(fields: ContactDraftFields, recipient: string): { ok: true; draft: PreparedEmail } | { ok: false; errors: FieldErrors; formError?: string } {
    const values = Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value.trim()])) as unknown as ContactDraftFields;
    const errors: FieldErrors = {};
    const topic = CONTACT_TOPICS.find(item=>item.value===values.topic);
    if (!values.name || values.name.length > 80 || /[\r\n]/.test(values.name)) errors.name='Enter your name, using up to 80 characters.';
    if (!EMAIL.test(values.email) || values.email.length > 254) errors.email='Enter a valid email address.';
    if (!topic) errors.topic='Choose the subject that fits your question.';
    if (values.theme.length > 120 || /[\r\n]/.test(values.theme)) errors.theme='Use one line, up to 120 characters.';
    if (values.reference.length > 120 || /[\r\n]/.test(values.reference)) errors.reference='Use one line, up to 120 characters.';
    if (values.message.length < 20 || values.message.length > 1800) errors.message='Describe your question in 20–1,800 characters.';
    if (!EMAIL.test(recipient)) return { ok:false, errors, formError:'The email contact is unavailable. Use the support center for other contact options.' };
    if (Object.keys(errors).length || !topic) return { ok:false, errors };
    const subject = `LetBuyy Themes: ${topic.label}${values.theme ? ` — ${values.theme}` : ''}`;
    const body = [`Name: ${values.name}`,`Reply email: ${values.email}`,`Topic: ${topic.label}`,...(values.theme?[`Theme: ${values.theme}`]:[]),...(values.reference?[`Reference: ${values.reference}`]:[]),'',values.message].join('\n');
    return { ok:true, draft:{subject,body,url:`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} };
}

const subscribeReady = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

export default function MarketplaceContactForm({ recipient }: { recipient: string }) {
    const review = useRef<HTMLElement>(null);
    const ready = useSyncExternalStore(subscribeReady,clientReady,serverReady);
    const [errors,setErrors] = useState<FieldErrors>({});
    const [formError,setFormError] = useState('');
    const [draft,setDraft] = useState<PreparedEmail|null>(null);
    const [copyStatus,setCopyStatus] = useState('');
    useEffect(()=>{if(draft)review.current?.focus();},[draft]);
    function changed(field: keyof ContactDraftFields) {
        setDraft(null);setCopyStatus('');setFormError('');
        setErrors(current=>{const next={...current};delete next[field];return next;});
    }
    function prepare(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const read = (key: keyof ContactDraftFields) => String(data.get(key)||'');
        const result = prepareContactEmail({name:read('name'),email:read('email'),topic:read('topic'),theme:read('theme'),reference:read('reference'),message:read('message')},recipient);
        setCopyStatus('');
        if(!result.ok){setDraft(null);setErrors(result.errors);setFormError(result.formError||'Check the highlighted fields. Your message is still here.');const first=Object.keys(result.errors)[0];const control=first?event.currentTarget.elements.namedItem(first):null;if(control instanceof HTMLElement)control.focus();return;}
        setErrors({});setFormError('');setDraft(result.draft);
    }
    async function copyDraft() {
        if(!draft)return;
        try { await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);setCopyStatus('Draft copied. Paste it into your email app and review it before sending.'); }
        catch {setCopyStatus('Copy is unavailable here. You can select and copy the draft below.');}
    }
    return <div className="contact-form-panel" id="contact-form">
        <div className="contact-form-heading"><p className="marketplace-eyebrow">Write to theme support</p><h2>Tell us a little more.</h2><p>Fields marked required help us understand your question.</p></div>
        <form onSubmit={prepare} noValidate>
            {formError&&<p className="contact-form-error" role="alert">{formError}</p>}
            <fieldset disabled={!ready} className="contact-form-fields"><legend className="sr-only">Your contact details and question</legend>
                <div className="contact-form-row"><Input id="contact-name" name="name" label="Your name (required)" autoComplete="name" required maxLength={80} error={errors.name} onChange={()=>changed('name')}/><Input id="contact-email" name="email" label="Email address (required)" type="email" autoComplete="email" required maxLength={254} error={errors.email} onChange={()=>changed('email')}/></div>
                <Select id="contact-topic" name="topic" label="What is your question about? (required)" required defaultValue="" error={errors.topic} onChange={()=>changed('topic')} options={[{value:'',label:'Choose a topic',disabled:true},...CONTACT_TOPICS]}/>
                <div className="contact-form-row"><Input id="contact-theme" name="theme" label="Theme name or slug (optional)" maxLength={120} placeholder="For example, LetBuyy Core" error={errors.theme} onChange={()=>changed('theme')}/><Input id="contact-reference" name="reference" label="Purchase or listing reference (optional)" maxLength={120} error={errors.reference} onChange={()=>changed('reference')}/></div>
                <Textarea id="contact-message" name="message" label="Your message (required)" rows={6} required minLength={20} maxLength={1800} placeholder="Tell us what happened, what you expected, and anything you have already tried." helperText="20–1,800 characters. Include only the details needed to understand your question." error={errors.message} onChange={()=>changed('message')}/>
                <div className="contact-form-submit"><Button type="submit">Prepare email<ArrowRight size={17} aria-hidden="true"/></Button><p>You’ll review and send it in your email app. <Link href="/legal/privacy">Privacy information</Link></p></div>
            </fieldset>
            <noscript><p>Enable JavaScript to prepare a draft here, or email <a href={`mailto:${recipient}`}>{recipient}</a> directly.</p></noscript>
        </form>
        {draft&&<section ref={review} tabIndex={-1} className="contact-draft-review" aria-labelledby="contact-draft-title"><div role="status"><h3 id="contact-draft-title">Your email draft is ready.</h3><p>Review it below, then open your email app to send it to {recipient}.</p></div><Textarea label="Draft to review" readOnly value={`${draft.subject}\n\n${draft.body}`} rows={7}/><div className="contact-draft-actions"><a href={draft.url} className="marketplace-action"><Mail size={17} aria-hidden="true"/>Open email app</a><Button variant="secondary" type="button" onClick={()=>void copyDraft()}><Copy size={16} aria-hidden="true"/>Copy draft</Button></div><p className="contact-draft-fallback">If your email app does not open, copy the draft and email it to <a href={`mailto:${recipient}`}>{recipient}</a>.</p>{copyStatus&&<p role="status">{copyStatus}</p>}</section>}
    </div>;
}
