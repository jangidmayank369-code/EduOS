"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

type Role = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
};

type User = {
  id: number;
  email: string;
  role: string;
  role_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ApiError = {
  detail?: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    role_id: "",
  });

  const [selectedRoleId, setSelectedRoleId] = useState("");

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    window.location.href = "/login";
  };

  const getToken = () => {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem("access_token");
  };

  const parseResponse = async <T,>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          text || `Request failed with status ${response.status}.`
        );
      }

      return text as T;
    }

    const data = (await response.json()) as T & ApiError;

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          `Request failed with status ${response.status}.`
      );
    }

    return data;
  };

  const authFetch = async (
    path: string,
    options: RequestInit = {}
  ) => {
    const token = getToken();

    if (!token) {
      logout();
      throw new Error("Your session has expired. Please login again.");
    }

    const headers = new Headers(options.headers);

    headers.set("Authorization", `Bearer ${token}`);

    if (
      options.body &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;

    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        cache: "no-store",
      });
    } catch (err) {
      console.error("API network error:", err);

      throw new Error(
        `Cannot connect to EduOS backend at ${API_URL}. ` +
          "Please make sure FastAPI is running."
      );
    }

    if (response.status === 401) {
      logout();
      throw new Error("Your session has expired. Please login again.");
    }

    return response;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        logout();
        return;
      }

      const [usersResponse, rolesResponse] =
        await Promise.all([
          authFetch("/users/"),
          authFetch("/roles/"),
        ]);

      const usersData = await parseResponse<
        User[] | { items?: User[]; total?: number }
      >(usersResponse);

      const rolesData = await parseResponse<
        Role[] | { items?: Role[]; total?: number }
      >(rolesResponse);

      /*
       * Backend currently returns direct arrays.
       *
       * This also supports the paginated shape:
       * {
       *   items: [],
       *   total: 0
       * }
       */
      const normalizedUsers = Array.isArray(usersData)
        ? usersData
        : usersData.items || [];

      const normalizedRoles = Array.isArray(rolesData)
        ? rolesData
        : rolesData.items || [];

      setUsers(normalizedUsers);
      setRoles(normalizedRoles);
    } catch (err) {
      console.error("Users load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users and roles."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      logout();
      return;
    }

    void loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "all" ||
        user.role.toLowerCase() === roleFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "inactive" && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const activeUsers = users.filter(
    (user) => user.is_active
  ).length;

  const inactiveUsers = users.filter(
    (user) => !user.is_active
  ).length;

  const handleCreateUser = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    resetMessages();

    if (!newUser.email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (newUser.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (!newUser.role_id) {
      setError("Please select a role.");
      return;
    }

    setSaving(true);

    try {
      const response = await authFetch("/users/", {
        method: "POST",
        body: JSON.stringify({
          email: newUser.email.trim(),
          password: newUser.password,
          role_id: Number(newUser.role_id),
        }),
      });

      await parseResponse<User>(response);

      setSuccess("User created successfully.");

      setNewUser({
        email: "",
        password: "",
        role_id: "",
      });

      setShowCreateModal(false);

      await loadData();
    } catch (err) {
      console.error("Create user error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create user."
      );
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (user: User) => {
    resetMessages();
    setSelectedUser(user);
    setShowStatusModal(true);
  };

  const handleStatusChange = async () => {
    if (!selectedUser) {
      return;
    }

    resetMessages();
    setSaving(true);

    try {
      const response = await authFetch(
        `/users/${selectedUser.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_active: !selectedUser.is_active,
          }),
        }
      );

      await parseResponse<User>(response);

      setSuccess(
        selectedUser.is_active
          ? "User deactivated successfully."
          : "User activated successfully."
      );

      setShowStatusModal(false);
      setSelectedUser(null);

      await loadData();
    } catch (err) {
      console.error("Status update error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update user status."
      );
    } finally {
      setSaving(false);
    }
  };

  const openRoleModal = (user: User) => {
    resetMessages();

    setSelectedUser(user);
    setSelectedRoleId(
      user.role_id !== null
        ? String(user.role_id)
        : ""
    );

    setShowRoleModal(true);
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !selectedRoleId) {
      return;
    }

    resetMessages();
    setSaving(true);

    try {
      const response = await authFetch(
        `/users/${selectedUser.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role_id: Number(selectedRoleId),
          }),
        }
      );

      await parseResponse<User>(response);

      setSuccess(
        "User role updated successfully."
      );

      setShowRoleModal(false);
      setSelectedUser(null);
      setSelectedRoleId("");

      await loadData();
    } catch (err) {
      console.error("Role update error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update user role."
      );
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value: string) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const roleLabel = (role: string) => {
    return role
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const isSuperAdmin = (user: User) => {
    return (
      user.role.toLowerCase() === "super_admin"
    );
  };

  return (
    <div className="min-h-full bg-[#f5f7fb] p-5 sm:p-6 lg:p-8">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#315b9b]">
            Access Control
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#102a56]">
            Users
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage login accounts, account status and
            role assignments across EduOS.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetMessages();
            setShowCreateModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#102a56] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#173d75]"
        >
          <span className="text-lg leading-none">+</span>
          Create User
        </button>
      </div>

      {success && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-4 text-emerald-700 hover:text-emerald-900"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="ml-4 text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total Users"
          value={users.length}
          icon="👥"
        />

        <SummaryCard
          label="Active Users"
          value={activeUsers}
          icon="✓"
        />

        <SummaryCard
          label="Inactive Users"
          value={inactiveUsers}
          icon="○"
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_180px_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search users by email or role..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-[#315b9b] focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#315b9b] focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">
                All Roles
              </option>

              {roles
                .filter((role) => role.is_active)
                .map((role) => (
                  <option
                    key={role.id}
                    value={role.name.toLowerCase()}
                  >
                    {roleLabel(role.name)}
                  </option>
                ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#315b9b] focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">
                All Status
              </option>
              <option value="active">
                Active
              </option>
              <option value="inactive">
                Inactive
              </option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            hasFilters={
              Boolean(search) ||
              roleFilter !== "all" ||
              statusFilter !== "all"
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    User
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Role
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Created
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#102a56] text-sm font-bold text-white">
                          {user.email
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {user.email}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-400">
                            User ID #{user.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-5">
                      <span className="inline-flex rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#315b9b]">
                        {roleLabel(user.role)}
                      </span>
                    </td>

                    <td className="px-5 py-5">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-5 text-sm text-slate-500">
                      {formatDate(user.created_at)}
                    </td>

                    <td className="px-5 py-5">
                      <div className="flex justify-end gap-2">
                        {!isSuperAdmin(user) && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openRoleModal(user)
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#315b9b]"
                            >
                              Change Role
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openStatusModal(user)
                              }
                              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                user.is_active
                                  ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
                                  : "border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50"
                              }`}
                            >
                              {user.is_active
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                          </>
                        )}

                        {isSuperAdmin(user) && (
                          <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                            Protected
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading &&
          filteredUsers.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing{" "}
                <strong className="text-slate-700">
                  {filteredUsers.length}
                </strong>{" "}
                of{" "}
                <strong className="text-slate-700">
                  {users.length}
                </strong>{" "}
                users
              </span>

              <span>
                Access control is enforced by the backend RBAC system.
              </span>
            </div>
          )}
      </section>

      {showCreateModal && (
        <Modal
          title="Create User"
          description="Create a new login account and assign an active RBAC role."
          onClose={() => {
            if (!saving) {
              setShowCreateModal(false);
            }
          }}
        >
          <form onSubmit={handleCreateUser}>
            <div className="space-y-5">
              <FormField label="Email Address">
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="user@school.com"
                  className="input-field"
                />
              </FormField>

              <FormField label="Password">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Minimum 8 characters"
                  className="input-field"
                />
              </FormField>

              <FormField label="Role">
                <select
                  required
                  value={newUser.role_id}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      role_id: event.target.value,
                    }))
                  }
                  className="input-field"
                >
                  <option value="">
                    Select role
                  </option>

                  {roles
                    .filter(
                      (role) =>
                        role.is_active &&
                        role.name.toLowerCase() !==
                          "super_admin"
                    )
                    .map((role) => (
                      <option
                        key={role.id}
                        value={role.id}
                      >
                        {roleLabel(role.name)}
                      </option>
                    ))}
                </select>
              </FormField>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setShowCreateModal(false)
                }
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173d75] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Creating..."
                  : "Create User"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showRoleModal && selectedUser && (
        <Modal
          title="Change User Role"
          description={`Update the RBAC role assigned to ${selectedUser.email}.`}
          onClose={() => {
            if (!saving) {
              setShowRoleModal(false);
              setSelectedUser(null);
            }
          }}
        >
          <div>
            <FormField label="New Role">
              <select
                value={selectedRoleId}
                onChange={(event) =>
                  setSelectedRoleId(
                    event.target.value
                  )
                }
                className="input-field"
              >
                <option value="">
                  Select role
                </option>

                {roles
                  .filter(
                    (role) =>
                      role.is_active &&
                      role.name.toLowerCase() !==
                        "super_admin"
                  )
                  .map((role) => (
                    <option
                      key={role.id}
                      value={role.id}
                    >
                      {roleLabel(role.name)}
                    </option>
                  ))}
              </select>
            </FormField>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  saving || !selectedRoleId
                }
                onClick={handleRoleChange}
                className="rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173d75] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Updating..."
                  : "Update Role"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showStatusModal && selectedUser && (
        <Modal
          title={
            selectedUser.is_active
              ? "Deactivate User?"
              : "Activate User?"
          }
          description={
            selectedUser.is_active
              ? `This will prevent ${selectedUser.email} from logging into EduOS.`
              : `This will allow ${selectedUser.email} to log into EduOS again.`
          }
          onClose={() => {
            if (!saving) {
              setShowStatusModal(false);
              setSelectedUser(null);
            }
          }}
        >
          <div>
            <div
              className={`rounded-2xl border p-4 ${
                selectedUser.is_active
                  ? "border-red-200 bg-red-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  selectedUser.is_active
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {selectedUser.is_active
                  ? "The account will become inactive immediately."
                  : "The account will become active immediately."}
              </p>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedUser(null);
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleStatusChange}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  selectedUser.is_active
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {saving
                  ? "Updating..."
                  : selectedUser.is_active
                    ? "Deactivate"
                    : "Activate"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">
          {label}
        </p>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-[#315b9b]">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-3xl font-bold tracking-tight text-[#102a56]">
        {value}
      </p>
    </div>
  );
}

function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="pr-5">
            <h2 className="text-xl font-bold text-[#102a56]">
              {title}
            </h2>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#102a56]" />

      <p className="mt-4 text-sm font-medium text-slate-500">
        Loading users...
      </p>
    </div>
  );
}

function EmptyState({
  hasFilters,
}: {
  hasFilters: boolean;
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        👥
      </div>

      <h3 className="mt-5 text-lg font-bold text-[#102a56]">
        {hasFilters
          ? "No matching users"
          : "No users found"}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasFilters
          ? "Try changing your search or filters."
          : "Create the first user account to start managing access."}
      </p>
    </div>
  );
}