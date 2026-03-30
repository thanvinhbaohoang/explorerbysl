

# Search Dropdown for Chat Customer Lookup

## Problem
The current search filters the entire conversation list inline, causing re-renders and a janky experience. Users want a quick lookup dropdown instead.

## Approach
Replace the inline filter-search with a **Popover + Command** pattern (like a spotlight/command palette). When the user types in the search input, a dropdown appears below it showing matching customers. Selecting a customer from the dropdown opens their chat directly — without filtering the main conversation list.

The main list stays untouched during search. The search only controls the dropdown results.

## Changes

### `src/components/ChatConversationList.tsx`

1. **Decouple search from list filtering** — Remove `debouncedSearch` from the `filteredBySearch` memo so the conversation list always shows all customers regardless of search input.

2. **Add a search results dropdown** — Use `Popover` (anchored to the search input) that opens when the input has text and closes when cleared or a result is clicked. Inside the popover, render a simple list of matching customers (name, platform icon, avatar) — max ~6 results.

3. **Search logic** — Query `allCustomers` client-side (already loaded) with a simple `.filter()` on name/username. Show results immediately, no debounce needed since it's just array filtering with no side effects.

4. **On select** — Call `onSelect(customer)` and clear the search input, closing the dropdown. The conversation list remains unchanged.

5. **Keyboard support** — Use arrow keys to navigate results, Enter to select. The `Command` component from shadcn/ui handles this natively.

### Implementation Detail

```
Search Input (always enabled, never disables)
  └─ Popover (open when searchQuery.length > 0)
       └─ Command + CommandList
            └─ CommandItem per matching customer (avatar + name + platform badge)
                 └─ onClick → onSelect(customer), clear search
```

- Import `Popover`, `PopoverContent`, `PopoverAnchor` from existing UI components
- Import `Command`, `CommandList`, `CommandItem`, `CommandEmpty` from existing UI components
- Remove the `debouncedSearch` state and its effect — not needed anymore
- Keep `searchQuery` state for the input value only
- Filter matches inline: `allCustomers.filter(...)` capped at 8 results
- The existing filter tabs (All / Awaiting Reply) and conversation list remain completely independent of search

## Files Changed

| File | Change |
|------|--------|
| `src/components/ChatConversationList.tsx` | Replace inline search filtering with a Command dropdown popover |

