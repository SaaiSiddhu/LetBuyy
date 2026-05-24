'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Input({ label, helperText, error, leftIcon, rightIcon, className = '', id, ...props }) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [label && (_jsx("label", { htmlFor: inputId, className: "text-sm font-medium text-foreground", children: label })), _jsxs("div", { className: "relative", children: [leftIcon && (_jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground", children: leftIcon })), _jsx("input", { id: inputId, className: [
                            'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm',
                            'transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium',
                            'placeholder:text-muted-foreground',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            error ? 'border-red-500 focus-visible:ring-red-500' : 'border-input',
                            leftIcon ? 'pl-10' : '',
                            rightIcon ? 'pr-10' : '',
                            className,
                        ].filter(Boolean).join(' '), ...props }), rightIcon && (_jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground", children: rightIcon }))] }), error && _jsx("p", { className: "text-xs text-red-500", children: error }), helperText && !error && _jsx("p", { className: "text-xs text-muted-foreground", children: helperText })] }));
}
export function Textarea({ label, helperText, error, className = '', id, ...props }) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [label && (_jsx("label", { htmlFor: inputId, className: "text-sm font-medium text-foreground", children: label })), _jsx("textarea", { id: inputId, className: [
                    'flex min-h-[80px] w-full rounded-lg border bg-background px-3 py-2 text-sm',
                    'transition-colors placeholder:text-muted-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    error ? 'border-red-500 focus-visible:ring-red-500' : 'border-input',
                    className,
                ].filter(Boolean).join(' '), ...props }), error && _jsx("p", { className: "text-xs text-red-500", children: error }), helperText && !error && _jsx("p", { className: "text-xs text-muted-foreground", children: helperText })] }));
}
//# sourceMappingURL=input.js.map