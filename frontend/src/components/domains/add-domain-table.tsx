import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, FocusEvent } from "react";
import { fetchDomainTitle } from "../../services/api-service";
import { Info, PenIcon, PlusIcon } from "lucide-react";
import { InfoTooltip } from "../common/info-tooltip";

const normalizeClipboardUrl = (value: string): string | null => {
    if (!value) return null;

    const firstToken = value.trim().split(/\s+/)[0]?.replace(/^['"<]+|['">]+$/g, "");
    if (!firstToken) return null;

    let candidate = firstToken;
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(candidate);

    if (!hasProtocol) {
        if (candidate.startsWith("www.")) {
            candidate = `https://${candidate}`;
        } else if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(candidate)) {
            candidate = `https://${candidate}`;
        } else {
            return null;
        }
    }

    try {
        const url = new URL(candidate);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }
        return url.toString();
    } catch {
        return null;
    }
};

export type DomainFormState = {
    name: string;
    url: string;
    label: string;
    environment: string;
    is_active: boolean;
};

type AddDomainModalProps = {
    open: boolean;
    saving: boolean;
    form: DomainFormState;
    setForm: (updater: (prev: DomainFormState) => DomainFormState) => void;
    onClose: () => void;
    onSubmit: (e: FormEvent) => void;
    isEditing?: boolean;
    title?: string;
    submitLabel?: string;
};

