## Remove "Awaiting Reply" filter from chat

In `src/components/ChatConversationList.tsx`:

1. Remove the filter tabs block (lines ~804–828) entirely — both the "All" and "Awaiting Reply" buttons, since "All" is the only remaining mode.
2. Simplify header count (line ~708–712) to always show `${allCustomers.length} customers${hasMore ? '+' : ''}`.
3. Remove now-unused state and logic:
   - `filterMode` state (line 82)
   - `unansweredIds` state (line 83) and any code that populates it
   - `filteredByMode` useMemo (lines 491–498); replace downstream references with `filteredBySearch`
4. Drop unused imports (`Clock`, `Badge` if no other usage) after cleanup.

No backend or other UI changes.