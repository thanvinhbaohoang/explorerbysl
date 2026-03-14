

# Add Config Button to System User Card + Fix Modal Styling

## Changes (single file: `src/pages/FacebookPages.tsx`)

### 1. System User Card — Add Configure/Edit buttons (mirroring Connected App card)

**When no system user info** (line 690-691): Replace plain text with a call-to-action button "Configure System User" that opens the same `fbConfigDialogOpen` dialog.

**When system user exists** (after the business section, around line 688): Add an "Edit Configuration" button for admins, same pattern as the Connected App card.

### 2. Fix Modal Content Fitting

Update the `DialogContent` (line 871) to use proper width and padding:
- Change `max-w-lg` to `sm:max-w-xl` for more breathing room
- Add `p-6` padding and `space-y-4` instead of `space-y-6` to tighten spacing
- Reduce the inner spacing between form fields so everything fits without excessive scrolling

### 3. Fix Placeholder Text Color

The inputs use the default `placeholder:text-muted-foreground` class from the Input component. The `muted-foreground` in both light/dark themes is quite saturated. Add `placeholder:text-muted-foreground/50` or explicit `placeholder:text-gray-400` to the config inputs so placeholders appear properly light and distinguishable from actual values.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/FacebookPages.tsx` | Add admin buttons to System User card, fix dialog width/spacing, lighten placeholder colors on config inputs |

