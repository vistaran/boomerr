import { api } from "./api-client";

// Utility to call the contact sales API
export async function contactSales({ message, workspace }: { message: string; workspace?: string }) {
    return api.post<{ success: boolean }>("/contact-sales", {
        message,
        workspace,
    });
}
