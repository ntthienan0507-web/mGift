import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SEO } from "@/components/SEO";
import {
  useCreateShop,
  useRecoverApiKey,
  setSupplierApiKey,
} from "@/hooks/useSupplier";
import {
  Store,
  Loader2,
  Copy,
  CheckCircle2,
  KeyRound,
  Mail,
} from "lucide-react";

export function SupplierAuth() {
  const [mode, setMode] = useState<"login" | "register" | "recover">("register");
  const createShop = useCreateShop();
  const recoverKey = useRecoverApiKey();

  const [shopName, setShopName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverSent, setRecoverSent] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return;
    createShop.mutate(
      {
        name: shopName.trim(),
        description: description.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        address: address.trim() || null,
      },
      {
        onSuccess: (data) => {
          setCreatedApiKey(data.api_key);
          setSupplierApiKey(data.api_key);
        },
      }
    );
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setSupplierApiKey(apiKeyInput.trim());
    window.location.reload();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdApiKey) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-700">Đăng ký shop thành công!</h1>
          <p className="text-muted-foreground">
            Đây là API Key của shop bạn. Hãy lưu lại cẩn thận.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-destructive">
                API Key (lưu lại, chỉ hiện 1 lần!)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted p-3 text-sm font-mono break-all">
                  {createdApiKey}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Vào trang quản lý
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <SEO title="Đăng ký Nhà cung cấp" path="/supplier" />
      <div className="flex flex-col items-center text-center space-y-3">
        <Store className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold">Nhà cung cấp mGift</h1>
        <p className="text-muted-foreground">Đăng ký shop để bán sản phẩm trên mGift</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {([
          { id: "register" as const, label: "Đăng ký mới" },
          { id: "login" as const, label: "Có API Key" },
          { id: "recover" as const, label: "Quên API Key" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "register" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              Đăng ký cửa hàng mới
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tên shop *</label>
                <Input placeholder="Tên cửa hàng của bạn" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mô tả</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground"
                  placeholder="Giới thiệu ngắn về shop..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email liên hệ</label>
                  <Input type="email" placeholder="shop@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Số điện thoại</label>
                  <Input placeholder="0901 234 567" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Địa chỉ</label>
                <Input placeholder="Địa chỉ cửa hàng" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <Separator />
              <Button className="w-full" type="submit" disabled={createShop.isPending || !shopName.trim()}>
                {createShop.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
                Đăng ký cửa hàng
              </Button>
              {createShop.isError && <p className="text-sm text-destructive text-center">Đã có lỗi xảy ra. Vui lòng thử lại.</p>}
            </form>
          </CardContent>
        </Card>
      ) : mode === "login" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Đăng nhập bằng API Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key *</label>
                <Input placeholder="Paste API Key của shop..." value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} required />
                <p className="text-xs text-muted-foreground">API Key được cấp khi bạn đăng ký shop</p>
              </div>
              <Button className="w-full" type="submit" disabled={!apiKeyInput.trim()}>
                <KeyRound className="mr-2 h-4 w-4" />
                Đăng nhập
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Khôi phục API Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recoverSent ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center"><CheckCircle2 className="h-12 w-12 text-green-600" /></div>
                <p className="text-sm text-muted-foreground">Nếu email này đã đăng ký shop, API Key sẽ được gửi qua email.</p>
                <Button variant="outline" className="w-full" onClick={() => { setRecoverSent(false); setMode("login"); }}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Quay lại đăng nhập
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!recoverEmail.trim()) return;
                  recoverKey.mutate(recoverEmail.trim(), { onSuccess: () => setRecoverSent(true) });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email liên hệ của shop *</label>
                  <Input type="email" placeholder="Email bạn đã dùng khi đăng ký shop" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">API Key sẽ được gửi về email liên hệ đã đăng ký</p>
                </div>
                <Button className="w-full" type="submit" disabled={recoverKey.isPending || !recoverEmail.trim()}>
                  {recoverKey.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Gửi API Key qua email
                </Button>
                {recoverKey.isError && <p className="text-sm text-destructive text-center">Đã có lỗi xảy ra. Vui lòng thử lại.</p>}
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
