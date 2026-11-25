import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, ExternalLink, Globe } from 'lucide-react';

import { apiFetch } from '../services/api-service';
import toast from 'react-hot-toast';
import { StatusPageEditModal } from '../components/status-pages/status-page-edit-modal';
import { ConfirmModal } from '../components/common/confirm-modal';
import ResponsiveTable, { TableCell } from '../components/common/responsive-table';

interface StatusPage {
  ulid: string;
  name: string;
  slug: string;
  is_published: boolean;
  domains_count: number;
}

export default function StatusPagesList() {
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPageUlid, setEditingPageUlid] = useState<string | null>(null);
  const [deletingPageUlid, setDeletingPageUlid] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['statusPages'],
    queryFn: async () => {
      return await apiFetch<{ statusPages: StatusPage[], canAdd: boolean }>('/status-pages');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ulid: string) => {
      await apiFetch(`/status-pages/${ulid}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Status page deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['statusPages'] });
    },
    onError: () => {
      toast.error('Failed to delete status page');
    },
  });

  const handleDelete = (ulid: string) => {
    setDeletingPageUlid(ulid);
  };

  const openCreateModal = () => {
    if (data && !data.canAdd) {
      toast.error('You have reached the maximum number of status pages allowed on your current plan. Please upgrade to add more.');
      return;
    }
    setEditingPageUlid(null);
    setIsEditModalOpen(true);
  };

  const openEditModal = (ulid: string) => {
    setEditingPageUlid(ulid);
    setIsEditModalOpen(true);
  };

  const statusPages = data?.statusPages || [];

  return (
    <div className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
      <div className="max-w-full mx-auto">
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3 text-slate-50">
              <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 p-2 sm:p-2.5 shadow-lg shadow-indigo-500/20">
                <Globe size={20} className="sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="truncate">Status Pages</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Create and manage public status pages to share your system uptime with your customers.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Status Page
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : statusPages.length === 0 ? (
          <div className="text-center bg-slate-900/50 rounded-lg border border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
            <h3 className="mt-2 text-sm font-medium text-slate-200">No status pages</h3>
            <p className="mt-1 text-sm text-slate-400">
              Get started by creating a new status page.
            </p>
            <div className="mt-6">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Status Page
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg sm:rounded-xl md:border md:border-slate-800 md:bg-slate-900/80 backdrop-blur md:shadow-xl">
            <ResponsiveTable className="md:border md:border-slate-800 rounded-xl">
              <table className="min-w-full text-left text-xs sm:text-sm text-slate-200">
                <thead className="bg-slate-900 md:border-b md:border-slate-800 sticky top-0 rounded-t-xl">
                  <tr>
                    <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm rounded-l-lg">Page Details</th>
                    <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Status</th>
                    <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm hidden sm:table-cell">Monitors</th>
                    <th className="py-2 sm:py-3 px-2 sm:px-4 text-right font-semibold text-xs sm:text-sm flex-shrink-0 rounded-r-lg"></th>
                  </tr>
                </thead>
                <tbody>
                  {statusPages.map((page) => (
                    <tr
                      key={page.ulid}
                      className="group relative border-b last:border-none border-slate-800 transition hover:bg-slate-800/50 text-xs sm:text-sm bg-slate-700/30 md:bg-transparent"
                    >
                      <TableCell label="Page Details" className="py-3 sm:py-4 px-2 sm:px-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-100 truncate text-xs sm:text-sm">{page.name}</p>
                          <p className="text-xs text-slate-500 truncate hidden sm:block">/{page.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell label="Status" className="py-3 sm:py-4 px-2 sm:px-4">
                        {page.is_published ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 sm:px-3 py-0.5 sm:py-1 text-emerald-300 text-xs font-semibold w-fit">
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 sm:px-3 py-0.5 sm:py-1 text-slate-300 text-xs font-semibold w-fit">
                            Draft
                          </span>
                        )}
                      </TableCell>
                      <TableCell label="Monitors" className="py-3 sm:py-4 px-2 sm:px-4 text-xs hidden sm:table-cell">
                        {page.domains_count} Monitors
                      </TableCell>
                      <TableCell label="" className="py-3 sm:py-4 px-2 sm:px-4 text-right flex-shrink-0">
                        <div className="flex items-center justify-end gap-1">
                          {page.is_published && (
                            <a
                              href={`/status/${page.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1 text-slate-400 text-xs font-medium transition min-h-[40px] min-w-[40px] rounded-lg hover:bg-slate-800/50 hover:text-indigo-400 opacity-70 hover:opacity-100"
                              title="View Public Page"
                            >
                              <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                            </a>
                          )}
                          <button
                            onClick={() => openEditModal(page.ulid)}
                            className="inline-flex items-center justify-center gap-1 text-slate-400 text-xs font-medium transition min-h-[40px] min-w-[40px] rounded-lg hover:bg-slate-800/50 hover:text-indigo-400 opacity-70 hover:opacity-100"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(page.ulid)}
                            className="inline-flex items-center justify-center gap-1 text-slate-400 text-xs font-medium transition min-h-[40px] min-w-[40px] rounded-lg hover:bg-slate-800/50 hover:text-red-400 opacity-70 hover:opacity-100"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>
        )}

        <StatusPageEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          ulid={editingPageUlid}
        />
        <ConfirmModal
          open={!!deletingPageUlid}
          title="Delete Status Page"
          description={<>This will permanently delete the status page <span className="font-semibold text-slate-100">{statusPages.find(p => p.ulid === deletingPageUlid)?.name}</span>. This action cannot be undone.</>}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirming={(deleteMutation as any).isPending || (deleteMutation as any).isLoading}
          onCancel={() => setDeletingPageUlid(null)}
          onConfirm={() => {
            if (deletingPageUlid) {
              deleteMutation.mutate(deletingPageUlid, {
                onSettled: () => setDeletingPageUlid(null)
              });
            }
          }}
          tone="danger"
        />
      </div>
    </div>
  );
}
