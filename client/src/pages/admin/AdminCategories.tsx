import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type DataTableAction } from "@/components/ui/data-table";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from "@/hooks/useGifts";
import {
  Plus,
  Pencil,
  Trash2,
  FolderTree,
  Save,
  X,
  Loader2,
} from "lucide-react";

// Flatten tree for table display
function flattenCategories(categories: Category[], depth = 0): (Category & { _depth: number })[] {
  const result: (Category & { _depth: number })[] = [];
  for (const cat of categories) {
    result.push({ ...cat, _depth: depth });
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children, depth + 1));
    }
  }
  return result;
}

type FlatCategory = Category & { _depth: number };

export default function AdminCategories() {
  const { data: categories, isLoading } = useCategories();
  const deleteCategory = useDeleteCategory();
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  const flat = categories ? flattenCategories(categories) : [];

  const columns: DataTableColumn<FlatCategory>[] = [
    {
      key: "name",
      title: "Tên danh mục",
      sortable: true,
      render: (_val, row) => (
        <div className="flex items-center gap-2" style={{ paddingLeft: row._depth * 24 }}>
          {row._depth > 0 && <span className="text-muted-foreground">└</span>}
          <span className="font-medium">{row.name}</span>
          {row.children && row.children.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {row.children.length} con
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "slug",
      title: "Slug",
      className: "hidden md:table-cell text-muted-foreground",
      render: (val) => <code className="text-xs">{val}</code>,
    },
    {
      key: "description",
      title: "Mô tả",
      className: "hidden lg:table-cell max-w-[250px]",
      render: (val) => (
        <span className="text-xs text-muted-foreground truncate block">
          {val || "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      title: "Ngày tạo",
      sortable: true,
      className: "hidden lg:table-cell",
      render: (val) => (
        <span className="text-xs">
          {new Date(val).toLocaleDateString("vi-VN")}
        </span>
      ),
    },
  ];

  const actions: DataTableAction<FlatCategory>[] = [
    {
      label: "Chỉnh sửa",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (row) => {
        setEditCategory(row);
        setShowForm(true);
      },
    },
    {
      label: "Xóa danh mục",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (row) => {
        if (confirm(`Xóa danh mục "${row.name}"?`)) deleteCategory.mutate(row.id);
      },
      variant: "destructive",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Danh mục ({flat.length})
        </h2>
        <Button
          size="sm"
          onClick={() => {
            setEditCategory(null);
            setShowForm(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Thêm danh mục
        </Button>
      </div>

      {showForm && (
        <CategoryForm
          category={editCategory}
          allCategories={flat}
          onClose={() => {
            setShowForm(false);
            setEditCategory(null);
          }}
        />
      )}

      <DataTable<FlatCategory>
        columns={columns}
        data={flat}
        actions={actions}
        loading={isLoading}
        rowKey="id"
        emptyMessage="Chưa có danh mục nào"
        emptyIcon={<FolderTree className="h-10 w-10" />}
      />
    </div>
  );
}

function CategoryForm({
  category,
  allCategories,
  onClose,
}: {
  category: Category | null;
  allCategories: FlatCategory[];
  onClose: () => void;
}) {
  const isEdit = !!category;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [parentId, setParentId] = useState(category?.parent_id ?? "");

  const isPending = createCategory.isPending || updateCategory.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      parent_id: parentId || null,
    };

    try {
      if (isEdit) {
        await updateCategory.mutateAsync({ categoryId: category.id, ...payload });
      } else {
        await createCategory.mutateAsync(payload);
      }
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  // Filter out current category and its children from parent options
  const parentOptions = allCategories.filter(
    (c) => !isEdit || (c.id !== category.id)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {isEdit ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}
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
              <label className="text-sm font-medium">Tên danh mục *</label>
              <Input
                placeholder="VD: Hoa tươi, Socola..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Danh mục cha</label>
              <select
                className="flex h-8 w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">-- Không (top-level) --</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat(c._depth)}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mô tả</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground"
              placeholder="Mô tả ngắn về danh mục..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {isEdit ? "Cập nhật" : "Tạo danh mục"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
          </div>

          {(createCategory.isError || updateCategory.isError) && (
            <p className="text-sm text-destructive text-center">
              Đã có lỗi xảy ra. Vui lòng thử lại.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
