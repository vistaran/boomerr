import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiFetch } from '../../services/api-service';
import toast from 'react-hot-toast';

interface Domain {
  id: number;
  url: string;
  name: string;
  status?: 'unknown' | 'up' | 'down';
}

interface StatusPageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  ulid: string | null;
}

export function StatusPageEditModal({ isOpen, onClose, ulid }: StatusPageEditModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [selectedDomains, setSelectedDomains] = useState<number[]>([]);
  const [hoveredDomain, setHoveredDomain] = useState<{
    name: string;
    url?: string;
    status?: string;
    x: number;
    y: number;
    isAbove: boolean;
  } | null>(null);

  const handleDomainMouseEnter = (e: React.MouseEvent<HTMLElement>, domain: Domain) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isAbove = rect.top >= 130;
    const clampedX = Math.max(160, Math.min(rect.left + rect.width / 2, window.innerWidth - 160));
    setHoveredDomain({
      name: domain.name || domain.url,
      url: domain.url,
      status: domain.status,
      x: clampedX,
      y: isAbove ? rect.top - 8 : rect.bottom + 8,
      isAbove,
    });
  };

  const handleDomainMouseLeave = () => {
    setHoveredDomain(null);
  };

  // Fetch domains for the workspace
  const { data: domains = [] } = useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      const response = await apiFetch<any>('/domains');
      return response.data as Domain[];
    },
    enabled: isOpen,
  });

  // Fetch status page details if editing
  useQuery({
    queryKey: ['statusPage', ulid],
    queryFn: async () => {
      const data = await apiFetch<any>(`/status-pages/${ulid}`);
      setName(data.name);
      setSlug(data.slug);
      setIsPublished(data.is_published);
      setSelectedDomains(data.domains?.map((d: any) => d.id) || []);
      return data;
    },
    enabled: isOpen && !!ulid,
  });

  // Reset form when opened for creation
  useEffect(() => {
    if (isOpen && !ulid) {
      setName('');
      setSlug('');
      setIsPublished(true);
      setSelectedDomains([]);
    }
  }, [isOpen, ulid]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (ulid) {
        return apiFetch(`/status-pages/${ulid}`, { method: 'PUT', body: JSON.stringify(data) });
      }
      return apiFetch('/status-pages', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: () => {
      toast.success(ulid ? 'Status page updated' : 'Status page created');
      queryClient.invalidateQueries({ queryKey: ['statusPages'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save status page');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      toast.error('Please fill in all required fields');
      return;
    }
    saveMutation.mutate({
      name,
      slug,
      is_published: isPublished,
      domains: selectedDomains,
    });
  };

  const toggleDomain = (domainId: number) => {
    setSelectedDomains(prev =>
      prev.includes(domainId)
        ? prev.filter(id => id !== domainId)
        : [...prev, domainId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
        </div>

        <div className="relative z-10 inline-block align-bottom bg-slate-900 border border-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="bg-slate-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg leading-6 font-medium text-slate-100">
                {ulid ? 'Edit Status Page' : 'Create Status Page'}
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                  Page Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!ulid && !slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                    }
                  }}
                  className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="e.g. Acme Corp Status"
                />
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-slate-300">
                  URL Slug *
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 py-2 rounded-l-md border border-slate-700 bg-slate-900 text-slate-300 sm:text-sm">
                    {window.location.origin}/status/
                  </span>
                  <input
                    type="text"
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 min-w-0 block w-full px-3 py-2 bg-slate-800 border border-slate-700 border-l-0 text-slate-100 rounded-none rounded-r-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="acme-corp"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="is_published"
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800 rounded"
                />
                <label htmlFor="is_published" className="ml-2 block text-sm text-slate-200">
                  Publish to public (visible to everyone)
                </label>
              </div>

              <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Select Monitors to Display
                  </label>
                  {domains.length > 0 && (
                    <span className="text-xs text-slate-400">
                      {selectedDomains.length} of {domains.length} selected
                    </span>
                  )}
                </div>
                {domains.length === 0 ? (
                  <p className="text-sm text-slate-400">No monitors available. Please add some domains first.</p>
                ) : (
                  <div
                    onScroll={() => setHoveredDomain(null)}
                    className="max-h-48 overflow-y-auto border border-slate-700 bg-slate-800/50 rounded-md p-1.5 space-y-1"
                  >
                    {domains.map(domain => {
                      const displayName = domain.name || domain.url;
                      const isChecked = selectedDomains.includes(domain.id);
                      return (
                        <div
                          key={domain.id}
                          onClick={() => toggleDomain(domain.id)}
                          onMouseEnter={(e) => handleDomainMouseEnter(e, domain)}
                          onMouseLeave={handleDomainMouseLeave}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer group select-none ${isChecked ? 'bg-indigo-950/40 hover:bg-indigo-950/60' : 'hover:bg-slate-700/40'
                            }`}
                        >
                          <input
                            type="checkbox"
                            id={`domain-${domain.id}`}
                            checked={isChecked}
                            onChange={() => { }} // Handled by row onClick
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-600 bg-slate-900 rounded flex-shrink-0 cursor-pointer"
                          />
                          <label
                            htmlFor={`domain-${domain.id}`}
                            className="block text-sm text-slate-200 truncate cursor-pointer flex-1 min-w-0 font-medium group-hover:text-white transition-colors"
                          >
                            {displayName}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </form>
          </div>
          <div className="bg-slate-800/50 border-t border-slate-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-700 shadow-sm px-4 py-2 bg-slate-800 text-base font-medium text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Floating Tooltip */}
      {hoveredDomain && (
        <div
          className={`fixed z-[99999] pointer-events-none -translate-x-1/2 max-w-sm sm:max-w-md px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700/90 shadow-2xl backdrop-blur-md text-xs transition-opacity duration-150 ${hoveredDomain.isAbove ? '-translate-y-full' : ''
            }`}
          style={{
            left: `${hoveredDomain.x}px`,
            top: `${hoveredDomain.y}px`,
          }}
        >
          <div className="font-semibold text-slate-100 break-words leading-snug">
            {hoveredDomain.name}
          </div>
          {hoveredDomain.url && hoveredDomain.url !== hoveredDomain.name && (
            <div className="text-slate-400 text-[11px] truncate mt-0.5 font-mono">
              {hoveredDomain.url}
            </div>
          )}
          {hoveredDomain.status && (
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-800 text-[11px]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${hoveredDomain.status === 'up'
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
                  : hoveredDomain.status === 'down'
                    ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                    : 'bg-slate-400'
                  }`}
              />
              <span className="capitalize text-slate-300">
                {hoveredDomain.status === 'up'
                  ? 'Online'
                  : hoveredDomain.status === 'down'
                    ? 'Down'
                    : 'Unknown Status'}
              </span>
            </div>
          )}
          {/* Tooltip arrow pointer */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-slate-700/90 rotate-45 ${hoveredDomain.isAbove
              ? '-bottom-1 border-r border-b'
              : '-top-1 border-l border-t'
              }`}
          />
        </div>
      )}
    </div>
  );
}