export function AddDomainModal({
    open,
    saving,
    form,
    setForm,
    onClose,
    onSubmit,
    title,
    isEditing,
    submitLabel,
}: AddDomainModalProps) {
    const clipboardCheckedRef = useRef(false);
    const urlInputRef = useRef<HTMLInputElement | null>(null);
    const [titleLoading, setTitleLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

    const clearError = (field: "name" | "url") => {
        setErrors((e) => {
            if (!e[field]) return e;
            const copy = { ...e };
            delete copy[field];
            return copy;
        });
    };

    const validateForm = (): { name?: string; url?: string } => {
        const errs: { name?: string; url?: string } = {};

        const urlTrim = form.url.trim();
        if (urlTrim.length === 0) {
            errs.url = "URL is required.";
        } else if (!normalizeClipboardUrl(urlTrim)) {
            errs.url = "Please enter a valid URL (e.g. https://example.com).";
        }

        const nameTrim = form.name.trim();
        if (nameTrim.length === 0) {
            errs.name = "Domain Name is required.";
        } else if (nameTrim.length < 2) {
            errs.name = "Domain name must be at least 2 characters.";
        }

        return errs;
    };

    useEffect(() => {
        if (!open) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [open, onClose]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const errs = validateForm();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        const normalized = normalizeClipboardUrl(form.url.trim());
        if (normalized && normalized !== form.url) {
            setForm((prev) => ({ ...prev, url: normalized }));
            setTimeout(() => onSubmit(e), 0);
            return;
        }

        onSubmit(e);
    };

    // Helper to generate a label from a URL
    const labelFromUrl = (url: string): string => {
        try {
            const { hostname } = new URL(url);
            // Remove www. and split by .
            const parts = hostname.replace(/^www\./, "").split(".");
            // Use the first part as label, capitalize
            if (parts.length > 0 && parts[0]) {
                return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            }
        } catch {
            console.error("Failed to parse URL for label:", url);
        }
        return "";
    };

    const fetchTitleAndUpdate = useCallback(async (rawUrl: string) => {
        const url = rawUrl.trim();
        if (!url) return;

        setTitleLoading(true);
        try {
            const result = await fetchDomainTitle(url);
            const title = result.title?.trim();

            setForm((prev) => {
                const updated = { ...prev };
                // Auto-fill name if empty
                if (title && updated.name.trim().length === 0) {
                    updated.name = title;
                }
                // Auto-fill label if empty
                if (updated.label.trim().length === 0) {
                    const label = labelFromUrl(url);
                    if (label) updated.label = label;
                }
                return updated;
            });
        } catch (err) {
            console.error("Failed to fetch domain title", err);
        } finally {
            setTitleLoading(false);
        }
    }, [setForm]);

    useEffect(() => {
        if (!open) {
            clipboardCheckedRef.current = false;
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handle = setTimeout(() => {
            urlInputRef.current?.focus();
            urlInputRef.current?.select();
        }, 0);

        return () => clearTimeout(handle);
    }, [open]);

    useEffect(() => {
        if (!open || clipboardCheckedRef.current) return;

        const currentUrl = form.url.trim();
        if (currentUrl.length > 0) {
            clipboardCheckedRef.current = true;
            return;
        }

        if (typeof navigator === "undefined" || !navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
            clipboardCheckedRef.current = true;
            return;
        }

        clipboardCheckedRef.current = true;

        const fillFromClipboard = async () => {
            try {
                const clipboardText = await navigator.clipboard.readText();
                const normalized = normalizeClipboardUrl(clipboardText);
                if (!normalized) return;

                let urlApplied = false;

                setForm((prev) => {
                    if (prev.url.trim().length > 0) {
                        return prev;
                    }
                    urlApplied = true;
                    return { ...prev, url: normalized };
                });

                if (urlInputRef.current) {
                    setTimeout(() => {
                        urlInputRef.current?.focus();
                        urlInputRef.current?.select();
                    }, 0);
                }

                if (urlApplied) {
                    await fetchTitleAndUpdate(normalized);
                }
            } catch {
                console.warn("Failed to read from clipboard");
            }
        };

        void fillFromClipboard();
    }, [open, form.url, fetchTitleAndUpdate, setForm]);

    if (!open) return null;

    const modalTitle = title ?? "Add Domain";
    const actionLabel = submitLabel ?? "Add Domain";
    const isNameAutofilling = titleLoading && form.name.trim().length === 0;
    // const nameInputValue = isNameAutofilling ? "Fetching title..." : form.name;

    const handleUrlBlur = async (e: FocusEvent<HTMLInputElement>) => {
        const raw = e.target.value.trim();
        if (!raw) return;

        if (form.name && form.name.trim().length > 0) return;

        const normalized = normalizeClipboardUrl(raw);
        if (!normalized) return;

        await fetchTitleAndUpdate(normalized);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in p-2">
            <div className="w-full max-w-md rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/95 p-4 sm:p-6 shadow-2xl backdrop-blur max-h-[90vh] overflow-y-auto">
                <div className="mb-4 flex items-center justify-between gap-2 flex-shrink-0">
                    <h2 className="text-base sm:text-lg font-semibold text-slate-100 flex items-center gap-2 truncate">
                        {isEditing ?
                            <PenIcon className="h-4 w-4 sm:h-5 sm:w-5 font-bold flex-shrink-0" /> :
                            <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 font-bold flex-shrink-0" />
                        }
                        <span className="truncate">{modalTitle}</span>
                    </h2>
                    <button
                        className="text-slate-400 hover:text-slate-100 hover:cursor-pointer !outline-none flex-shrink-0"
                        onClick={() => !saving && onClose()}
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div>
                        <label className="mb-1 block flex items-center text-sm font-medium text-slate-300">
                            URL <span className="text-red-500 ml-1">*</span>
                            <InfoTooltip text="The URL of the domain to be monitored.">
                                <Info className="w-3 h-3 ml-1 text-slate-400 cursor-pointer" />
                            </InfoTooltip>
                        </label>
                        <input
                            type="url"
                            placeholder="https://example.com"
                            value={form.url}
                            onChange={(e) => {
                                clearError("url");
                                setForm((f) => ({ ...f, url: e.target.value }));
                            }}
                            onBlur={handleUrlBlur}
                            ref={urlInputRef}
                            aria-invalid={Boolean(errors.url)}
                            aria-describedby={errors.url ? "url-error" : undefined}
                            className={`w-full rounded-lg border ${errors.url ? "border-red-500" : "border-slate-700"} bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500`}
                            required
                        />
                        {errors.url && (
                            <p id="url-error" className="mt-1 text-xs text-red-400">{errors.url}</p>
                        )}
                    </div>
                    <div className="relative">
                        <label className="mb-1 block flex items-center text-sm font-medium text-slate-300 relative">
                            Domain Name <span className="text-red-500 ml-1">*</span>
                            <InfoTooltip text="A friendly name for the domain. This can be auto-filled from the domain's title.">
                                <Info className="w-3 h-3 ml-1 text-slate-400 cursor-pointer" />
                            </InfoTooltip>
                            {isNameAutofilling && (
                                <span className="ml-1 flex items-center">
                                    <span className="relative flex h-5 w-5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60"></span>
                                        <div className="loader"></div>
                                    </span>
                                </span>
                            )}
                        </label>
                        <input
                            type="text"
                            placeholder="example.com"
                            value={form.name}
                            onChange={(e) => {
                                clearError("name");
                                setForm((f) => ({ ...f, name: e.target.value }));
                            }}
                            min={2}
                            readOnly={isNameAutofilling}
                            aria-busy={isNameAutofilling}
                            aria-invalid={Boolean(errors.name)}
                            aria-describedby={errors.name ? "name-error" : undefined}
                            className={`w-full rounded-lg border ${errors.name ? "border-red-500" : "border-slate-700"} bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500`}
                            required
                        />

                        {errors.name && (
                            <p id="name-error" className="mt-1 text-xs text-red-500">{errors.name}</p>
                        )}
                    </div>



                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-300">
                            Label (optional)
                            <InfoTooltip text="An optional label for the domain.">
                                <Info className="w-3 h-3 ml-1 text-slate-400 cursor-pointer" />
                            </InfoTooltip>
                        </label>
                        <input
                            type="text"
                            placeholder="Marketing site, Landing page…"
                            value={form.label}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, label: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-300">
                            Environment
                            <InfoTooltip text="The environment this domain is associated with.">
                                <Info className="w-3 h-3 ml-1 text-slate-400 cursor-pointer" />
                            </InfoTooltip>
                        </label>
                        <select
                            value={form.environment}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, environment: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        >
                            <option value="production">Production</option>
                            <option value="staging">Staging</option>
                            <option value="development">Development</option>
                            <option value="sit">SIT</option>
                            <option value="uat">UAT</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={form.is_active}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, is_active: e.target.checked }))
                            }
                            className="h-5 w-5 rounded border-slate-700 bg-slate-950/60 text-sky-500 focus:ring-sky-500 cursor-pointer"
                        />
                        <label htmlFor="is_active" className="text-sm text-slate-300 cursor-pointer font-medium">
                            Active
                            <InfoTooltip text="Whether the domain is currently active and being monitored.">
                                <Info className="w-3 h-3 ml-1 text-slate-400 cursor-pointer inline-block" />
                            </InfoTooltip>
                        </label>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={onClose}
                            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800/80 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
                        >
                            {saving ? `${actionLabel}…` : actionLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
