

# Fix: Chat Modal Cut Off / Page Scrolling on Open

## Root Cause

When the chat dialog opens on the `/customers` page, the browser auto-focuses an element inside the dialog. On long pages, this focus event triggers the browser to scroll the page down to where it thinks the element is in the DOM flow -- even though the dialog is `position: fixed`. This causes the page to jump to the bottom, making the modal appear half cut off.

## Solution

Prevent the auto-focus scroll by adding `onOpenAutoFocus` to the `DialogContent`, which calls `e.preventDefault()`. This stops the browser's default scroll-to-focused-element behavior while keeping the dialog properly centered in the viewport.

## Changes

| File | Change |
|------|--------|
| `src/pages/Customers.tsx` | Add `onOpenAutoFocus={(e) => e.preventDefault()}` to the `DialogContent` component |

This is a one-line fix that directly addresses the scroll-on-open behavior.

