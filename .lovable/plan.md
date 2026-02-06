

# Show All Database Columns in Traffic & Customers Tables

## Overview

This plan adds the ability to view all database columns in both the Traffic (/traffic) and Customers (/customers) tables. Since showing 20+ columns at once would be overwhelming, we'll implement a column visibility toggle feature that allows users to show/hide columns as needed.

## Current vs Available Columns

### Traffic Table (telegram_leads)

| Currently Shown | Available but Hidden |
|-----------------|----------------------|
| Platform | facebook_click_id |
| Customer | campaign_id |
| Status (new/existing) | campaign_name |
| Traffic Source (combined) | ad_id |
| Created At | ad_name |
| | adset_id |
| | adset_name |
| | utm_source |
| | utm_medium |
| | utm_campaign |
| | utm_content |
| | utm_term |
| | utm_adset_id |
| | utm_ad_id |
| | utm_campaign_id |
| | referrer |
| | messenger_ref |
| | messenger_ad_context |
| | updated_at |

### Customers Table (customer)

| Currently Shown | Available but Hidden |
|-----------------|----------------------|
| Platform | telegram_id |
| Name | messenger_id |
| Username/ID | language_code |
| Language | locale |
| Source | timezone_offset |
| First Message | page_id |
| Last Message | is_premium |
| Actions | created_at |
| | updated_at |
| | legal_first_name |
| | legal_middle_name |
| | legal_last_name |
| | sex |
| | passport_number |
| | nationality |
| | national_id |

## Implementation Approach

### Feature: Column Visibility Toggle

Add a "Columns" dropdown button next to the filters that allows users to toggle visibility of individual columns.

```text
+-----------------------------------------------+
| [Search...] [Platform v] [Columns ▼] [Export] |
+-----------------------------------------------+
         ↓ (when clicked)
    ┌─────────────────────┐
    │ ✓ Platform          │
    │ ✓ Customer          │
    │ ✓ Status            │
    │ ✓ Traffic Source    │
    │ ✓ Created At        │
    │ ─────────────────── │
    │ ○ UTM Source        │
    │ ○ UTM Medium        │
    │ ○ UTM Campaign      │
    │ ○ Campaign Name     │
    │ ○ Ad Name           │
    │ ... more columns    │
    │ ─────────────────── │
    │ [Show All] [Reset]  │
    └─────────────────────┘
```

### Technical Implementation

#### 1. Create a Shared Column Visibility Hook

**New File: `src/hooks/useColumnVisibility.ts`**

```typescript
import { useState, useCallback, useMemo } from "react";

interface ColumnConfig {
  key: string;
  header: string;
  defaultVisible: boolean;
  getValue?: (row: any) => React.ReactNode;
}

export const useColumnVisibility = (columns: ColumnConfig[], storageKey: string) => {
  // Load from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) return new Set(JSON.parse(stored));
    return new Set(columns.filter(c => c.defaultVisible).map(c => c.key));
  });

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      localStorage.setItem(storageKey, JSON.stringify([...newSet]));
      return newSet;
    });
  }, [storageKey]);

  const showAll = useCallback(() => {
    const all = new Set(columns.map(c => c.key));
    setVisibleColumns(all);
    localStorage.setItem(storageKey, JSON.stringify([...all]));
  }, [columns, storageKey]);

  const reset = useCallback(() => {
    const defaults = new Set(columns.filter(c => c.defaultVisible).map(c => c.key));
    setVisibleColumns(defaults);
    localStorage.setItem(storageKey, JSON.stringify([...defaults]));
  }, [columns, storageKey]);

  const visibleColumnConfigs = useMemo(() => 
    columns.filter(c => visibleColumns.has(c.key)),
  [columns, visibleColumns]);

  return { visibleColumns, toggleColumn, showAll, reset, visibleColumnConfigs };
};
```

#### 2. Create Column Visibility Dropdown Component

**New File: `src/components/ColumnVisibilityDropdown.tsx`**

A dropdown with checkboxes for each column, plus "Show All" and "Reset to Default" buttons.

#### 3. Update Traffic Page

**File: `src/pages/Traffic.tsx`**

Define all available columns with their render logic:

