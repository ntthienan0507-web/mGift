import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  useSupplierProfile,
  useUpdateSupplierProfile,
} from "@/hooks/useSupplier";
import {
  Store,
  Mail,
  Phone,
  MapPin,
  Save,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export function SupplierProfileSection() {
  const { data: profile, isLoading } = useSupplierProfile();
  const updateProfile = useUpdateSupplierProfile();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setDescription(profile.description || "");
      setContactEmail(profile.contact_email || "");
      setContactPhone(profile.contact_phone || "");
      setAddress(profile.address || "");
      setCity(profile.city || "");
      setLatitude(profile.latitude ? String(profile.latitude) : "");
      setLongitude(profile.longitude ? String(profile.longitude) : "");
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Không thể tải hồ sơ shop
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile.mutateAsync({
      name: name.trim() || undefined,
      description: description.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4 text-primary" />
          Hồ sơ Shop
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tên shop *</label>
            <Input
              placeholder="Tên shop của bạn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mô tả</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground"
              placeholder="Giới thiệu về shop của bạn..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email liên hệ
              </label>
              <Input
                type="email"
                placeholder="shop@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Phone className="h-3 w-3" /> Số điện thoại
              </label>
              <Input
                placeholder="0901 234 567"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Địa chỉ
            </label>
            <Input
              placeholder="Địa chỉ shop"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Thành phố</label>
              <Input
                placeholder="Hồ Chí Minh"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Vĩ độ (latitude)</label>
              <Input
                type="number"
                step="0.0001"
                placeholder="10.7769"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Kinh độ (longitude)</label>
              <Input
                type="number"
                step="0.0001"
                placeholder="106.7009"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Vị trí giúp hệ thống tính thời gian giao hàng chính xác hơn. Nếu không có tọa độ, hệ thống sẽ dùng thành phố để ước tính.
          </p>

          <Separator />

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={updateProfile.isPending || !name.trim()}
            >
              {updateProfile.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="mr-1 h-4 w-4 text-green-600" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {saved ? "Đã lưu!" : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
