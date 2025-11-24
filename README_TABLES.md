# Scalable Tables Documentation

## Overview

This project uses **TanStack Table v8**, **React Query**, and **Supabase Edge Functions** to implement high-performance, scalable tables with server-side pagination, filtering, searching, and sorting.

The implementation is optimized for datasets with 50,000+ rows and provides:
- ✅ Server-side pagination (only fetches 10 rows at a time)
- ✅ Debounced search (300ms delay)
- ✅ Multiple filters (status, source, campaign, date range)
- ✅ Column sorting
- ✅ React Query caching
- ✅ Loading skeletons

---

## Architecture

### Backend (Supabase Edge Functions)

Two edge functions handle data fetching:

1. **`fetch-customers`** - `/functions/fetch-customers/index.ts`
   - Handles customer data with pagination
   - Supports search across name, username, and Telegram ID
   - Filters by status (premium/standard)
   - Sorting by any column

2. **`fetch-traffic`** - `/functions/fetch-traffic/index.ts`
   - Handles traffic/leads data with pagination
   - Supports search across FBCLID, source, campaign
   - Filters by source, campaign, and date range
   - Sorting by any column

### Frontend Components

1. **`CustomersTable.tsx`** - Customers table with TanStack Table
2. **`TrafficTable.tsx`** - Traffic table with TanStack Table
3. **`Dashboard.tsx`** - Main dashboard page
4. **`TableSkeleton.tsx`** - Loading skeleton component

---

## How to Extend

### Adding New Columns

#### 1. Update the Interface

```typescript
// In CustomersTable.tsx or TrafficTable.tsx
interface Customer {
  id: string;
  telegram_id: number;
  // ... existing fields
  new_field: string; // ADD NEW FIELD
}
```

#### 2. Add Column Definition

```typescript
const columns: ColumnDef<Customer>[] = [
  // ... existing columns
  {
    accessorKey: "new_field",
    header: "New Field",
    cell: ({ row }) => (
      <span>{row.original.new_field}</span>
    ),
  },
];
```

#### 3. Update Edge Function (if needed)

If the new field requires special querying:

```typescript
// In supabase/functions/fetch-customers/index.ts
let query = supabaseClient
  .from('customer')
  .select('*, new_field') // Add field to select
```

---

### Adding New Filters

#### 1. Add State for Filter

```typescript
const [newFilter, setNewFilter] = useState("");
```

#### 2. Add to Query Key (for React Query caching)

```typescript
const { data } = useQuery({
  queryKey: [
    "customers",
    pagination.pageIndex,
    pagination.pageSize,
    debouncedSearch,
    statusFilter,
    newFilter, // ADD HERE
    sorting,
  ],
  // ...
});
```

#### 3. Add Filter UI

```typescript
<Select value={newFilter} onValueChange={setNewFilter}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Filter by..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">All</SelectItem>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

#### 4. Send to Backend

```typescript
const { data } = await supabase.functions.invoke("fetch-customers", {
  body: {
    // ... existing params
    filter_new: newFilter, // ADD HERE
  },
});
```

#### 5. Handle in Edge Function

```typescript
// In fetch-customers/index.ts
const filterNew = url.searchParams.get('filter_new') || '';

if (filterNew) {
  query = query.eq('new_field', filterNew);
}
```

---

### Adding Date Range Filters

Date range filters are already implemented in `TrafficTable.tsx`. To add to customers:

```typescript
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

const [dateFrom, setDateFrom] = useState<Date | undefined>();
const [dateTo, setDateTo] = useState<Date | undefined>();

// In UI
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
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
```

---

### Customizing Page Size

Change the default page size:

```typescript
const [pagination, setPagination] = useState<PaginationState>({
  pageIndex: 0,
  pageSize: 20, // Change from 10 to 20
});
```

---

### Adding Sorting to New Columns

Sorting is automatic for most columns. To add a sort button:

```typescript
{
  accessorKey: "column_name",
  header: ({ column }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      Column Name
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  ),
  cell: ({ row }) => <span>{row.original.column_name}</span>,
}
```

---

## Database Optimization

### Recommended Indexes

For optimal performance with large datasets:

```sql
-- Customer table indexes
CREATE INDEX idx_customer_created_at ON customer(created_at DESC);
CREATE INDEX idx_customer_first_name ON customer(first_name);
CREATE INDEX idx_customer_username ON customer(username);
CREATE INDEX idx_customer_telegram_id ON customer(telegram_id);
CREATE INDEX idx_customer_is_premium ON customer(is_premium);

-- Messages table indexes
CREATE INDEX idx_messages_customer_unread ON messages(customer_id, sender_type, is_read) 
  WHERE is_read = FALSE;

-- Traffic/leads table indexes
CREATE INDEX idx_telegram_leads_created_at ON telegram_leads(created_at DESC);
CREATE INDEX idx_telegram_leads_utm_source ON telegram_leads(utm_source);
CREATE INDEX idx_telegram_leads_utm_campaign ON telegram_leads(utm_campaign);
CREATE INDEX idx_telegram_leads_fbclid ON telegram_leads(facebook_click_id);
```

---

## Performance Tips

1. **Always use server-side pagination** - Never fetch all rows
2. **Debounce search inputs** - Prevents excessive API calls
3. **Use React Query** - Provides automatic caching and refetching
4. **Add database indexes** - Critical for large datasets
5. **Limit SELECT columns** - Only fetch what you need
6. **Use skeleton loaders** - Better UX during loading

---

## API Query Parameters

### Customers Endpoint

```
GET /functions/fetch-customers
?page=1
&pageSize=10
&search=john
&filter_status=premium
&sort=created_at_desc
```

### Traffic Endpoint

```
GET /functions/fetch-traffic
?page=1
&pageSize=10
&search=facebook
&filter_source=facebook
&filter_campaign=spring_sale
&date_from=2025-01-01
&date_to=2025-12-31
&sort=created_at_desc
```

---

## Troubleshooting

### Tables not loading
- Check edge function logs in Supabase dashboard
- Verify database permissions and RLS policies
- Check network tab for API errors

### Slow performance
- Add database indexes (see above)
- Reduce pageSize
- Check if search queries are optimized with ILIKE

### Filters not working
- Verify filter values are being sent to backend
- Check edge function logs
- Ensure database columns exist

---

## Future Enhancements

- [ ] Export to CSV functionality
- [ ] Column visibility toggle
- [ ] Column resizing
- [ ] Multi-select bulk actions
- [ ] Advanced filtering (AND/OR logic)
- [ ] Save filter presets
- [ ] Real-time updates with Supabase subscriptions
