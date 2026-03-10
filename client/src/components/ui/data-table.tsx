"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableColumn<T> {
  key: string
  title: string
  sortable?: boolean
  className?: string
  render?: (value: any, row: T, index: number) => React.ReactNode
}

export interface DataTableAction<T> {
  label: string
  icon?: React.ReactNode
  onClick: (row: T) => void
  variant?: "default" | "destructive"
  hidden?: (row: T) => boolean
  disabled?: (row: T) => boolean
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  actions?: DataTableAction<T>[]
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  pageSize?: number
  pageSizeOptions?: number[]
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  rowKey?: keyof T | ((row: T, index: number) => string)
  onRowClick?: (row: T) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortDirection = "asc" | "desc" | null

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj)
}

function resolveRowKey<T>(
  row: T,
  index: number,
  rowKey?: keyof T | ((row: T, index: number) => string),
): string {
  if (!rowKey) return String(index)
  if (typeof rowKey === "function") return rowKey(row, index)
  return String(row[rowKey])
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DataTableInner<T>(
  props: DataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    columns,
    data,
    actions,
    loading = false,
    emptyMessage = "Không có dữ liệu",
    emptyIcon,
    pageSize: defaultPageSize = 10,
    pageSizeOptions = [10, 20, 50],
    searchPlaceholder = "Tìm kiếm...",
    searchValue,
    onSearchChange,
    rowKey,
    onRowClick,
  } = props

  // -- Sorting state --------------------------------------------------------
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<SortDirection>(null)

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir("asc")
    } else if (sortDir === "asc") {
      setSortDir("desc")
    } else if (sortDir === "desc") {
      setSortKey(null)
      setSortDir(null)
    }
  }

  // -- Sorted data ----------------------------------------------------------
  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDir) return data

    const sorted = [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey)
      const bVal = getNestedValue(b, sortKey)

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDir === "asc" ? -1 : 1
      if (bVal == null) return sortDir === "asc" ? 1 : -1

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal
      }

      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      const cmp = aStr.localeCompare(bStr)
      return sortDir === "asc" ? cmp : -cmp
    })

    return sorted
  }, [data, sortKey, sortDir])

  // -- Pagination state -----------------------------------------------------
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(defaultPageSize)

  // Reset to page 1 when data, sort, or page size changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [data.length, sortKey, sortDir, pageSize])

  const totalItems = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)
  const paginatedData = sortedData.slice(startIndex, endIndex)

  // -- Column count (for colSpan) -------------------------------------------
  const totalColumns = columns.length + (actions && actions.length > 0 ? 1 : 0)

  // -- Render sort icon -----------------------------------------------------
  const renderSortIcon = (key: string) => {
    if (sortKey !== key || !sortDir) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
    }
    if (sortDir === "asc") {
      return <ArrowUp className="size-3.5" />
    }
    return <ArrowDown className="size-3.5" />
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {/* Search toolbar */}
      {onSearchChange && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead key={col.key} className={cn(col.className)}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded-md"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.title}
                      {renderSortIcon(col.key)}
                    </button>
                  ) : (
                    col.title
                  )}
                </TableHead>
              ))}
              {actions && actions.length > 0 && (
                <TableHead className="w-12">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* Loading state */}
            {loading &&
              Array.from({ length: 5 }).map((_, rowIdx) => (
                <TableRow key={`skeleton-${rowIdx}`} className="hover:bg-transparent">
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(col.className)}>
                      <Skeleton className="h-4 w-3/4" />
                    </TableCell>
                  ))}
                  {actions && actions.length > 0 && (
                    <TableCell>
                      <Skeleton className="size-8 rounded-md" />
                    </TableCell>
                  )}
                </TableRow>
              ))}

            {/* Empty state */}
            {!loading && paginatedData.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalColumns} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    {emptyIcon && (
                      <div className="text-muted-foreground/50">{emptyIcon}</div>
                    )}
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Data rows */}
            {!loading &&
              paginatedData.map((row, idx) => {
                const absoluteIndex = startIndex + idx
                const key = resolveRowKey(row, absoluteIndex, rowKey)

                return (
                  <TableRow
                    key={key}
                    className={cn(
                      onRowClick && "cursor-pointer",
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => {
                      const value = getNestedValue(row, col.key)
                      return (
                        <TableCell
                          key={col.key}
                          className={cn("text-sm", col.className)}
                        >
                          {col.render
                            ? col.render(value, row, absoluteIndex)
                            : (value ?? "—")}
                        </TableCell>
                      )
                    })}
                    {actions && actions.length > 0 && (
                      <TableCell
                        className="w-12"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionsDropdown actions={actions} row={row} />
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {!loading && totalItems > 0 && (
        <div className="flex items-center justify-between border-t pt-4">
          {/* Left: info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Hiển thị {startIndex + 1}-{endIndex} / {totalItems}
            </span>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap">Số dòng</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => setPageSize(Number(val))}
              >
                <SelectTrigger size="sm" className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false}>
                  {pageSizeOptions.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right: page controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(1)}
              disabled={safePage <= 1}
              aria-label="Trang đầu"
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Trang trước"
            >
              <ChevronLeft />
            </Button>
            <span className="px-2 text-sm text-muted-foreground tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Trang sau"
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage >= totalPages}
              aria-label="Trang cuối"
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Actions dropdown (extracted to avoid re-renders)
// ---------------------------------------------------------------------------

function ActionsDropdown<T>({
  actions,
  row,
}: {
  actions: DataTableAction<T>[]
  row: T
}) {
  const visibleActions = actions.filter((a) => !a.hidden?.(row))
  if (visibleActions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal />
            <span className="sr-only">Mở menu</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {visibleActions.map((action, idx) => (
          <React.Fragment key={action.label}>
            {idx > 0 &&
              action.variant === "destructive" &&
              visibleActions[idx - 1]?.variant !== "destructive" && (
                <DropdownMenuSeparator />
              )}
            <DropdownMenuItem
              variant={action.variant}
              disabled={action.disabled?.(row)}
              onClick={() => action.onClick(row)}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// Forwarded ref with generics
// ---------------------------------------------------------------------------

export const DataTable = React.forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement
