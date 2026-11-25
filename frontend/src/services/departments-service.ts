import { api } from "../api";

export const resendTeamInvite = async (id: string) => {
    try {
        const response = await api.post<any>(`/invitations/${id}/resend`);
        return response;
    } catch (error) {
        console.error("Error resending invite:", error);
        throw error;
    }
};

export const cancelTeamInvite = async (id: string) => {
    try {
        const response = await api.delete<any>(`/invitations/${id}`);
        return response;
    } catch (error) {
        console.error("Error canceling invite:", error);
        throw error;
    }
};
