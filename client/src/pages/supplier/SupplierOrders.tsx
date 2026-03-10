import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  useSupplierOrders,
  useAcceptOrderItem,
  useRejectOrderItem,
  type SupplierOrderItem,
} from "@/hooks/useSupplier";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ShoppingCart,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  requested: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  rejected: "Đã từ chối",
  timeout: "Hết hạn",
  replaced: "Đã thay thế",
  picked_up: "Đã lấy hàng",
  at_warehouse: "Đã về kho",
  cancelled: "Đã hủy",
};

const statusColors: Record<string, string> = {
  requested: "bg-orange-100 text-orange-700",
  confirmed: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  timeout: "bg-gray-100 text-gray-700",
  replaced: "bg-purple-100 text-purple-700",
  picked_up: "bg-cyan-100 text-cyan-700",
  at_warehouse: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

type FilterStatus = "" | "requested" | "confirmed" | "rejected";

export function SupplierOrders() {
  const [filter, setFilter] = useState<FilterStatus>("");
  const { data: orders, isLoading } = useSupplierOrders(
    filter ? { status: filter } : undefined
  );

  const columns: DataTableColumn<SupplierOrderItem>[] = [
    {
      key: "product_name",
      title: "Sản phẩm",
      sortable: true,
      render: (val, row) => (
        <div>
          <span className="font-medium">{val || `SP #${row.product_id.slice(0, 8)}`}</span>
          <span className="ml-1.5 text-muted-foreground">x{row.quantity}</span>
        </div>
      ),
    },
    {
      key: "status",
      title: "Trạng thái",
      render: (val) => (
        <Badge className={statusColors[val] || "bg-muted"} variant="secondary">
          {statusLabels[val] || val}
        </Badge>
      ),
    },
    {
      key: "unit_price",
      title: "Thành tiền",
      sortable: true,
      className: "text-right tabular-nums",
      render: (val, row) => (
        <span className="font-semibold text-primary">
          {(val * row.quantity).toLocaleString("vi-VN")}đ
        </span>
      ),
    },
    {
      key: "recipient_name",
      title: "Người nhận",
      className: "hidden md:table-cell",
      render: (val, row) => (
        <div className="text-xs">
          <p>{val}</p>
          <p className="text-muted-foreground">{row.recipient_phone}</p>
        </div>
      ),
    },
    {
      key: "recipient_address",
      title: "Địa chỉ",
      className: "hidden xl:table-cell max-w-[180px]",
      render: (val) => <span className="text-xs text-muted-foreground truncate block">{val}</span>,
    },
    {
      key: "order_created_at",
      title: "Ngày đặt",
      sortable: true,
      className: "hidden lg:table-cell",
      render: (val) => (
        <span className="text-xs">{new Date(val).toLocaleDateString("vi-VN")}</span>
      ),
    },
    {
      key: "id",
      title: "",
      className: "w-[180px]",
      render: (_val, row) => <OrderActions item={row} />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {(
          [
            { value: "", label: "Tất cả" },
            { value: "requested", label: "Chờ xác nhận" },
            { value: "confirmed", label: "Đã xác nhận" },
            { value: "rejected", label: "Đã từ chối" },
          ] as { value: FilterStatus; label: string }[]
        ).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable<SupplierOrderItem>
        columns={columns}
        data={orders ?? []}
        loading={isLoading}
        rowKey="id"
        emptyMessage="Chưa có đơn hàng nào"
        emptyIcon={<ShoppingCart className="h-10 w-10" />}
      />
    </div>
  );
}

function OrderActions({ item }: { item: SupplierOrderItem }) {
  const acceptItem = useAcceptOrderItem();
  const rejectItem = useRejectOrderItem();
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (item.status !== "requested") {
    if (item.reject_reason) {
      return <span className="text-[10px] text-red-600 line-clamp-1">Lý do: {item.reject_reason}</span>;
    }
    return null;
  }

  if (showReject) {
    return (
      <div className="flex items-center gap-1">
        <Input
          placeholder="Lý do..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          className="h-7 text-xs flex-1"
        />
        <Button
          size="xs"
          variant="destructive"
          onClick={() => {
            if (!rejectReason.trim()) return;
            rejectItem.mutate(
              { orderId: item.order_id, itemId: item.id, reason: rejectReason.trim() },
              { onSuccess: () => setShowReject(false) }
            );
          }}
          disabled={rejectItem.isPending || !rejectReason.trim()}
        >
          {rejectItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setShowReject(false)}>
          Hủy
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="xs"
        onClick={() => acceptItem.mutate({ orderId: item.order_id, itemId: item.id })}
        disabled={acceptItem.isPending}
      >
        {acceptItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
        Nhận
      </Button>
      <Button size="xs" variant="outline" onClick={() => setShowReject(true)}>
        <XCircle className="mr-1 h-3 w-3" />
        Từ chối
      </Button>
    </div>
  );
}
