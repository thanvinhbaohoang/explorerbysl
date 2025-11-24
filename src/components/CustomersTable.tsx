import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ArrowUpDown } from "lucide-react";
import { TableSkeleton } from "./TableSkeleton";
import { useDebounce } from "@/hooks/useDebounce";

interface Customer {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  is_premium: boolean;
  first_message_at: string;
  created_at: string;
}

interface CustomersTableProps {
  onViewMessages: (customer: Customer) => void;
  unreadCounts: Record<string, number>;
}

export const CustomersTable = ({ onViewMessages, unreadCounts }: CustomersTableProps) => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "customers",
      pagination.pageIndex,
      pagination.pageSize,
      debouncedSearch,
      statusFilter,
      sorting,
    ],
    queryFn: async () => {
      const sortParam = sorting[0]
        ? `${sorting[0].id}_${sorting[0].desc ? "desc" : "asc"}`
        : "created_at_desc";

      const { data, error } = await supabase.functions.invoke("fetch-customers", {
        body: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          search: debouncedSearch,
          filter_status: statusFilter,
          sort: sortParam,
        },
      });

      if (error) throw error;
      return data;
    },
  });

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "first_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.first_name} {row.original.last_name}
        </div>
      ),
    },
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) =>
        row.original.username ? (
          <span className="text-muted-foreground">@{row.original.username}</span>
        ) : (
          <span className="text-muted-foreground italic">No username</span>
        ),
    },
    {
      accessorKey: "telegram_id",
      header: "Telegram ID",
      cell: ({ row }) => (
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {row.original.telegram_id}
        </code>
      ),
    },
    {
      accessorKey: "language_code",
      header: "Language",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.language_code || "Unknown"}</Badge>
      ),
    },
    {
      accessorKey: "is_premium",
      header: "Status",
      cell: ({ row }) =>
        row.original.is_premium ? (
          <Badge variant="default">Premium</Badge>
        ) : (
          <Badge variant="secondary">Standard</Badge>
        ),
    },
    {
      accessorKey: "first_message_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          First Message
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.original.first_message_at).toLocaleString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewMessages(row.original)}
          className="relative"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Telegram
          {unreadCounts[row.original.id] > 0 && (
            <Badge
              variant="destructive"
              className="ml-2 px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
            >
              {unreadCounts[row.original.id]}
            </Badge>
          )}
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.data || [],
    columns,
    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const totalPages = table.getPageCount();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search by name, username, or Telegram ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} columns={7} />
      ) : isError ? (
        <div className="text-center py-8 text-destructive">
          Failed to load customers
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing{" "}
            {pagination.pageIndex * pagination.pageSize + 1}-
            {Math.min(
              (pagination.pageIndex + 1) * pagination.pageSize,
              data?.total || 0
            )}{" "}
            of {data?.total || 0} customers
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => table.previousPage()}
                  className={
                    !table.getCanPreviousPage()
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const page = i + Math.max(0, pagination.pageIndex - 2);
                if (page >= totalPages) return null;
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => table.setPageIndex(page)}
                      isActive={page === pagination.pageIndex}
                      className="cursor-pointer"
                    >
                      {page + 1}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => table.nextPage()}
                  className={
                    !table.getCanNextPage()
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};
