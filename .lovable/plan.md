

# Remove "Vessels Of Soul" Page from the App

## What's There
- One Facebook page record: **Vessels Of Soul** (page_id: `561589463698263`, is_active: true)
- 1 customer linked to this page

## Plan

### Database Migration
Run a migration to:
1. **Deactivate and delete** the `facebook_pages` row for "Vessels Of Soul" (`id = 'c62c8cb3-ab5b-413b-8306-be6445ddcae1'`)
2. **Nullify** the `page_id` on the 1 customer record linked to it (so the customer data isn't lost, just unlinked)

```sql
UPDATE customer SET page_id = NULL WHERE page_id = '561589463698263';
DELETE FROM facebook_pages WHERE id = 'c62c8cb3-ab5b-413b-8306-be6445ddcae1';
```

No code file changes needed — the UI already renders pages dynamically from the `facebook_pages` table.

| Change | Detail |
|--------|--------|
| Migration | Remove Vessels Of Soul page, unlink 1 customer |

