import { adminApi } from '../../context/admin-auth-context';

export interface EmailTemplate {
  id: number;
  key: string;
  name: string;
  category: string;
  sequence_name?: string | null;
  step_order?: number | null;
  delay_value?: number | null;
  delay_unit?: 'hours' | 'days' | 'weeks' | 'months' | null;
  trigger_event?: string | null;
  trigger_condition?: string | null;
  subject: string;
  description?: string | null;
  body_html: string;
  variables?: string[] | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PreviewPayload {
  subject?: string;
  body_html?: string;
  key?: string;
  name?: string;
  data?: Record<string, any>;
}

export interface PreviewResponse {
  success: boolean;
  subject: string;
  html: string;
  message?: string;
}

export const emailTemplateApi = {
  /**
   * Get all templates with optional filtering (category, is_active, search, sequence)
   */
  getTemplates: async (params: Record<string, any> = {}) => {
    const response = await adminApi.get('/admin/email-templates', { params });
    return response.data;
  },

  /**
   * Get a single template by ID or key string
   */
  getTemplate: async (idOrKey: string | number) => {
    const response = await adminApi.get(`/admin/email-templates/${idOrKey}`);
    return response.data;
  },

  /**
   * Create a new template
   */
  createTemplate: async (data: Partial<EmailTemplate>) => {
    const response = await adminApi.post('/admin/email-templates', data);
    return response.data;
  },

  /**
   * Update an existing template by ID or key
   */
  updateTemplate: async (idOrKey: string | number, data: Partial<EmailTemplate>) => {
    const response = await adminApi.put(`/admin/email-templates/${idOrKey}`, data);
    return response.data;
  },

  /**
   * Toggle template active status quickly
   */
  toggleActive: async (idOrKey: string | number, isActive: boolean) => {
    const response = await adminApi.put(`/admin/email-templates/${idOrKey}`, { is_active: isActive });
    return response.data;
  },

  /**
   * Delete a template
   */
  deleteTemplate: async (idOrKey: string | number) => {
    const response = await adminApi.delete(`/admin/email-templates/${idOrKey}`);
    return response.data;
  },

  /**
   * Render a live preview of the template with sample or draft data
   */
  previewTemplate: async (idOrKey: string | number = 'draft', payload: PreviewPayload = {}): Promise<PreviewResponse> => {
    const response = await adminApi.post(`/admin/email-templates/${idOrKey}/preview`, payload);
    return response.data;
  },

  /**
   * Send a test email of the template to an admin or designated email address
   */
  testSend: async (idOrKey: string | number, email?: string) => {
    const response = await adminApi.post(`/admin/email-templates/${idOrKey}/test-send`, { email });
    return response.data;
  },

  /**
   * Manually trigger/test the lifecycle automation sequence runner
   */
  triggerRun: async (params: { user_id?: number; email?: string } = {}) => {
    const response = await adminApi.post('/admin/email-sequences/trigger-run', params);
    return response.data;
  },
};

export default emailTemplateApi;
