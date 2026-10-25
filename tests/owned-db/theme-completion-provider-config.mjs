// Pure, fail-closed parsing for the explicitly selected manual Test Mode fixture.
// No file, environment, network or provider access happens in this module.
export function parseRazorpayTestCsv(text) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > 16384) throw new Error('Invalid Test credential CSV');
    const rows = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    if (rows.length !== 2) throw new Error('Expected one Test credential pair');
    const cells = row => {
        const result = [], pattern = /(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))(?=,|$)/g;
        let match;
        while ((match = pattern.exec(row)) !== null) {
            result.push((match[1] === undefined ? match[2] : match[1].replaceAll('""', '"')).trim());
            if (match[0].length === 0) throw new Error('Invalid Test credential CSV');
        }
        if (result.length !== 2) throw new Error('Expected two credential columns');
        return result;
    };
    const headers = cells(rows[0]).map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const values = cells(rows[1]);
    if (headers[0] !== 'keyid' || headers[1] !== 'keysecret') throw new Error('Unexpected Test credential columns');
    const [keyId, keySecret] = values;
    if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId) || keySecret.length < 16 || keySecret.length > 256 || /[\x00-\x1f\x7f]/.test(keySecret)) {
        throw new Error('Only a complete Razorpay Test Mode pair is accepted');
    }
    return Object.freeze({ keyId, keySecret });
}

export function mapOwnedGatewayServiceUrl(input, origin) {
    const target = new URL(typeof input === 'string' ? input : input.url);
    const owned = new URL(origin);
    if (target.origin !== 'https://api-gateway' || owned.protocol !== 'http:' || owned.hostname !== '127.0.0.1'
        || !owned.port || owned.username || owned.password || owned.pathname !== '/' || owned.search || owned.hash) {
        throw new Error('Provider fixture refuses an unowned service destination');
    }
    return new URL(target.pathname + target.search, owned.origin).href;
}
