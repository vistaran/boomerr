import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { api } from "../../api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function CreateDepartmentModal({ workspaceId, onClose }: { workspaceId: number | null; onClose: () => void }) {
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!open) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createDepartment = useMutation({
        mutationFn: (data: { name: string }) => api.post("/departments", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["departments", workspaceId ?? 'none'] });
            onClose();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Department name is required.");
            return;
        }
        createDepartment.mutate({ name: trimmed });
    };

    return (
        <Modal title="Create Department" onClose={onClose} width="sm">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-1">
                    <label className="text-sm text-slate-200">
                        Department name <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setError(null);
                        }}
                        placeholder="Department name"
                        className={`w-full rounded-lg border ${error ? 'border-red-500' : 'border-slate-700'} bg-slate-800 px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500`}
                    />
                    {error && (
                        <p className="mt-1 text-xs text-red-500">{error}</p>
                    )}
                </div>

                <div className="flex text-white justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-2 rounded-md text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={createDepartment.isPending}
                        className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {createDepartment.isPending ? "Creating..." : "Create"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
