import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { Department } from '../realtime/department';

export function useDepartments(workspaceId?: number | null) {
    return useQuery({
        queryKey: ['departments', workspaceId ?? 'none'],
        queryFn: async () => {
            const departments = await api.get('/departments') as Department[];
            return departments;
        },
        enabled: !!workspaceId,
    });
}

export function useDepartmentUsers(departmentId: string, workspaceId?: number | null) {
    return useQuery({
        queryKey: ['department-users', workspaceId ?? 'none', departmentId],
        queryFn: async () => {
            const users = await api.get(`/departments/${departmentId}/users`);
            return users;
        },
        enabled: !!departmentId && !!workspaceId,
    });
}

export function useDepartmentPendingInvitations(departmentId: string, workspaceId?: number | null) {
    return useQuery({
        queryKey: ['department-pending-invitations', workspaceId ?? 'none', departmentId],
        queryFn: async () => {
            const response = await api.get<{ data: any }>(`/departments/${departmentId}/pending-invitations`);
            return response.data;
        },
        enabled: !!departmentId && !!workspaceId,
    });
}