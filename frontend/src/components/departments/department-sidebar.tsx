import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import { CreateDepartmentModal } from "./create-department-modal";
import { useEffect, useState, useMemo } from "react";
import { Plus } from "lucide-react";
import CommonLoader from "../common/common-loader";

type DepartmentSidebarProps = {
    workspaceId: number | null;
    selectedDepartmentId: string | null;
    onSelect: (departmentId: string | null) => void;
    canManage: boolean;
};

function DepartmentSidebar({ workspaceId, selectedDepartmentId, onSelect, canManage }: DepartmentSidebarProps) {
    const { data, isLoading } = useQuery({
        queryKey: ['departments', workspaceId ?? 'none'],
        queryFn: async () => {
            const departments = await api.get('/departments') as any;
            return departments;
        },
        enabled: !!workspaceId,
    });

    const [open, setOpen] = useState(false);

    const departments = useMemo(() => Array.isArray(data) ? data : [], [data]);

    useEffect(() => {
        // If nothing is selected and we have departments, select the first by default
        if (selectedDepartmentId == null && departments.length > 0) {
            onSelect(departments[0].ulid);
            return;
        }
        // If the selected department no longer exists, fall back to the first or clear selection
        if (selectedDepartmentId != null && !departments.some((dep: any) => dep.ulid === selectedDepartmentId)) {
            onSelect(departments.length > 0 ? departments[0].ulid : null);
        }
    }, [departments, selectedDepartmentId, onSelect]);
    return (
        <>
            <div className="flex flex-col bg-gradient-to-br from-slate-900/90 to-slate-900/80 shadow-lg h-full">
                {/* Add Button */}
                <button
                    onClick={() => setOpen(true)}
                    disabled={!workspaceId || !canManage}
                    className={`mx-2 mt-3 mb-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-1 py-2 text-sm font-bold text-white transition ${!workspaceId ? 'opacity-60 cursor-not-allowed' : !canManage ? '!opacity-60 !cursor-not-allowed' : ''}`}
                >
                    <Plus size={18} className="inline mr-1 mb-0.5" />
                    Add Department
                </button>

                {/* List */}
                <div className="flex-1 overflow-y-auto pb-2 pt-1 px-2 border-t border-slate-600">
                    {!workspaceId && (
                        <div className="text-slate-400 text-center py-6">
                            Select a workspace to view departments.
                        </div>
                    )}

                    {workspaceId && isLoading && (
                        <div className="flex justify-center items-start h-full pt-20">
                            <CommonLoader />
                        </div>
                    )}

                    {workspaceId && !isLoading && departments.length === 0 && (
                        <div className="text-slate-400 text-center py-6">
                            No departments yet.
                        </div>
                    )}

                    {workspaceId && !isLoading && departments.map((dep: any) => {
                        const isSelected = selectedDepartmentId === dep.ulid;
                        return (
                            <button
                                key={dep.ulid}
                                onClick={() => {
                                    onSelect(dep.ulid);
                                }}
                                className={
                                    `w-full my-1 px-3 py-2 rounded-lg border text-slate-200 flex items-center transition ` +
                                    (isSelected
                                        ? "border-sky-500 ring-2 ring-sky-400/60 bg-slate-950 z-10"
                                        : "border-slate-800 bg-slate-950/40 hover:border-sky-600")
                                }
                                style={{ position: 'relative', zIndex: isSelected ? 10 : undefined }}
                            >
                                <span className="truncate">{dep.name}</span>

                                <span className="ml-1.5 mt-0.5 text-xs text-slate-400">
                                    ({dep.users_count ?? 0})
                                </span>
                                {/* <span className="flex-1" />
                                <button className="flex bg-slate-600/50 p-1 rounded-lg hover:bg-slate-700/70 transition hover:scale-110">
                                    <PenIcon size={17} className=" text-slate-300 hover:text-slate-200 hover:cursor-pointer  focus:outline-none focus:ring-0" style={{ outline: "none", boxShadow: "none" }} />
                                </button> */}
                            </button>
                        );
                    })}
                </div>
            </div>

            {open && (
                <CreateDepartmentModal
                    workspaceId={workspaceId}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );

}

export default DepartmentSidebar;