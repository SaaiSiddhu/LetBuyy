import React from 'react';
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    helperText?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}
export declare function Input({ label, helperText, error, leftIcon, rightIcon, className, id, ...props }: InputProps): import("react/jsx-runtime").JSX.Element;
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    helperText?: string;
    error?: string;
}
export declare function Textarea({ label, helperText, error, className, id, ...props }: TextareaProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=input.d.ts.map