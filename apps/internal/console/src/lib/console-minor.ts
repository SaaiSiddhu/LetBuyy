/** Display an already-recorded minor amount without unsafe floating-point conversion. */
export function formatRecordedMinor(value:string|null,currency:string|null='INR') {
    if(value===null||!/^\d+$/.test(value))return 'Unavailable';
    const minor=BigInt(value),whole=minor/BigInt(100),cents=String(minor%BigInt(100)).padStart(2,'0');
    return (currency==='INR'?'₹':(currency||'Unknown currency')+' ')+new Intl.NumberFormat('en-IN').format(whole)+'.'+cents;
}
