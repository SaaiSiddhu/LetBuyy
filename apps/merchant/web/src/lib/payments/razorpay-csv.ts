/** Official key download input only; never persisted or logged by the browser. */
export function readRazorpayTestKeyCsv(text: string) {
    const fail = () => new Error('Choose a Razorpay test-key CSV containing one key_id and key_secret pair.');
    if (text.length > 4096) throw fail();
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    if (lines.length !== 2) throw fail();
    const fields = (line: string) => line.split(',').map(value => value.trim().replace(/^"([^"\r\n]*)"$/, '$1'));
    const headers = fields(lines[0]);
    const values = fields(lines[1]);
    if (headers.length !== 2 || values.length !== 2 || headers[0] !== 'key_id' || headers[1] !== 'key_secret') throw fail();
    if (!/^rzp_test_[A-Za-z0-9]+$/.test(values[0]) || !/^[A-Za-z0-9_-]{16,256}$/.test(values[1])) throw fail();
    return { key_id: values[0], key_secret: values[1], test_mode: true as const };
}
