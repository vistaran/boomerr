import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/query-keys';
import {
  fetchSystemLogs,
  type SystemLogFilters,
  type SystemLogPaginatedResponse,
  type SystemLogEntry,
} from '../services/logs-service';

export type { SystemLogEntry, SystemLogFilters, SystemLogPaginatedResponse };

export function useSystemLogs(filters: SystemLogFilters) {
  return useQuery({
    queryKey: queryKeys.systemLogs.list(filters),
    queryFn: () => fetchSystemLogs(filters),
  });
}
