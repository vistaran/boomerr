import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/query-keys';
import {
  fetchAuditLogs,
  type AuditLogFilters,
  type AuditLogPaginatedResponse,
  type AuditLogEntry,
} from '../services/audit-logs-service';

export type { AuditLogEntry, AuditLogFilters, AuditLogPaginatedResponse };

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(filters),
    queryFn: () => fetchAuditLogs(filters),
  });
}
