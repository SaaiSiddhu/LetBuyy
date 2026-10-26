import type { ThemeRendererResult } from '@letbuyy/theme-engine';

// Warning text may contain merchant HTML, paths or capability URLs. Logs contain
// only these fixed classifications; rendering and sanitization still fail closed.
export function liquidRenderFailureDiagnostics(result: Pick<ThemeRendererResult, 'status' | 'warnings'>) {
    const warnings = result.warnings.join('\n');
    const rules = [
        ['node_dom_unavailable', /Theme HTML sanitization requires the Node SSR runtime/],
        ['module_unavailable', /Cannot find (?:module|package)|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/],
        ['esm_interop', /ERR_REQUIRE_ESM|require\(\) of ES Module|require is not defined/],
        ['file_unavailable', /ENOENT|no such file or directory/],
        ['dom_initialization', /DOMPurify|JSDOM|WindowLike|not a valid instance of Window|createDOMPurify/],
        ['layout_failed', /Liquid layout template failed to render/],
        ['sections_failed', /All Liquid sections failed|Liquid main template failed|failed to render and was skipped/],
        ['template_unavailable', /Liquid template .* was not found/],
        ['bundle_unsupported', /bundle schema|validated portable Liquid theme bundle/i],
    ] as const;
    const codes = rules.filter(([, pattern]) => pattern.test(warnings)).map(([code]) => code);
    return { status: result.status, warning_count: result.warnings.length, failure_codes: codes.length ? codes : ['unclassified'] };
}
