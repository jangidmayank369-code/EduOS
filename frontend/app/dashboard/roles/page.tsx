"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

type Role = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Permission = {
  id: number;
  code: string;
  name: string;
  module: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type RolePermission = {
  id: number;
  permission_id: number;
  allowed: boolean;
  permission: Permission;
};

type RoleDetail = Role & {
  permissions: RolePermission[];
};

type RoleListResponse = {
  items: Role[];
  total: number;
};

type PermissionState = Record<number, boolean>;

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleDetail | null>(null);

  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [loadingRole, setLoadingRole] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [permissionState, setPermissionState] =
    useState<PermissionState>({});

  const [showCreate, setShowCreate] = useState(false);

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  const [search, setSearch] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return roles;
    }

    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(query) ||
        (role.description ?? "").toLowerCase().includes(query)
    );
  }, [roles, search]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};

    for (const permission of permissions) {
      if (!groups[permission.module]) {
        groups[permission.module] = [];
      }

      groups[permission.module].push(permission);
    }

    return groups;
  }, [permissions]);

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }

    loadRoles();
    loadPermissions();
  }, []);

  async function loadRoles() {
    try {
      setLoadingRoles(true);
      setError("");

      const response = await fetch(`${API_URL}/roles/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load roles.");
      }

      const data: RoleListResponse = await response.json();

      setRoles(data.items);

      if (data.items.length > 0) {
        await loadRole(data.items[0].id);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load roles.");
    } finally {
      setLoadingRoles(false);
    }
  }

  async function loadPermissions() {
    try {
      setLoadingPermissions(true);

      const response = await fetch(
        `${API_URL}/roles/permissions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load permissions.");
      }

      const data: Permission[] = await response.json();

      setPermissions(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load permissions.");
    } finally {
      setLoadingPermissions(false);
    }
  }

  async function loadRole(roleId: number) {
    try {
      setLoadingRole(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/roles/${roleId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load role.");
      }

      const data: RoleDetail = await response.json();

      setSelectedRole(data);

      const nextState: PermissionState = {};

      for (const permission of data.permissions) {
        nextState[permission.permission_id] =
          permission.allowed;
      }

      setPermissionState(nextState);
    } catch (err) {
      console.error(err);
      setError("Unable to load selected role.");
    } finally {
      setLoadingRole(false);
    }
  }

  async function createRole() {
    if (!newRoleName.trim()) {
      setError("Role name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/roles/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || null,
        }),
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to create role."
        );
      }

      setRoles((current) => [...current, data]);

      setNewRoleName("");
      setNewRoleDescription("");
      setShowCreate(false);

      setSuccess("Role created successfully.");

      await loadRole(data.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create role."
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePermissions() {
    if (!selectedRole) {
      return;
    }

    if (selectedRole.name === "SUPER_ADMIN") {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = permissions.map((permission) => ({
        permission_id: permission.id,
        allowed: permissionState[permission.id] === true,
      }));

      const response = await fetch(
        `${API_URL}/roles/${selectedRole.id}/permissions`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            permissions: payload,
          }),
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail?.message ||
            data?.detail ||
            "Unable to save permissions."
        );
      }

      setSelectedRole(data);

      const nextState: PermissionState = {};

      for (const permission of data.permissions) {
        nextState[permission.permission_id] =
          permission.allowed;
      }

      setPermissionState(nextState);

      setSuccess("Permissions updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRoleStatus(role: Role) {
    if (role.name === "SUPER_ADMIN") {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/roles/${role.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_active: !role.is_active,
          }),
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to update role."
        );
      }

      setRoles((current) =>
        current.map((item) =>
          item.id === data.id ? data : item
        )
      );

      if (selectedRole?.id === data.id) {
        setSelectedRole((current) =>
          current
            ? {
                ...current,
                is_active: data.is_active,
              }
            : current
        );
      }

      setSuccess(
        data.is_active
          ? "Role activated."
          : "Role deactivated."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update role."
      );
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(permissionId: number) {
    if (selectedRole?.name === "SUPER_ADMIN") {
      return;
    }

    setPermissionState((current) => ({
      ...current,
      [permissionId]: !current[permissionId],
    }));
  }

  function toggleModule(module: string) {
    if (selectedRole?.name === "SUPER_ADMIN") {
      return;
    }

    const modulePermissions =
      groupedPermissions[module] ?? [];

    const allEnabled = modulePermissions.every(
      (permission) =>
        permissionState[permission.id] === true
    );

    setPermissionState((current) => {
      const next = { ...current };

      for (const permission of modulePermissions) {
        next[permission.id] = !allEnabled;
      }

      return next;
    });
  }

  function selectAllPermissions() {
    if (selectedRole?.name === "SUPER_ADMIN") {
      return;
    }

    const next: PermissionState = {};

    for (const permission of permissions) {
      next[permission.id] = true;
    }

    setPermissionState(next);
  }

  function clearAllPermissions() {
    if (selectedRole?.name === "SUPER_ADMIN") {
      return;
    }

    const next: PermissionState = {};

    for (const permission of permissions) {
      next[permission.id] = false;
    }

    setPermissionState(next);
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    window.location.href = "/login";
  }

  const enabledCount = permissions.filter(
    (permission) =>
      permissionState[permission.id] === true
  ).length;

  return (
    <div className="min-h-full bg-[#f5f7fb] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#315b9b]">
              Administration
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
              Access Control
            </h1>

            <p className="mt-0.5 text-xs text-slate-500">
              Manage roles and permissions across EduOS
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#173b75]"
          >
            + Create Role
          </button>
        </div>
      </header>

      <div className="w-full px-6 py-7 lg:px-8">
        {/* Messages */}
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            <span>{error}</span>

            <button
              onClick={() => setError("")}
              className="ml-4 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        {/* Summary */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total Roles"
            value={loadingRoles ? "..." : roles.length}
            icon="◈"
          />

          <SummaryCard
            label="Active Roles"
            value={
              loadingRoles
                ? "..."
                : roles.filter((role) => role.is_active).length
            }
            icon="✓"
          />

          <SummaryCard
            label="Available Permissions"
            value={
              loadingPermissions
                ? "..."
                : permissions.length
            }
            icon="⚿"
          />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          {/* Roles */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                    Roles
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-[#102a56]">
                    Access Profiles
                  </h2>
                </div>

                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#315b9b]">
                  {roles.length}
                </span>
              </div>

              <div className="mt-4">
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search roles..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="max-h-[650px] overflow-y-auto p-3">
              {loadingRoles ? (
                <LoadingState text="Loading roles..." />
              ) : filteredRoles.length === 0 ? (
                <EmptyState text="No roles found." />
              ) : (
                <div className="space-y-2">
                  {filteredRoles.map((role) => {
                    const active =
                      selectedRole?.id === role.id;

                    return (
                      <button
                        key={role.id}
                        onClick={() => loadRole(role.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-blue-200 bg-blue-50 shadow-sm"
                            : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#102a56]">
                              {role.name}
                            </p>

                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {role.description ||
                                "No description provided."}
                            </p>
                          </div>

                          <span
                            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                              role.is_active
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Permission editor */}
          <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
            {loadingRole ? (
              <div className="flex min-h-[500px] items-center justify-center">
                <LoadingState text="Loading permissions..." />
              </div>
            ) : !selectedRole ? (
              <div className="flex min-h-[500px] items-center justify-center">
                <EmptyState text="Select a role to manage access." />
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold text-[#102a56]">
                          {selectedRole.name}
                        </h2>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            selectedRole.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {selectedRole.is_active
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </span>
                      </div>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        {selectedRole.description ||
                          "Configure exactly what users with this role can access."}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                          {enabledCount} / {permissions.length}{" "}
                          permissions enabled
                        </div>

                        {selectedRole.name === "SUPER_ADMIN" && (
                          <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                            Protected role
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={
                          selectedRole.name ===
                            "SUPER_ADMIN" || saving
                        }
                        onClick={selectAllPermissions}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Select All
                      </button>

                      <button
                        disabled={
                          selectedRole.name ===
                            "SUPER_ADMIN" || saving
                        }
                        onClick={clearAllPermissions}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Clear All
                      </button>

                      <button
                        disabled={
                          selectedRole.name ===
                            "SUPER_ADMIN" || saving
                        }
                        onClick={() =>
                          toggleRoleStatus(selectedRole)
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {selectedRole.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {loadingPermissions ? (
                    <LoadingState text="Loading permissions..." />
                  ) : (
                    <div className="space-y-5">
                      {Object.entries(groupedPermissions).map(
                        ([module, modulePermissions]) => {
                          const allEnabled =
                            modulePermissions.every(
                              (permission) =>
                                permissionState[
                                  permission.id
                                ] === true
                            );

                          const enabledInModule =
                            modulePermissions.filter(
                              (permission) =>
                                permissionState[
                                  permission.id
                                ] === true
                            ).length;

                          return (
                            <div
                              key={module}
                              className="overflow-hidden rounded-2xl border border-slate-200"
                            >
                              <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4">
                                <div>
                                  <h3 className="text-sm font-bold capitalize text-[#102a56]">
                                    {module}
                                  </h3>

                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {enabledInModule} of{" "}
                                    {modulePermissions.length}{" "}
                                    enabled
                                  </p>
                                </div>

                                <button
                                  disabled={
                                    selectedRole.name ===
                                      "SUPER_ADMIN" || saving
                                  }
                                  onClick={() =>
                                    toggleModule(module)
                                  }
                                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                                    allEnabled
                                      ? "bg-[#102a56] text-white"
                                      : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                                  } disabled:cursor-not-allowed disabled:opacity-40`}
                                >
                                  {allEnabled
                                    ? "All Enabled"
                                    : "Enable All"}
                                </button>
                              </div>

                              <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                                {modulePermissions.map(
                                  (permission) => {
                                    const enabled =
                                      permissionState[
                                        permission.id
                                      ] === true;

                                    return (
                                      <button
                                        key={permission.id}
                                        disabled={
                                          selectedRole.name ===
                                            "SUPER_ADMIN" ||
                                          saving
                                        }
                                        onClick={() =>
                                          togglePermission(
                                            permission.id
                                          )
                                        }
                                        className="flex items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold text-slate-700">
                                            {permission.name}
                                          </p>

                                          <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
                                            {permission.code}
                                          </p>
                                        </div>

                                        <span
                                          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                                            enabled
                                              ? "bg-[#102a56]"
                                              : "bg-slate-200"
                                          }`}
                                        >
                                          <span
                                            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                                              enabled
                                                ? "left-6"
                                                : "left-1"
                                            }`}
                                          />
                                        </span>
                                      </button>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
                  <p className="hidden text-xs text-slate-400 sm:block">
                    Saving replaces the complete permission set for
                    this role.
                  </p>

                  <button
                    disabled={
                      selectedRole.name === "SUPER_ADMIN" ||
                      saving ||
                      loadingPermissions
                    }
                    onClick={savePermissions}
                    className="ml-auto rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#173b75] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving
                      ? "Saving..."
                      : "Save Permissions"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="h-10" />
      </div>

      {/* Create Role Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                  Access Control
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                  Create Role
                </h2>
              </div>

              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Role Name
                </label>

                <input
                  value={newRoleName}
                  onChange={(event) =>
                    setNewRoleName(event.target.value)
                  }
                  placeholder="e.g. LIBRARIAN"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Description
                </label>

                <textarea
                  value={newRoleDescription}
                  onChange={(event) =>
                    setNewRoleDescription(event.target.value)
                  }
                  rows={4}
                  placeholder="What should this role be used for?"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                onClick={createRole}
                className="rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#173b75] disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Role"}
              </button>
            </div>
          </div>
        </div>
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
  value: number | string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>

        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm text-[#102a56]">
          {icon}
        </span>
      </div>

      <p className="mt-4 text-3xl font-bold tracking-tight text-[#102a56]">
        {value}
      </p>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#102a56]" />
        {text}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}