```typescript
const trafficColumns: ColumnConfig[] = [
  { key: 'platform', header: 'Platform', defaultVisible: true },
  { key: 'customer', header: 'Customer', defaultVisible: true },
  { key: 'status', header: 'Status', defaultVisible: true },
  { key: 'traffic_source', header: 'Traffic Source', defaultVisible: true },
  { key: 'created_at', header: 'Created At', defaultVisible: true },
  // Additional columns (hidden by default)
  { key: 'utm_source', header: 'UTM Source', defaultVisible: false },
  { key: 'utm_medium', header: 'UTM Medium', defaultVisible: false },
  { key: 'utm_campaign', header: 'UTM Campaign', defaultVisible: false },
  { key: 'utm_content', header: 'UTM Content', defaultVisible: false },
  { key: 'utm_term', header: 'UTM Term', defaultVisible: false },
  { key: 'campaign_id', header: 'Campaign ID', defaultVisible: false },
  { key: 'campaign_name', header: 'Campaign Name', defaultVisible: false },
  { key: 'ad_id', header: 'Ad ID', defaultVisible: false },
  { key: 'ad_name', header: 'Ad Name', defaultVisible: false },
  { key: 'adset_id', header: 'Adset ID', defaultVisible: false },
  { key: 'adset_name', header: 'Adset Name', defaultVisible: false },
  { key: 'messenger_ref', header: 'Post Tag', defaultVisible: false },
  { key: 'facebook_click_id', header: 'FB Click ID', defaultVisible: false },
  { key: 'referrer', header: 'Referrer', defaultVisible: false },
  { key: 'updated_at', header: 'Updated At', defaultVisible: false },
];
```

#### 4. Update Customers Page

**File: `src/pages/Customers.tsx`**

Define all available columns:

```typescript
const customerColumns: ColumnConfig[] = [
  { key: 'platform', header: 'Platform', defaultVisible: true },
  { key: 'name', header: 'Name', defaultVisible: true },
  { key: 'username_id', header: 'Username / ID', defaultVisible: true },
  { key: 'language', header: 'Language', defaultVisible: true },
  { key: 'source', header: 'Source', defaultVisible: true },
  { key: 'first_message', header: 'First Message', defaultVisible: true },
  { key: 'last_message', header: 'Last Message', defaultVisible: true },
  { key: 'actions', header: 'Actions', defaultVisible: true },
  // Additional columns (hidden by default)
  { key: 'telegram_id', header: 'Telegram ID', defaultVisible: false },
  { key: 'messenger_id', header: 'Messenger ID', defaultVisible: false },
  { key: 'language_code', header: 'Language Code', defaultVisible: false },
  { key: 'locale', header: 'Locale', defaultVisible: false },
  { key: 'timezone_offset', header: 'Timezone', defaultVisible: false },
  { key: 'page_id', header: 'Page ID', defaultVisible: false },
  { key: 'is_premium', header: 'Premium', defaultVisible: false },
  { key: 'created_at', header: 'Created At', defaultVisible: false },
  { key: 'updated_at', header: 'Updated At', defaultVisible: false },
  { key: 'legal_first_name', header: 'Legal First Name', defaultVisible: false },
  { key: 'legal_middle_name', header: 'Legal Middle Name', defaultVisible: false },
  { key: 'legal_last_name', header: 'Legal Last Name', defaultVisible: false },
  { key: 'sex', header: 'Sex', defaultVisible: false },
  { key: 'passport_number', header: 'Passport Number', defaultVisible: false },
  { key: 'nationality', header: 'Nationality', defaultVisible: false },
  { key: 'national_id', header: 'National ID', defaultVisible: false },
];
```

#### 5. Update Data Hooks

**File: `src/hooks/useTrafficData.ts`**

Update the query to fetch all columns instead of specific ones:

```typescript
// Before
let dataQuery = supabase.from("telegram_leads").select("id, facebook_click_id, utm_source, ...");

// After
let dataQuery = supabase.from("telegram_leads").select("*");
```

**File: `src/hooks/useCustomersData.ts`**

Already fetches all columns via `.select("*")` - no changes needed.

## UI Changes

### Traffic Page Filter Row

```text
Before:
[Search...] [Status v] [Platform v] [Post Tag v] [Source v] [Campaign v] [Date Range v]

After:
[Search...] [Status v] [Platform v] [Post Tag v] [Source v] [Campaign v] [Date Range v] [⚙️ Columns v]
```

### Customers Page Filter Row

```text
Before:
[Search...] [Platform v]

After:
[Search...] [Platform v] [⚙️ Columns v]
```

## Summary of Changes

| File | Changes |
|------|---------|
| `src/hooks/useColumnVisibility.ts` | New - shared hook for column visibility state with localStorage persistence |
| `src/components/ColumnVisibilityDropdown.tsx` | New - dropdown UI component with checkboxes and show all/reset buttons |
| `src/pages/Traffic.tsx` | Add column definitions array, use visibility hook, render dynamic table headers/cells |
| `src/pages/Customers.tsx` | Add column definitions array, use visibility hook, render dynamic table headers/cells |
| `src/hooks/useTrafficData.ts` | Update to fetch all columns (change from explicit select to `*`) |

## User Experience

1. **Default view** - Shows the same columns as before (no breaking change)
2. **Expand columns** - Click "Columns" dropdown to toggle individual columns on/off
3. **Show everything** - "Show All" button reveals all database columns
4. **Reset** - "Reset to Default" restores the original column visibility
5. **Persistence** - Column preferences are saved to localStorage per table
6. **Horizontal scroll** - Table container will scroll horizontally when many columns are visible

