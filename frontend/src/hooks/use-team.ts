import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/api-client';
import { queryKeys } from '../api/query-keys';
import toast from 'react-hot-toast';
import type { WorkspaceSummary } from '../services/api-service';
import type { User } from '../types/user';

// Types

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  contact_email?: string | null;
  role: 'owner' | 'admin' | 'member';
};

export type PendingInvitation = {
  ulid: string;
  email: string;
  role: string;
};

export type InvitationDetails = {
  email: string;
  role: string;
};

export type SendInvitationPayload = {
  email: string;
  role: string;
  isFromDepartment?: boolean;
  department_id?: string;
};

export type AcceptInvitationPayload = {
  name: string;
  password: string;
  password_confirmation: string;
};

type TeamMembersResponse = {
  data: TeamMember[];
};

// Queries

// Hook to fetch all team members.

export function useTeamMembers() {
  return useQuery({
    queryKey: queryKeys.team.members(),
    queryFn: async () => {
      const response = await api.get<TeamMembersResponse>('/team/members');
      return response.data ?? [];
    },
  });
}

// Hook to fetch pending team invitations.

export function usePendingInvitations() {
  return useQuery({
    queryKey: queryKeys.team.invitations.pending(),
    queryFn: async () => {
      return api.get<PendingInvitation[]>('/team-invitations');
    },
  });
}

// Hook to fetch invitation details by token.
// Used on the accept invitation page.
export function useInvitationDetails(token: string) {
  return useQuery({
    queryKey: queryKeys.team.invitations.detail(token),
    queryFn: async () => {
      const response = await api.get<{ data: InvitationDetails }>(
        `/team-invitations/lookup/${token}`
      );
      return response.data;
    },
    enabled: !!token,
    // Don't cache invitation lookups
    staleTime: 0,
    gcTime: 0,
  });
}

// Mutations

// Hook to send a team invitation.

export function useSendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendInvitationPayload) => {
      await api.post('/team-invitations', payload);
      return payload;
    },
    onSuccess: (payload) => {
      // Optimistically add to pending invitations
      queryClient.setQueryData<PendingInvitation[]>(
        queryKeys.team.invitations.pending(),
        (old) => {
          if (!old) return old;
          // Add a temporary entry (will be replaced on refetch)
            return [...old, { ulid: `temp-${Date.now()}`, email: payload.email, role: payload.role }];
        }
      );

      // Refetch to get the real ID
      queryClient.invalidateQueries({ queryKey: queryKeys.team.invitations.pending() });

      toast.success(`Invitation sent to ${payload.email}`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to send invitation';
      toast.error(message);
    },
  });
}

// Hook to accept a team invitation.

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async ({
      token,
      payload,
    }: {
      token: string;
      payload: AcceptInvitationPayload;
    }) => {
      return api.post<{ token?: string; user?: User; workspaces?: WorkspaceSummary[] }>(
        `/team-invitations/accept/${token}`,
        payload
      );
    },
    onSuccess: () => {
      toast.success('Invitation accepted successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to accept invitation';
      toast.error(message);
    },
  });
}

// Hook to remove a team member.

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: number) => {
      await api.delete(`/team/members/${memberId}`);
      return memberId;
    },
    onMutate: async (memberId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.team.members() });

      const previousMembers = queryClient.getQueryData<TeamMember[]>(queryKeys.team.members());

      // Optimistically remove
      queryClient.setQueryData<TeamMember[]>(queryKeys.team.members(), (old) => {
        if (!old) return old;
        return old.filter((member) => member.id !== memberId);
      });

      return { previousMembers };
    },
    onSuccess: () => {
      toast.success('Team member removed');
    },
    onError: (error, _memberId, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(queryKeys.team.members(), context.previousMembers);
      }

      const message = error instanceof Error ? error.message : 'Failed to remove team member';
      toast.error(message);
    },
  });
}
