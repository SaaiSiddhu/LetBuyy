'use client';

import React, { createContext, useContext, useEffect, useId } from 'react';

/** Presentation-level work protection. Applications retain routing and save authority. */
export interface FormProtection {
    dirty: boolean;
    saving?: boolean;
    onSave?: () => void | Promise<void>;
    onDiscard?: () => void;
    canSave?: boolean;
    canDiscard?: boolean;
}

export type RegisterFormProtection = (id: string, form: FormProtection | null) => void;
const FormProtectionContext = createContext<RegisterFormProtection | null>(null);

export function FormProtectionProvider({ register, children }: { register: RegisterFormProtection; children: React.ReactNode }) {
    return <FormProtectionContext.Provider value={register}>{children}</FormProtectionContext.Provider>;
}

/** Protect an editor even while its visual SaveBar is unavailable. Persists no field data. */
export function useFormProtection(form: FormProtection | null) {
    const register = useContext(FormProtectionContext);
    const id = useId();
    useEffect(() => { register?.(id, form); });
    useEffect(() => () => register?.(id, null), [id, register]);
}
