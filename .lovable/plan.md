
# Fix Chat Page: Load All Customers

## Problem

The `/chat` page only shows 50 customers because:
1. `ChatConversationList.tsx` hardcodes `itemsPerPage = 50`
2. There is no pagination or infinite scroll to load more customers
3. You have 63 total customers, so customers #51-63 (including "Harold Than") are never loaded

## Solution Options

### Option A: Increase the Limit (Simple Fix)

Increase the hardcoded limit from 50 to a higher number (e.g., 200 or 500) to capture all customers.

**Pros:** Simple one-line change
**Cons:** May become an issue again as customer count grows; performance impact with large customer lists

### Option B: Add Infinite Scroll (Recommended)

Add infinite scrolling to the conversation list so it automatically loads more customers when scrolling near the bottom.

**Pros:** Scales to any number of customers; better UX
**Cons:** More complex implementation

---

## Implementation Plan (Option B - Recommended)

### Step 1: Add Infinite Scroll to ChatConversationList

Modify `src/components/ChatConversationList.tsx`:

1. Add state for tracking loading more customers
2. Add a scroll event listener or use Intersection Observer
3. When user scrolls near bottom, increment page and fetch more
4. Append new customers to existing list instead of replacing

```typescript
// State changes
const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
const [hasMore, setHasMore] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);

// Effect to append customers from paginated query
useEffect(() => {
  if (customersData?.customers) {
    if (page === 1) {
      setAllCustomers(customersData.customers);
    } else {
      setAllCustomers(prev => [...prev, ...customersData.customers]);
    }
    setHasMore(customersData.customers.length === itemsPerPage);
  }
}, [customersData, page]);

// Intersection Observer for infinite scroll
const loadMoreRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        setPage(prev => prev + 1);
      }
    },
    { threshold: 0.1 }
  );
  if (loadMoreRef.current) observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, [hasMore, isLoading]);
```

### Step 2: Add Loading Indicator at Bottom

Add a loading skeleton or "Load more" indicator at the bottom of the list:

```tsx
{/* At the end of the customer list */}
<div ref={loadMoreRef} className="py-2">
  {isLoadingMore && (
    <div className="flex justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )}
</div>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ChatConversationList.tsx` | Add infinite scroll with Intersection Observer, accumulate customers across pages |

---

## Alternative Quick Fix (Option A)

If you prefer a simple immediate fix, just change line 56 in `ChatConversationList.tsx`:

```typescript
// From:
const itemsPerPage = 50;

// To:
const itemsPerPage = 200;  // or higher
```

This is a one-line change but may need to be increased again as your customer base grows.

---

## Expected Outcome

After this fix:
- All 63+ customers will be accessible in the `/chat` page
- "Harold Than" chat will appear in the list
- The list will automatically load more customers as you scroll down
