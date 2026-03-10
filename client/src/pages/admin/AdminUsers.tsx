import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type DataTableAction } from "@/components/ui/data-table";
import { useAdminUsers, useUpdateAdminUser, type AdminUser } from "@/hooks/useAdmin";
import { Shield, ShieldOff, Users } from "lucide-react";

const columns: DataTableColumn<AdminUser>[] = [
  {
    key: "full_name",
    title: "Tên",
    sortable: true,
    render: (val, row) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{val}</span>
        {row.is_admin && <Badge variant="default" className="text-[10px]">Admin</Badge>}
        {row.google_id && <Badge variant="secondary" className="text-[10px]">Google</Badge>}
      </div>
    ),
  },
  { key: "email", title: "Email", sortable: true },
  { key: "phone", title: "SĐT", className: "hidden md:table-cell" },
  {
    key: "created_at",
    title: "Ngày đăng ký",
    sortable: true,
    className: "hidden lg:table-cell",
    render: (val) => new Date(val).toLocaleDateString("vi-VN"),
  },
];

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useAdminUsers({ limit: 200, search: search || undefined });
  const updateUser = useUpdateAdminUser();

  const actions: DataTableAction<AdminUser>[] = [
    {
      label: "Cấp quyền admin",
      icon: <Shield className="h-4 w-4" />,
      onClick: (row) => updateUser.mutate({ userId: row.id, is_admin: true }),
      hidden: (row) => row.is_admin,
    },
    {
      label: "Xóa quyền admin",
      icon: <ShieldOff className="h-4 w-4" />,
      onClick: (row) => updateUser.mutate({ userId: row.id, is_admin: false }),
      hidden: (row) => !row.is_admin,
      variant: "destructive",
    },
  ];

  return (
    <DataTable<AdminUser>
      columns={columns}
      data={users ?? []}
      actions={actions}
      loading={isLoading}
      rowKey="id"
      searchPlaceholder="Tìm theo email hoặc tên..."
      searchValue={search}
      onSearchChange={setSearch}
      emptyMessage="Không tìm thấy người dùng nào"
      emptyIcon={<Users className="h-10 w-10" />}
    />
  );
}
