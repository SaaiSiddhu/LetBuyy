function pdfSafeText(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[^\x20-\x7E\n]/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function byteLength(value: string): number {
    return new TextEncoder().encode(value).length;
}

export function createSimplePdfBytes(title: string, lines: readonly string[]): Uint8Array {
    const content = [
        'BT',
        '/F1 18 Tf',
        `50 780 Td (${pdfSafeText(title).slice(0, 120)}) Tj`,
        '/F1 10 Tf',
        ...lines.slice(0, 42).map((line, index) => `50 ${748 - index * 16} Td (${pdfSafeText(line).slice(0, 140)}) Tj`),
        'ET',
    ].join('\n');

    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let index = 0; index < objects.length; index += 1) {
        offsets.push(byteLength(pdf));
        pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (const offset of offsets.slice(1)) {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new TextEncoder().encode(pdf);
}

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}
