

# Easy Media Adding: Drag & Drop and Paste Support

## Summary

Currently, employees must click the attachment icon every time to add files, which is inconvenient and disrupts the workflow. This plan adds two modern, intuitive ways to attach files:

1. **Drag and Drop**: Drop files directly onto the chat area
2. **Clipboard Paste**: Paste images from clipboard with Ctrl+V / Cmd+V

Both methods work seamlessly with the existing multi-file upload system.

---

## What You'll Get

| Feature | How It Works |
|---------|--------------|
| **Drag & Drop** | Drag files from your computer and drop them on the chat area. A visual indicator shows when you're dragging |
| **Paste Images** | Copy an image (screenshot, from web, etc.) and paste with Ctrl+V / Cmd+V in the chat input |
| **Visual Feedback** | Drop zone highlights with a dashed border and icon when dragging files over |
| **Works with existing flow** | Dropped/pasted files appear in the preview area just like clicking the attachment icon |

---

## Implementation Details

### 1. Drag & Drop Zone

Add drag-and-drop handling to the chat container:

- **dragenter/dragover**: Show visual drop indicator
- **dragleave**: Hide indicator when leaving
- **drop**: Process files and add to selected files list

Visual feedback when dragging:
- Dashed border around chat area
- "Drop files here" overlay with icon
- Semi-transparent background

### 2. Clipboard Paste

Add paste event listener to the textarea:

- Detect `paste` event on the input
- Check for image data in `clipboardData.items`
- Convert clipboard image to File object
- Add to selected files with preview generation

### 3. Shared File Processing

Reuse the existing `handleFileSelect` logic:

- 25MB file size limit check
- Preview generation for images/videos
- Add to `selectedFiles` and `filePreviews` state

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ChatPanel.tsx` | Add drag-drop zone wrapper, drop state, paste handler on textarea |
| `src/pages/Customers.tsx` | Same changes for the Customers dialog chat |

---

## Code Changes

### ChatPanel.tsx

**New state:**
```typescript
const [isDragging, setIsDragging] = useState(false);
```

**New handlers:**
```typescript
// Handle drag events
const handleDragEnter = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  // Only hide if leaving the container (not entering a child)
  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
    setIsDragging(false);
  }
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
  
  const files = Array.from(e.dataTransfer.files);
  processFiles(files);
};

// Handle paste from clipboard
const handlePaste = (e: React.ClipboardEvent) => {
  const items = e.clipboardData.items;
  const files: File[] = [];
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  
  if (files.length > 0) {
    processFiles(files);
  }
};

// Shared file processing (extracted from handleFileSelect)
const processFiles = (files: File[]) => {
  const maxSize = 25 * 1024 * 1024;
  const validFiles: File[] = [];
  
  files.forEach((file) => {
    if (file.size > maxSize) {
      toast.error(`${file.name} is too large. Maximum size is 25MB.`);
      return;
    }
    validFiles.push(file);
  });
  
  if (validFiles.length === 0) return;
  
  setSelectedFiles(prev => [...prev, ...validFiles]);
  
  // Generate previews
  validFiles.forEach((file) => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreviews(prev => [...prev, '']);
    }
  });
};
```

**Updated JSX:**
```tsx
// Wrap the chat container with drag handlers
<div 
  className="h-full flex flex-col bg-background relative"
  onDragEnter={handleDragEnter}
  onDragOver={(e) => e.preventDefault()}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  {/* Drop zone overlay */}
  {isDragging && (
    <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-50 flex items-center justify-center">
      <div className="text-center">
        <Paperclip className="h-12 w-12 mx-auto text-primary mb-2" />
        <p className="text-lg font-medium text-primary">Drop files here</p>
      </div>
    </div>
  )}
  
  {/* ... existing content ... */}
  
  {/* Textarea with paste handler */}
  <Textarea
    onPaste={handlePaste}
    // ... existing props
  />
</div>
```

### Customers.tsx

Apply the same pattern to the Dialog component for the chat messages area.

---

## User Experience

1. **Drag files from desktop** → Drop on chat → Files appear in preview → Send
2. **Screenshot (Cmd+Shift+4)** → Paste in chat → Image appears in preview → Send
3. **Copy image from browser** → Paste in chat → Image appears in preview → Send
4. **Works together** → Drag 3 photos, paste 1 screenshot → All 4 in preview → Send as album

---

## Edge Cases Handled

- Dragging over child elements doesn't break the drop zone
- Non-image files from clipboard are ignored (text paste still works normally)
- File size validation applies to dropped/pasted files
- Works alongside the existing attachment button (users can still use that if preferred)

