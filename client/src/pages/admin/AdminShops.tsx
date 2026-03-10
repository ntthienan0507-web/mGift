import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type DataTableAction } from "@/components/ui/data-table";
import { useAdminShops, useUpdateAdminShop, useDeleteAdminShop, type AdminShop } from "@/hooks/useAdmin";
import { Store, Power, PowerOff, Trash2, Copy, Key } from "lucide-react";

export default function AdminShopsPage() {
  const { data: shops, isLoading } = useAdminShops({ limit: 200 });
  const updateShop = useUpdateAdminShop();
  const deleteShop = useDeleteAdminShop();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyApiKey = (shop: AdminShop) => {
    navigator.clipboard.writeText(shop.api_key);
    setCopiedId(shop.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const columns: DataTableColumn<AdminShop>[] = [
    {
      key: "name",
      title: "Tên shop",
      sortable: true,
      render: (val, row) => (
        <div>
          <span className="font-medium">{val}</span>
          {row.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "is_active",
      title: "Trạng thái",
      render: (val) => (
        <Badge variant={val ? "default" : "secondary"}>
          {val ? "Hoạt động" : "Tạm ngưng"}
        </Badge>
      ),
    },
    { key: "contact_email", title: "Email", className: "hidden md:table-cell" },
    { key: "contact_phone", title: "SĐT", className: "hidden lg:table-cell" },
    {
      key: "api_key",
      title: "API Key",
      className: "hidden xl:table-cell",
      render: (val, row) => (
        <button
          onClick={() => copyApiKey(row)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Click để copy"
        >
          <Key className="h-3 w-3" />
          <code className="bg-muted px-1 rounded">{val.slice(0, 12)}...</code>
          {copiedId === row.id && <span className="text-green-600 text-[10px]">Copied!</span>}
        </button>
      ),
    },
    {
      key: "created_at",
      title: "Ngày tạo",
      sortable: true,
      className: "hidden lg:table-cell",
      render: (val) => new Date(val).toLocaleDateString("vi-VN"),
    },
  ];

  const actions: DataTableAction<AdminShop>[] = [
    {
      label: "Copy API Key",
      icon: <Copy className="h-4 w-4" />,
      onClick: (row) => copyApiKey(row),
    },
    {
      label: "Kích hoạt",
      icon: <Power className="h-4 w-4" />,
      onClick: (row) => updateShop.mutate({ shopId: row.id, is_active: true }),
      hidden: (row) => row.is_active,
    },
    {
      label: "Tạm ngưng",
      icon: <PowerOff className="h-4 w-4" />,
      onClick: (row) => updateShop.mutate({ shopId: row.id, is_active: false }),
      hidden: (row) => !row.is_active,
    },
    {
      label: "Xóa shop",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (row) => {
        if (confirm(`Xóa shop "${row.name}"?`)) deleteShop.mutate(row.id);
      },
      variant: "destructive",
    },
  ];

  return (
    <DataTable<AdminShop>
      columns={columns}
      data={shops ?? []}
      actions={actions}
      loading={isLoading}
      rowKey="id"
      emptyMessage="Chưa có shop nào"
      emptyIcon={<Store className="h-10 w-10" />}
    />
  );
}
