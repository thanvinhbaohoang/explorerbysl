

# Customers Page Filters & Search Debounce for Both Pages

## Overview

This plan adds consistent filtering and pagination to the Customers page (matching Traffic) and implements search debounce on both pages to prevent excessive API calls while typing.

## Current State

| Feature | Traffic Page | Customers Page |
|---------|--------------|----------------|
| Global Search | ✅ Has search box | ❌ No search |
| Platform Filter | ✅ Dropdown | ❌ None |
| Post Tag/Source Filter | ✅ Multiple dropdowns | ❌ None |
| Smart Pagination | ✅ Ellipsis pagination | ❌ Shows all page numbers (overflows) |
| Search Debounce | ❌ Fires on every keystroke | N/A |

## Implementation Plan

### Part 1: Add Debounce to Traffic Page Search

**File: `src/pages/Traffic.tsx`**

Add a debounced search term to prevent the search from firing a database query on every keystroke.

```typescript
// New state for debounced value
const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

// Debounce effect - waits 500ms after user stops typing
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearchTerm(searchTerm);
  }, 500);
  return () => clearTimeout(timer);
}, [searchTerm]);

// Use debouncedSearchTerm instead of searchTerm in the hook
const { data: trafficResult, isLoading: isLoadingTraffic } = useTrafficData({
  page: trafficPage,
  searchTerm: debouncedSearchTerm, // Changed from searchTerm
  // ... rest of params
});
```

Also remove `disabled={isLoadingTraffic}` from the search input so users can continue typing while data loads.

---

### Part 2: Add Filters and Smart Pagination to Customers Page

**File: `src/pages/Customers.tsx`**

#### 2a. Add Required Imports

```typescript
import { PaginationEllipsis } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
```

#### 2b. Add Smart Pagination Helper

Copy the `getPageNumbers` function from Traffic.tsx:

```typescript
const getPageNumbers = (currentPage: number, totalPages: number): (number | 'ellipsis')[] => {
  const maxVisible = 5;
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  
  const pages: (number | 'ellipsis')[] = [];
  pages.push(1);
  
  const rangeStart = Math.max(2, currentPage - 1);
  const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
  
  if (rangeStart > 2) pages.push('ellipsis');
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
  if (rangeEnd < totalPages - 1) pages.push('ellipsis');
  if (totalPages > 1) pages.push(totalPages);
  
  return pages;
};
```

#### 2c. Add Search and Filter State

```typescript
// Search and filters
const [searchTerm, setSearchTerm] = useState("");
const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
const [customerPlatformFilter, setCustomerPlatformFilter] = useState<string>("all");

// Debounce search
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearchTerm(searchTerm);
    setCustomersPage(1); // Reset to page 1 on search
  }, 500);
  return () => clearTimeout(timer);
}, [searchTerm]);
```

#### 2d. Client-Side Filtering (immediate, no API changes needed)

Filter the customers array based on search term and platform:

```typescript
const filteredCustomers = useMemo(() => {
  let filtered = customers;
  
  // Platform filter
  if (customerPlatformFilter === 'telegram') {
    filtered = filtered.filter(c => c.telegram_id && !c.messenger_id);
  } else if (customerPlatformFilter === 'messenger') {
    filtered = filtered.filter(c => c.messenger_id);
  }
  
  // Search filter
  if (debouncedSearchTerm) {
    const search = debouncedSearchTerm.toLowerCase();
    filtered = filtered.filter(c => {
      const name = c.messenger_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
      const username = c.username || '';
      const sourceTag = c.lead_source?.messenger_ref || '';
      const campaign = c.lead_source?.campaign_name || '';
      return name.toLowerCase().includes(search) ||
             username.toLowerCase().includes(search) ||
             sourceTag.toLowerCase().includes(search) ||
             campaign.toLowerCase().includes(search);
    });
  }
  
  return filtered;
}, [customers, customerPlatformFilter, debouncedSearchTerm]);
```

#### 2e. Add Filter UI Before Table

Insert a filter section below CardHeader and before the table:

```text
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Search customers, source tags...        ]  [Platform ▼] │
│                                                             │
│ Active filters: 2                              [Clear All]  │
└─────────────────────────────────────────────────────────────┘
```

```jsx
{/* Search and Filters */}
<div className="flex flex-col sm:flex-row gap-3 mb-4">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Search name, source tag, campaign..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-9"
    />
  </div>
  
  <Select value={customerPlatformFilter} onValueChange={setCustomerPlatformFilter}>
    <SelectTrigger className="w-full sm:w-[150px]">
      <SelectValue placeholder="Platform" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Platforms</SelectItem>
      <SelectItem value="messenger">Messenger</SelectItem>
      <SelectItem value="telegram">Telegram</SelectItem>
    </SelectContent>
  </Select>
</div>
```

#### 2f. Update Pagination to Use Smart Ellipsis

Replace the current pagination that shows all pages:

```jsx
{/* Before */}
{Array.from({ length: totalCustomerPages }, (_, i) => i + 1).map((page) => (
  <PaginationItem key={page}>
    <PaginationLink ... />
  </PaginationItem>
))}

{/* After */}
{getPageNumbers(customersPage, totalCustomerPages).map((page, index) => (
  <PaginationItem key={index}>
    {page === 'ellipsis' ? (
      <PaginationEllipsis />
    ) : (
      <PaginationLink
        onClick={() => setCustomersPage(page)}
        isActive={page === customersPage}
        className="cursor-pointer"
      >
        {page}
      </PaginationLink>
    )}
  </PaginationItem>
))}
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/pages/Traffic.tsx` | Add debounced search (500ms delay), remove disabled state from search input while loading |
| `src/pages/Customers.tsx` | Add search input with debounce, platform filter dropdown, smart pagination with ellipsis, `getPageNumbers` helper function |

## User Experience After Changes

### Traffic Page
- **Before**: Every keystroke triggers a database query, search input is disabled while loading
- **After**: Search waits 500ms after user stops typing before querying, input stays enabled

### Customers Page  
- **Before**: No search, no filters, pagination breaks with many pages
- **After**: 
  - Search box filters by name, username, source tag, campaign
  - Platform dropdown to filter Telegram vs Messenger
  - Smart pagination shows max 7 page buttons with ellipsis

### Pagination Visual

```text
Before (100+ pages): [<] [1] [2] [3] [4] [5] ... [98] [99] [100] [>] ← overflows

After (100+ pages, on page 50): [<] [1] [...] [49] [50] [51] [...] [100] [>] ← fits perfectly
```

