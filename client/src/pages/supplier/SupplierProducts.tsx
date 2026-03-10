import { useState } from "react";
import { resolveImageUrl } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DataTable, type DataTableColumn, type DataTableAction } from "@/components/ui/data-table";
import {
  useSupplierProducts,
  useCreateSupplierProduct,
  useUpdateSupplierProduct,
  useDeleteSupplierProduct,
  useUploadProductImages,
  useDeleteProductImage,
} from "@/hooks/useSupplier";
import { useCategories, type Product } from "@/hooks/useGifts";
import {
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  Loader2,
  Package,
  Save,
  Sparkles,
  CalendarHeart,
  Users,
  Palette,
  Tag,
} from "lucide-react";

const productColumns: DataTableColumn<Product>[] = [
  {
    key: "name",
    title: "Sản phẩm",
    sortable: true,
    render: (_val, row) => (
      <div className="flex items-center gap-3">
        {row.images[0] ? (
          <img src={resolveImageUrl(row.images[0].url)} alt={row.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium truncate">{row.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {row.category_name && <Badge variant="secondary" className="text-[10px]">{row.category_name}</Badge>}
            <span className="text-[10px] text-muted-foreground">{row.images.length} ảnh</span>
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
    render: (val) => <span className="font-semibold text-primary">{Number(val).toLocaleString("vi-VN")}đ</span>,
  },
  {
    key: "stock",
    title: "Kho",
    sortable: true,
    className: "text-center tabular-nums hidden sm:table-cell",
  },
  {
    key: "created_at",
    title: "Ngày tạo",
    sortable: true,
    className: "hidden lg:table-cell",
    render: (val) => new Date(val).toLocaleDateString("vi-VN"),
  },
];

export function SupplierProducts() {
  const { data: products, isLoading } = useSupplierProducts();
  const deleteProduct = useDeleteSupplierProduct();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const actions: DataTableAction<Product>[] = [
    {
      label: "Chỉnh sửa",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (row) => {
        setEditProduct(row);
        setShowForm(true);
      },
    },
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Sản phẩm ({products?.length || 0})
        </h2>
        <Button
          size="sm"
          onClick={() => {
            setEditProduct(null);
            setShowForm(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Thêm sản phẩm
        </Button>
      </div>

      {showForm && (
        <ProductForm
          product={editProduct}
          onClose={() => {
            setShowForm(false);
            setEditProduct(null);
          }}
        />
      )}

      <DataTable<Product>
        columns={productColumns}
        data={products ?? []}
        actions={actions}
        loading={isLoading}
        rowKey="id"
        emptyMessage="Chưa có sản phẩm nào. Hãy thêm sản phẩm đầu tiên!"
        emptyIcon={<Package className="h-10 w-10" />}
      />
    </div>
  );
}

function ProductForm({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const isEdit = !!product;
  const createProduct = useCreateSupplierProduct();
  const updateProduct = useUpdateSupplierProduct();
  const uploadImages = useUploadProductImages();
  const deleteImage = useDeleteProductImage();
  const { data: categories } = useCategories();

  const meta = product?.metadata_info ?? {};
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price?.toString() ?? "");
  const [stock, setStock] = useState(product?.stock?.toString() ?? "0");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [files, setFiles] = useState<File[]>([]);

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Metadata fields cho AI (multi-select)
  const [occasions, setOccasions] = useState<string[]>(
    Array.isArray(meta.occasion) ? meta.occasion as string[] : meta.occasion ? [meta.occasion as string] : []
  );
  const [recipients, setRecipients] = useState<string[]>(
    Array.isArray(meta.recipient) ? meta.recipient as string[] : meta.recipient ? [meta.recipient as string] : []
  );
  const [styles, setStyles] = useState<string[]>(
    Array.isArray(meta.style) ? meta.style as string[] : meta.style ? [meta.style as string] : []
  );

  const toggleChip = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };
  const [tagList, setTagList] = useState<string[]>(
    Array.isArray(meta.tags) ? (meta.tags as string[]) : []
  );
  const [tagInput, setTagInput] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const isPending = createProduct.isPending || updateProduct.isPending || isUploading;

  const addTag = (value: string) => {
    const t = value.trim().toLowerCase();
    if (t && !tagList.includes(t) && tagList.length < 10) {
      setTagList([...tagList, t]);
    }
    setTagInput("");
  };

  const removeTag = (index: number) => {
    setTagList(tagList.filter((_, i) => i !== index));
  };

  const buildMetadata = () => {
    const info: Record<string, unknown> = {};
    if (occasions.length > 0) info.occasion = occasions;
    if (recipients.length > 0) info.recipient = recipients;
    if (styles.length > 0) info.style = styles;
    if (tagList.length > 0) info.tags = tagList;
    return Object.keys(info).length > 0 ? info : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    const payload = {
      name: name.trim(),
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      description: description.trim() || null,
      category_id: categoryId || null,
      metadata_info: buildMetadata(),
    };

    try {
      let targetId: string;
      if (isEdit) {
        await updateProduct.mutateAsync({ productId: product.id, ...payload });
        targetId = product.id;
      } else {
        const newProduct = await createProduct.mutateAsync(payload);
        targetId = newProduct.id;
      }
      if (files.length > 0) {
        setIsUploading(true);
        await uploadImages.mutateAsync({ productId: targetId, files });
        setIsUploading(false);
      }
      onClose();
    } catch {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {isEdit ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tên sản phẩm *</label>
              <Input
                placeholder="Tên sản phẩm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Giá (VNĐ) *</label>
              <Input
                type="number"
                placeholder="100000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Số lượng tồn kho</label>
              <Input
                type="number"
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                min="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Danh mục</label>
              <select
                className="flex h-9 w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- Chọn danh mục --</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mô tả</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground"
              placeholder="Mô tả chi tiết: phù hợp cho ai, dịp gì, gồm những gì..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* AI Metadata */}
          <div className="space-y-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">Thông tin cho AI gợi ý</p>
            </div>

            {/* Dịp tặng */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <CalendarHeart className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Dịp tặng</label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "birthday", label: "Sinh nhật", emoji: "🎂" },
                  { value: "valentine", label: "Valentine", emoji: "💕" },
                  { value: "anniversary", label: "Kỷ niệm", emoji: "💍" },
                  { value: "wedding", label: "Đám cưới", emoji: "💒" },
                  { value: "thanks", label: "Cảm ơn", emoji: "🙏" },
                  { value: "housewarming", label: "Tân gia", emoji: "🏠" },
                  { value: "graduation", label: "Tốt nghiệp", emoji: "🎓" },
                  { value: "tet", label: "Tết", emoji: "🧧" },
                  { value: "any", label: "Mọi dịp", emoji: "🎁" },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleChip(occasions, setOccasions, o.value)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      occasions.includes(o.value)
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <span>{o.emoji}</span> {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Đối tượng */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Đối tượng</label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "female", label: "Nữ", emoji: "👩" },
                  { value: "male", label: "Nam", emoji: "👨" },
                  { value: "couple", label: "Cặp đôi", emoji: "💑" },
                  { value: "family", label: "Gia đình", emoji: "👨‍👩‍👧" },
                  { value: "kids", label: "Trẻ em", emoji: "👶" },
                  { value: "boss", label: "Sếp / Đối tác", emoji: "🤝" },
                  { value: "friend", label: "Bạn bè", emoji: "👫" },
                  { value: "anyone", label: "Ai cũng hợp", emoji: "🌟" },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleChip(recipients, setRecipients, o.value)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      recipients.includes(o.value)
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <span>{o.emoji}</span> {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Phong cách */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Phong cách</label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "elegant", label: "Sang trọng", emoji: "✨" },
                  { value: "cute", label: "Dễ thương", emoji: "🧸" },
                  { value: "romantic", label: "Lãng mạn", emoji: "🌹" },
                  { value: "practical", label: "Thiết thực", emoji: "🎯" },
                  { value: "creative", label: "Độc lạ", emoji: "🎨" },
                  { value: "minimalist", label: "Tối giản", emoji: "🤍" },
                  { value: "luxury", label: "Cao cấp", emoji: "👑" },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleChip(styles, setStyles, o.value)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      styles.includes(o.value)
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <span>{o.emoji}</span> {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Tags</label>
                <span className="text-[10px] text-muted-foreground/60">({tagList.length}/10)</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-input bg-background p-2 min-h-[38px]">
                {tagList.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      className="ml-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={tagList.length === 0 ? "Nhập tag rồi Enter..." : ""}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                    if (e.key === "," && tagInput.trim()) {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                    if (e.key === "Backspace" && !tagInput && tagList.length > 0) {
                      removeTag(tagList.length - 1);
                    }
                  }}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                  className="flex-1 min-w-[100px] bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {["handmade", "organic", "nhập khẩu", "limited", "personalized", "eco-friendly"].map((suggestion) => (
                  !tagList.includes(suggestion) && (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => addTag(suggestion)}
                      className="text-[10px] text-muted-foreground/60 hover:text-primary border border-dashed border-muted-foreground/20 hover:border-primary/50 rounded-full px-2 py-0.5 transition-colors"
                    >
                      + {suggestion}
                    </button>
                  )
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/70">
              Thông tin này giúp AI gợi ý sản phẩm chính xác hơn cho khách hàng.
            </p>
          </div>

          {/* Ảnh hiện có (chỉ khi edit) */}
          {isEdit && product.images.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Ảnh hiện có</label>
              <div className="flex gap-2 flex-wrap">
                {product.images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={resolveImageUrl(img.url)}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    {product.images.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          deleteImage.mutate({
                            productId: product.id,
                            imageId: img.id,
                          })
                        }
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload ảnh mới */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isEdit ? "Thêm ảnh" : "Ảnh sản phẩm"} (tối đa 3)
            </label>

            {/* Preview stack */}
            {files.length > 0 && (
              <div className="relative flex items-center gap-3">
                <div
                  className="relative"
                  style={{ width: 80 + (files.length - 1) * 24, height: 96 }}
                >
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="absolute cursor-pointer rounded-xl border-2 border-white shadow-lg overflow-hidden transition-all duration-300 hover:z-30 hover:scale-110 hover:-translate-y-1"
                      style={{
                        width: 80,
                        height: 80,
                        left: i * 24,
                        top: i % 2 === 0 ? 0 : 8,
                        zIndex: i + 1,
                        transform: `rotate(${i === 0 ? -3 : i === 1 ? 2 : -1}deg)`,
                      }}
                      onClick={() => setPreviewIndex(i)}
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles(files.filter((_, fi) => fi !== i));
                          setPreviewIndex(null);
                        }}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 hover:opacity-100 transition-opacity shadow-sm"
                        style={{ zIndex: 40 }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {files.length} ảnh
                </span>
              </div>
            )}

            {(() => {
              const existingCount = isEdit ? product.images.length : 0;
              const maxNew = 3 - existingCount;
              return maxNew > 0 ? (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-4 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors w-fit">
                    <ImagePlus className="h-4 w-4" />
                    {files.length > 0 ? "Chọn lại" : "Chọn ảnh"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || []).slice(0, maxNew);
                        setFiles(selected);
                      }}
                    />
                  </label>
                  {isEdit && <p className="text-xs text-muted-foreground">Còn thêm được {maxNew} ảnh</p>}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Đã đạt tối đa 3 ảnh. Xóa ảnh cũ để thêm mới.</p>
              );
            })()}
          </div>

          {/* Lightbox */}
          {previewIndex !== null && files[previewIndex] && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
              onClick={() => setPreviewIndex(null)}
            >
              <div className="relative max-h-[85vh] max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
                <img
                  src={URL.createObjectURL(files[previewIndex])}
                  alt="Preview"
                  className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
                />
                <button
                  type="button"
                  onClick={() => setPreviewIndex(null)}
                  className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Nav arrows */}
                {files.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewIndex((previewIndex - 1 + files.length) % files.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:bg-white transition-colors text-lg"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewIndex((previewIndex + 1) % files.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:bg-white transition-colors text-lg"
                    >
                      ›
                    </button>
                  </>
                )}

                {/* Counter */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                  {previewIndex + 1} / {files.length}
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending || !name.trim() || !price}>
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {isUploading ? "Đang tải ảnh..." : isEdit ? "Cập nhật" : "Tạo sản phẩm"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
