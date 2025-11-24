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
import { ArrowUpDown, Calendar as CalendarIcon } from "lucide-react";
import { TableSkeleton } from "./TableSkeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TrafficData {
  id: string;
  facebook_click_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_adset_id: string | null;
  utm_ad_id: string | null;
  utm_campaign_id: string | null;
  referrer: string | null;
  created_at: string;
  customer: {
    id: string;
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export const TrafficTable = () => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "traffic",
      pagination.pageIndex,
      pagination.pageSize,
      debouncedSearch,
      sourceFilter,
      campaignFilter,
      dateFrom,
      dateTo,
      sorting,
    ],
    queryFn: async () => {
      const sortParam = sorting[0]
        ? `${sorting[0].id}_${sorting[0].desc ? "desc" : "asc"}`
        : "created_at_desc";

      const { data, error } = await supabase.functions.invoke("fetch-traffic", {
        body: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          search: debouncedSearch,
          filter_source: sourceFilter,
          filter_campaign: campaignFilter,
          date_from: dateFrom ? format(dateFrom, "yyyy-MM-dd") : "",
          date_to: dateTo ? format(dateTo, "yyyy-MM-dd") : "",
          sort: sortParam,
        },
      });

      if (error) throw error;
      return data;
    },
  });

  const columns: ColumnDef<TrafficData>[] = [
    {
      accessorKey: "id",
      header: "Token ID",
      cell: ({ row }) => (
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {row.original.id.slice(0, 8)}...
        </code>
      ),
    },
    {
      accessorKey: "utm_source",
      header: "Ad Source",
      cell: ({ row }) => {
        const { facebook_click_id, utm_source } = row.original;
        if (facebook_click_id) {
          return (
            <Badge variant="default">FB: {facebook_click_id.slice(0, 8)}...</Badge>
          );
        } else if (utm_source) {
          return (
            <Badge variant="secondary">
              {utm_source.charAt(0).toUpperCase() + utm_source.slice(1)}
            </Badge>
          );
        }
        return <Badge variant="outline">Direct</Badge>;
      },
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) =>
        row.original.customer ? (
          <div>
            {row.original.customer.first_name} {row.original.customer.last_name}
          </div>
        ) : (
          <span className="text-muted-foreground italic">Not linked</span>
        ),
    },
    {
      accessorKey: "telegram_id",
      header: "Telegram ID",
      cell: ({ row }) =>
        row.original.customer ? (
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {row.original.customer.telegram_id}
          </code>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) =>
        row.original.customer?.username ? (
          <span className="text-muted-foreground">
            @{row.original.customer.username}
          </span>
        ) : (
          <span className="text-muted-foreground italic">No username</span>
        ),
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.original.created_at).toLocaleString()}
        </span>
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
      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Search by FBCLID, source, or campaign..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Sources</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="telegram">Telegram</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by campaign..."
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="max-w-[200px]"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[200px] justify-start text-left font-normal",
                !dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "PPP") : <span>From date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[200px] justify-start text-left font-normal",
                !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "PPP") : <span>To date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} columns={6} />
      ) : isError ? (
        <div className="text-center py-8 text-destructive">
          Failed to load traffic data
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
                    No traffic data found.
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
            of {data?.total || 0} records
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
