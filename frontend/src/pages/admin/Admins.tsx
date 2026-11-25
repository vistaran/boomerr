import React, { useEffect, useState } from "react";
import { adminApi, useAdminAuth } from "../../context/admin-auth-context";
import { Search, Mail, Shield, Plus, X, Edit2, Trash2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export const AdminAdmins = () => {
  const [admins, setAdmins] = useState<any[]>([]);
  const navigate = useNavigate();
  const { admin: currentAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({ name: "", email: "", password: "" });
  const [createErrors, setCreateErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editAdminId, setEditAdminId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({ name: "", email: "", password: "" });
  const [editErrors, setEditErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete Dialog State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get("/api/admin/admins");
      setAdmins(response.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; email?: string; password?: string } = {};

    if (!createFormData.name.trim()) {
      errors.name = "Full name is required";
    }
    if (!createFormData.email.trim()) {
      errors.email = "Email address is required";
    } else if (!validateEmail(createFormData.email)) {
      errors.email = "Please enter a valid email address (e.g. user@company.com)";
    }
    if (!createFormData.password) {
      errors.password = "Password is required";
    } else if (createFormData.password.length < 8) {
      errors.password = "Password must be at least 8 characters long";
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setCreateErrors({});
    try {
      setCreateSubmitting(true);
      await adminApi.post("/api/admin/admins", createFormData);
      toast.success("Admin created successfully!");
      setIsCreateModalOpen(false);
      setCreateFormData({ name: "", email: "", password: "" });
      fetchAdmins();
    } catch (err: any) {
      const serverMsg = err.response?.data?.message;
      if (serverMsg && serverMsg.toLowerCase().includes("email")) {
        setCreateErrors({ email: serverMsg });
      } else {
        toast.error(serverMsg || "Failed to create admin");
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenEdit = (e: React.MouseEvent, admin: any) => {
    e.stopPropagation();
    setEditAdminId(admin.id);
    setEditFormData({
      name: admin.name,
      email: admin.email,
      password: "",
    });
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdminId) return;

    const errors: { name?: string; email?: string; password?: string } = {};

    if (!editFormData.name.trim()) {
      errors.name = "Full name is required";
    }
    if (!editFormData.email.trim()) {
      errors.email = "Email address is required";
    } else if (!validateEmail(editFormData.email)) {
      errors.email = "Please enter a valid email address (e.g. user@company.com)";
    }
    if (editFormData.password && editFormData.password.length < 8) {
      errors.password = "Password must be at least 8 characters long";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setEditErrors({});
    try {
      setEditSubmitting(true);
      const payload: any = {
        name: editFormData.name,
        email: editFormData.email,
      };
      if (editFormData.password && editFormData.password.trim() !== "") {
        payload.password = editFormData.password;
      }

      await adminApi.put(`/api/admin/admins/${editAdminId}`, payload);
      toast.success("Admin updated successfully!");
      setIsEditModalOpen(false);
      setEditAdminId(null);
      fetchAdmins();
    } catch (err: any) {
      const serverMsg = err.response?.data?.message;
      if (serverMsg && serverMsg.toLowerCase().includes("email")) {
        setEditErrors({ email: serverMsg });
      } else {
        toast.error(serverMsg || "Failed to update admin");
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenDelete = (e: React.MouseEvent, admin: any) => {
    e.stopPropagation();
    if (currentAdmin && currentAdmin.id === admin.id) {
      toast.error("You cannot delete your own admin account.");
      return;
    }
    setAdminToDelete(admin);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!adminToDelete) return;

    try {
      setDeleteSubmitting(true);
      await adminApi.delete(`/api/admin/admins/${adminToDelete.id}`);
      toast.success(`Admin ${adminToDelete.name} deleted successfully!`);
      setIsDeleteModalOpen(false);
      setAdminToDelete(null);
      fetchAdmins();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete admin");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredAdmins = admins.filter((admin) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      admin.name?.toLowerCase().includes(query) ||
      admin.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-[#0a0a0a] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-slate-900 dark:text-white font-medium text-sm">All Admins</h2>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 font-mono">
              {filteredAdmins.length}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-600 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search admins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 w-56 sm:w-64 transition-colors"
              />
            </div>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              Add Admin
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400 font-mono text-xs animate-pulse">Loading admins...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Admin User</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Added On</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-600 dark:text-slate-400">
                      {searchQuery ? "No admins match your search." : "No admins found."}
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((admin) => (
                    <tr 
                      key={admin.id} 
                      onClick={() => navigate(`/admin/admins/${admin.id}`)}
                      className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center text-blue-500 font-medium flex-shrink-0">
                            {admin.name?.charAt(0) || "A"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors">{admin.name}</p>
                              {currentAdmin && currentAdmin.id === admin.id && (
                                <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/25 px-1.5 py-0.2 rounded font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" /> {admin.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md text-xs font-medium w-fit border border-blue-500/20">
                          <Shield className="w-3.5 h-3.5" />
                          Super Admin
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                        {new Date(admin.created_at).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(e, admin)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                            title="Edit Admin"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenDelete(e, admin)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                            title={currentAdmin && currentAdmin.id === admin.id ? "Delete Admin (You are currently logged in)" : "Delete Admin"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                Add New Admin
              </h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} noValidate className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 dark:text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => {
                    setCreateFormData({...createFormData, name: e.target.value});
                    if (createErrors.name) setCreateErrors({...createErrors, name: undefined});
                  }}
                  className={`w-full bg-slate-50 dark:bg-[#050505] border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all ${
                    createErrors.name
                      ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
                  }`}
                  placeholder="e.g. Jane Doe"
                />
                {createErrors.name && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {createErrors.name}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 dark:text-slate-400 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => {
                    setCreateFormData({...createFormData, email: e.target.value});
                    if (createErrors.email) setCreateErrors({...createErrors, email: undefined});
                  }}
                  className={`w-full bg-slate-50 dark:bg-[#050505] border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all ${
                    createErrors.email
                      ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
                  }`}
                  placeholder="e.g. jane@boomerr.ai"
                />
                {createErrors.email && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {createErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 dark:text-slate-400 mb-1.5">Password</label>
                <input
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => {
                    setCreateFormData({...createFormData, password: e.target.value});
                    if (createErrors.password) setCreateErrors({...createErrors, password: undefined});
                  }}
                  className={`w-full bg-slate-50 dark:bg-[#050505] border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all ${
                    createErrors.password
                      ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
                  }`}
                  placeholder="Minimum 8 characters"
                />
                {createErrors.password && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {createErrors.password}
                  </p>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors text-sm font-medium disabled:opacity-50 shadow-lg shadow-blue-500/25"
                >
                  {createSubmitting ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                Edit Admin User
              </h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} noValidate className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 dark:text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => {
                    setEditFormData({...editFormData, name: e.target.value});
                    if (editErrors.name) setEditErrors({...editErrors, name: undefined});
                  }}
                  className={`w-full bg-slate-50 dark:bg-[#050505] border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all ${
                    editErrors.name
                      ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
                  }`}
                  placeholder="e.g. Jane Doe"
                />
                {editErrors.name && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {editErrors.name}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 dark:text-slate-400 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => {
                    setEditFormData({...editFormData, email: e.target.value});
                    if (editErrors.email) setEditErrors({...editErrors, email: undefined});
                  }}
                  className={`w-full bg-slate-50 dark:bg-[#050505] border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all ${
                    editErrors.email
                      ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
                  }`}
                  placeholder="e.g. jane@boomerr.ai"
                />
                {editErrors.email && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {editErrors.email}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 dark:text-slate-400">New Password</label>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-400">Leave blank to keep unchanged</span>
                </div>
                <input
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => {
                    setEditFormData({...editFormData, password: e.target.value});
                    if (editErrors.password) setEditErrors({...editErrors, password: undefined});
                  }}
                  className={`w-full bg-slate-50 dark:bg-[#050505] border rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all ${
                    editErrors.password
                      ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
                  }`}
                  placeholder="Leave empty to keep existing password"
                />
                {editErrors.password && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {editErrors.password}
                  </p>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors text-sm font-medium disabled:opacity-50 shadow-lg shadow-blue-500/25"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && adminToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0a0a0a] border border-rose-500/25 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Admin User?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-1">
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{adminToDelete.name}</strong> ({adminToDelete.email})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-50 shadow-lg shadow-rose-600/20"
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAdmins;
