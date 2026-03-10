import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  type AdminWarehouse,
} from "@/hooks/useAdmin";
import {
  Warehouse,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Clock,
  Package,
  X,
  Check,
  Loader2,
  Power,
  PowerOff,
} from "lucide-react";

const CITY_PRESETS: { city: string; lat: number; lng: number }[] = [
  { city: "Hồ Chí Minh", lat: 10.7769, lng: 106.7009 },
  { city: "Hà Nội", lat: 21.0285, lng: 105.8542 },
  { city: "Đà Nẵng", lat: 16.0544, lng: 108.2022 },
  { city: "Cần Thơ", lat: 10.0452, lng: 105.7469 },
  { city: "Nha Trang", lat: 12.2388, lng: 109.1967 },
  { city: "Huế", lat: 16.4637, lng: 107.5909 },
  { city: "Hải Phòng", lat: 20.8449, lng: 106.6881 },
  { city: "Buôn Ma Thuột", lat: 12.6797, lng: 108.0378 },
  { city: "Đà Lạt", lat: 11.9404, lng: 108.4583 },
  { city: "Quy Nhơn", lat: 13.783, lng: 109.2197 },
];

interface FormData {
  name: string;
  code: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  capacity: string;
  processing_hours: string;
}

const EMPTY_FORM: FormData = {
  name: "",
  code: "",
  address: "",
  city: "",
  latitude: "",
  longitude: "",
  capacity: "1000",
  processing_hours: "4",
};

export default function AdminWarehouses() {
  const { data: warehouses, isLoading } = useWarehouses();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (w: AdminWarehouse) => {
    setForm({
      name: w.name,
      code: w.code,
      address: w.address || "",
      city: w.city,
      latitude: String(w.latitude),
      longitude: String(w.longitude),
      capacity: String(w.capacity),
      processing_hours: String(w.processing_hours),
    });
    setEditingId(w.id);
    setShowForm(true);
  };

  const applyPreset = (preset: (typeof CITY_PRESETS)[0]) => {
    setForm((f) => ({
      ...f,
      city: preset.city,
      latitude: String(preset.lat),
      longitude: String(preset.lng),
      code: f.code || preset.city.slice(0, 3).toUpperCase() + "-01",
      name: f.name || `Kho ${preset.city}`,
    }));
  };

  const handleSubmit = async () => {
    const payload = {
      name: form.name,
      code: form.code,
      address: form.address || null,
      city: form.city,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      capacity: parseInt(form.capacity),
      processing_hours: parseFloat(form.processing_hours),
    };

    if (editingId) {
      await updateWarehouse.mutateAsync({ id: editingId, ...payload });
    } else {
      await createWarehouse.mutateAsync(payload);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = (w: AdminWarehouse) => {
    if (confirm(`Xóa kho "${w.name}" (${w.code})?`)) {
      deleteWarehouse.mutate(w.id);
    }
  };

  const handleToggle = (w: AdminWarehouse) => {
    updateWarehouse.mutate({ id: w.id, is_active: !w.is_active });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO title="Quản lý kho" description="Quản lý hệ thống kho gom hàng mGift" path="/admin/warehouses" />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Hệ thống kho ({warehouses?.length || 0})</h2>
            <p className="text-sm text-muted-foreground">
              Hệ thống tự chọn kho tối ưu cho mỗi đơn hàng dựa trên vị trí shop & user
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Thêm kho
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {editingId ? "Sửa kho" : "Thêm kho mới"}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* City presets */}
              {!editingId && (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Chọn nhanh thành phố:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CITY_PRESETS.map((p) => (
                      <button
                        key={p.city}
                        onClick={() => applyPreset(p)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors hover:bg-primary hover:text-primary-foreground ${
                          form.city === p.city ? "bg-primary text-primary-foreground" : ""
                        }`}
                      >
                        {p.city}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Tên kho</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Kho Hồ Chí Minh"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Mã kho</label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="HCM-01"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Thành phố</label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Hồ Chí Minh"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Địa chỉ</label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Quận 7, TP.HCM"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Vĩ độ</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="10.7769"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Kinh độ</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="106.7009"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Sức chứa (đơn)</label>
                  <Input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">TG xử lý (giờ)</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={form.processing_hours}
                    onChange={(e) => setForm({ ...form, processing_hours: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Hủy
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.name || !form.code || !form.city || !form.latitude || !form.longitude}
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  {editingId ? "Lưu" : "Tạo kho"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warehouse grid */}
        {(!warehouses || warehouses.length === 0) ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <Warehouse className="h-12 w-12 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Chưa có kho nào</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Thêm kho đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {warehouses.map((w) => (
              <Card key={w.id} className={`transition-opacity ${!w.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Warehouse className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{w.name}</p>
                        <p className="text-xs text-muted-foreground">{w.code}</p>
                      </div>
                    </div>
                    <Badge variant={w.is_active ? "default" : "secondary"}>
                      {w.is_active ? "Hoạt động" : "Tạm ngưng"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{w.city}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{w.processing_hours}h xử lý</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                      <span>{w.capacity.toLocaleString()} đơn</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}</span>
                    </div>
                  </div>

                  {w.address && (
                    <p className="mt-2 text-xs text-muted-foreground">{w.address}</p>
                  )}

                  <div className="mt-4 flex gap-1.5">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(w)}>
                      <Pencil className="h-3 w-3" />
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleToggle(w)}
                    >
                      {w.is_active ? (
                        <><PowerOff className="h-3 w-3" /> Tạm ngưng</>
                      ) : (
                        <><Power className="h-3 w-3" /> Kích hoạt</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDelete(w)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
