'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

// ============================================================
// CHECKOUT CONTEXT — session-only state (no persistence)
// Used exclusively in theme-preview mode with mock data
// ============================================================

export interface ContactInfo {
    email: string;
    name: string;
    phone: string;
}

export interface AddressInfo {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
    saveAddress: boolean;
}

export type ShippingMethodId = 'standard' | 'express' | 'free';
export type PaymentMethodId = 'razorpay' | 'cod';

export interface CheckoutState {
    step: 1 | 2 | 3;
    contact: ContactInfo;
    address: AddressInfo;
    shippingMethod: ShippingMethodId | null;
    paymentMethod: PaymentMethodId | null;
    orderId: string | null;
    orderDate: string | null;
}

interface CheckoutContextType extends CheckoutState {
    setStep: (step: 1 | 2 | 3) => void;
    setContact: (contact: ContactInfo) => void;
    setAddress: (address: AddressInfo) => void;
    setShippingMethod: (method: ShippingMethodId) => void;
    setPaymentMethod: (method: PaymentMethodId) => void;
    placeOrder: () => string;   // returns generated order ID
    resetCheckout: () => void;
}

const INITIAL_STATE: CheckoutState = {
    step: 1,
    contact: { email: '', name: '', phone: '' },
    address: {
        line1: '', line2: '', city: '', state: '',
        pinCode: '', country: 'India', saveAddress: false,
    },
    shippingMethod: null,
    paymentMethod: null,
    orderId: null,
    orderDate: null,
};

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

function generateOrderId(): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${year}-${seq}`;
}

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<CheckoutState>(INITIAL_STATE);

    const setStep = useCallback((step: 1 | 2 | 3) => {
        setState(prev => ({ ...prev, step }));
    }, []);

    const setContact = useCallback((contact: ContactInfo) => {
        setState(prev => ({ ...prev, contact }));
    }, []);

    const setAddress = useCallback((address: AddressInfo) => {
        setState(prev => ({ ...prev, address }));
    }, []);

    const setShippingMethod = useCallback((method: ShippingMethodId) => {
        setState(prev => ({ ...prev, shippingMethod: method }));
    }, []);

    const setPaymentMethod = useCallback((method: PaymentMethodId) => {
        setState(prev => ({ ...prev, paymentMethod: method }));
    }, []);

    const placeOrder = useCallback(() => {
        const orderId = generateOrderId();
        const orderDate = new Date().toISOString();
        setState(prev => ({ ...prev, orderId, orderDate }));
        return orderId;
    }, []);

    const resetCheckout = useCallback(() => {
        setState(INITIAL_STATE);
    }, []);

    return (
        <CheckoutContext.Provider
            value={{
                ...state,
                setStep,
                setContact,
                setAddress,
                setShippingMethod,
                setPaymentMethod,
                placeOrder,
                resetCheckout,
            }}
        >
            {children}
        </CheckoutContext.Provider>
    );
}

export const useCheckout = () => {
    const context = useContext(CheckoutContext);
    if (!context) throw new Error('useCheckout must be used within CheckoutProvider');
    return context;
};
