

# Move Facebook Configuration to a Modal in "Connected App" Card

## What Changes

Move the Facebook Configuration form (App ID, App Secret, System User Token, Verify Token) from a standalone card at the bottom into a **Dialog/modal** that opens from a button in the **"Connected App" card** — specifically when no app info is available or when admin wants to edit.

## Implementation

### Single file change: `src/pages/FacebookPages.tsx`

1. **Add a "Configure App" button** inside the Connected App card:
   - When `!appInfo` (no app info available): Show a prominent button like "Configure App" instead of the plain "No app info available" text
   - When `appInfo` exists: Add a small "Edit Configuration" button at the bottom of the card content
   - Both only visible to admins

2. **Add state** for config dialog: `const [fbConfigDialogOpen, setFbConfigDialogOpen] = useState(false)`

3. **Wrap the existing config form** in a `<Dialog>` component instead of a `<Card>`. The form content (all 4 fields + security alert + save button + field descriptions) stays identical — just moves into `<DialogContent>`.

4. **Remove the standalone "Facebook Configuration" `<Card>`** block (lines 851-975).

5. **Connected App card updates** (lines 519-605):
   - When `!appInfo`: Replace "No app info available" with a call-to-action button + brief explanation text
   - When `appInfo` exists: Add an "Edit Configuration" icon button for admins

### No other files change. No database changes.

