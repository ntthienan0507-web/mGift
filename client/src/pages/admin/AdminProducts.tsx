import { useState } from "react";
import { resolveImageUrl } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type DataTableAction } from "@/components/ui/data-table";
import { useAdminProducts, useDeleteAdminProduct, type AdminProduct } from "@/hooks/useAdmin";
import { Package, Trash2 } from "lucide-react";

const columns: DataTableColumn<AdminProduct>[] = [
  {
    key: "name",
    title: "Sản phẩm",
    sortable: true,
    render: (_val, row) => (
      <div className="flex items-center gap-3">
        {row.images[0] ? (
          <img
            src={resolveImageUrl(row.images[0].url)}
            alt={row.name}
            className="h-10 w-10 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium truncate">{row.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {row.category_name && (
              <Badge variant="secondary" className="text-[10px]">
                {row.category_name}
              </Badge>
            )}
            {row.description && (
              <span className="text-[10px] text-muted-foreground line-clamp-1">
                {row.description}
              </span>
            )}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "price",
    title: "Giá",
    sortable: true,
    className: "text-right tabular-nums",
    render: (val) => (
      <span className="font-semibold text-primary">
        {Number(val).toLocaleString("vi-VN")}đ
      </span>
    ),
  },
  {
    key: "stock",
    title: "Kho",
    sortable: true,
    className: "text-center tabular-nums hidden sm:table-cell",
  },
  {
    key: "shop_name",
    title: "Shop",
    className: "hidden md:table-cell",
    render: (val) => val || "—",
  },
  {
    key: "created_at",
    title: "Ngày tạo",
    sortable: true,
    className: "hidden lg:table-cell",
    render: (val) => new Date(val).toLocaleDateString("vi-VN"),
  },
];

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useAdminProducts({ limit: 200, search: search || undefined });
  const deleteProduct = useDeleteAdminProduct();

  const actions: DataTableAction<AdminProduct>[] = [
    {
      label: "Xóa sản phẩm",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (row) => {
        if (confirm(`Xóa "${row.name}"?`)) deleteProduct.mutate(row.id);
      },
      variant: "destructive",
    },
  ];

  return (
    <DataTable<AdminProduct>
      columns={columns}
      data={products ?? []}
      actions={actions}
      loading={isLoading}
      rowKey="id"
      searchPlaceholder="Tìm theo tên sản phẩm..."
      searchValue={search}
      onSearchChange={setSearch}
      emptyMessage="Không tìm thấy sản phẩm nào"
      emptyIcon={<Package className="h-10 w-10" />}
    />
  );
}
