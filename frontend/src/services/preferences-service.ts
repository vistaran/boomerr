import { api } from "../api";

export interface EmailPreferences {
	receives_onboarding_emails: boolean;
	receives_product_updates: boolean;
	receives_newsletters: boolean;
	receives_promotional_emails: boolean;
}

export const getEmailPreferences = async (): Promise<EmailPreferences> => {
	return api.get<EmailPreferences>("/user/email-preferences");
};

export const updateEmailPreferences = async (preferences: EmailPreferences): Promise<{ message: string; preferences: EmailPreferences }> => {
	return api.put<{ message: string; preferences: EmailPreferences }>("/user/email-preferences", preferences);
};
