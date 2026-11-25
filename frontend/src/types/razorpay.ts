export interface RazorpayOptions {
    key: string;
    subscription_id: string;
    name: string;
    description?: string;
    method?: {
        upi?: boolean;
        netbanking?: boolean;
        wallet?: boolean;
        emi?: boolean;
        paylater?: boolean;
        card?: boolean;
    };
    modal?: {
        backdropclose?: boolean;
        escape?: boolean;
        handleback?: boolean;
        confirm_close?: boolean;
        ondismiss?: () => void;
    };
    theme?: {
        color?: string;
        backdrop_color?: string;
    };
    handler?: (response: any) => void;
}

export interface RazorpayInstance {
    open(): void;
    on(event: string, handler: (response: any) => void): void;
}

declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
    }
}
