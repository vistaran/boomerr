import React, { useState, useEffect, useRef } from 'react';
import { Mail, Monitor, Smartphone, X, Code, Eye, Loader2, AlertCircle } from 'lucide-react';
import emailTemplateApi, { type EmailTemplate } from '../../../services/admin/email-templates';

interface EmailPreviewModalProps {
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  template: Partial<EmailTemplate> | null;
  draftSubject?: string | null;
  draftHtml?: string | null;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  modalOpen,
  setModalOpen,
  template,
  draftSubject = null,
  draftHtml = null,
}) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [viewMode, setViewMode] = useState<'preview' | 'html'>('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState({
    subject: '',
    html: '',
  });

  const modalContent = useRef<HTMLDivElement>(null);

  // Fetch preview when modal opens or template / drafts change
  useEffect(() => {
    if (!modalOpen) return;

    const fetchPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const idOrKey = template?.id || template?.key || 'draft';
        const payload = {
          subject: draftSubject !== null ? draftSubject : template?.subject,
          body_html: draftHtml !== null ? draftHtml : template?.body_html,
          key: template?.key || 'preview_template',
          name: template?.name || 'Preview Template',
          data: {
            firstName: 'Alex',
            domain: { name: 'example.com', url: 'https://example.com' },
          },
        };

        const res = await emailTemplateApi.previewTemplate(idOrKey, payload);
        if (res.success) {
          setPreviewData({
            subject: res.subject,
            html: res.html,
          });
        } else {
          setError(res.message || 'Failed to render preview');
        }
      } catch (err: any) {
        console.error('Error fetching preview:', err);
        setError(err.response?.data?.message || err.message || 'Error rendering template preview');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [modalOpen, template, draftSubject, draftHtml]);

  // Close on Escape key
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (!modalOpen || e.key !== 'Escape') return;
      setModalOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, [modalOpen, setModalOpen]);

  if (!modalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => setModalOpen(false)}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={modalContent}
        className="relative z-10 bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col w-full max-w-5xl h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-[#0d0d0d]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {template?.name || 'Email Preview'}
                </h3>
                {template?.key && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {template.key}
                  </span>
                )}
                {template?.category && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                    {template.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                Subject: <span className="font-semibold text-slate-800 dark:text-slate-200">{previewData.subject || template?.subject || '(No subject)'}</span>
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Device switcher */}
            <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  device === 'desktop'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Desktop viewport (720px)"
              >
                <Monitor className="w-3.5 h-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setDevice('mobile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  device === 'mobile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Mobile viewport (390px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Mobile
              </button>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'preview'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Rendered
              </button>
              <button
                type="button"
                onClick={() => setViewMode('html')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'html'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                HTML Source
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Email Subject Banner */}
        <div className="px-6 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide shrink-0">
            Preview Subject:
          </span>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {previewData.subject || '(None)'}
          </span>
        </div>

        {/* Body content */}
        <div className="flex-1 bg-slate-50 dark:bg-[#050505] overflow-auto flex items-center justify-center p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-600 dark:text-slate-400">
              <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-3" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Rendering Blade template with real components...</span>
            </div>
          ) : error ? (
            <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-6 max-w-lg text-center">
              <div className="w-10 h-10 mx-auto mb-2 text-red-500 flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-red-200 mb-1">Rendering Error</h4>
              <p className="text-xs text-red-400 font-mono break-all">{error}</p>
            </div>
          ) : viewMode === 'html' ? (
            <div className="w-full h-full p-4 bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-auto text-left">
              <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed select-all">
                {previewData.html}
              </pre>
            </div>
          ) : (
            <div
              className={`transition-all duration-300 h-full bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col ${
                device === 'mobile' ? 'w-[390px]' : 'w-full max-w-[720px]'
              }`}
            >
              <iframe
                title="Email Preview Frame"
                srcDoc={previewData.html}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Rendered with standardized Brand Layout (White header, brand typography & unified buttons)</span>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailPreviewModal;
