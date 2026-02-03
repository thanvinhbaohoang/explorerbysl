
# Fix Album Sending: Unsupported Image Format (AVIF)

## Problem Identified

The error `Failed to send album: Edge Function returned a non-2xx status code` occurs because Telegram's API cannot process AVIF images.

Looking at the edge function logs:
- "Sending media group to: 8547115444 Items: 2"
- Error: `WEBPAGE_CURL_FAILED` on message #2

The 2nd file uploaded was `1770093893387_bcw00d.avif` - an **AVIF format image**. Telegram does not support AVIF for photo uploads, only JPEG, PNG, GIF, and WebP.

---

## Solution: Convert Images Before Upload

We need to convert unsupported image formats (AVIF, HEIC, BMP, TIFF) to JPEG before uploading to storage.

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useChatMessages.ts` | Add image format conversion before upload |
| `src/pages/Customers.tsx` | Add same conversion logic to the duplicate upload function |
| `src/components/ChatPanel.tsx` | Add format validation/conversion in processFiles |

---

## Implementation Details

### Step 1: Create Image Conversion Utility

Add a new utility function that converts images to JPEG using Canvas API:

```typescript
// Convert image to JPEG if it's an unsupported format
const convertToJpegIfNeeded = async (file: File): Promise<File> => {
  const unsupportedFormats = ['image/avif', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff'];
  
  if (!unsupportedFormats.includes(file.type)) {
    return file; // Already supported format
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const newFileName = file.name.replace(/\.[^.]+$/, '.jpg');
            resolve(new File([blob], newFileName, { type: 'image/jpeg' }));
          } else {
            reject(new Error('Failed to convert image'));
          }
        },
        'image/jpeg',
        0.9 // Quality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image for conversion'));
    img.src = URL.createObjectURL(file);
  });
};
```

### Step 2: Integrate Conversion in Upload Flow

Modify `uploadFileToStorage` to convert unsupported formats:

```typescript
const uploadFileToStorage = async (file: File): Promise<string> => {
  // Convert unsupported image formats to JPEG
  const processedFile = file.type.startsWith('image/') 
    ? await convertToJpegIfNeeded(file) 
    : file;
  
  const fileExt = processedFile.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `chat-media/${fileName}`;

  const { error } = await supabase.storage
    .from('chat-attachments')
    .upload(filePath, processedFile, { cacheControl: '3600', upsert: false });

  if (error) throw new Error(`Failed to upload file: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};
```

### Step 3: Add User Feedback for Format Conversion

Optionally show a toast notification when conversion happens:

```typescript
if (unsupportedFormats.includes(file.type)) {
  console.log(`Converting ${file.name} from ${file.type} to JPEG`);
  // Optional: toast.info(`Converting ${file.name} to compatible format...`);
}
```

---

## Technical Notes

- **Canvas API Limitations**: The Canvas API can read most image formats if the browser supports them. Most modern browsers support AVIF rendering, so conversion to JPEG will work.
- **Quality Setting**: Using 0.9 (90%) quality for JPEG conversion maintains good image quality while reducing file size.
- **Video Files**: No conversion needed - Telegram supports MP4, MOV, and most common video formats.
- **Fallback**: If conversion fails, the original file will be used (and will likely fail on Telegram's side with a clearer error).

---

## Alternative Approach

If Canvas API doesn't work for certain formats (HEIC on some browsers), we could:
1. Add a validation that rejects unsupported formats with a user-friendly error message
2. Or use a library like `browser-image-compression` for more robust conversion

---

## Expected Outcome

After this fix:
- AVIF, HEIC, BMP, TIFF images will be automatically converted to JPEG before upload
- Album sending will work reliably with any image format the browser can display
- No user action required - conversion happens transparently
