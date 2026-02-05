import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MediaViewerProps {
  src: string;
  alt?: string;
  type: "photo" | "video";
  mimeType?: string;
  onClose: () => void;
}

export const MediaViewer = ({ src, alt, type, mimeType, onClose }: MediaViewerProps) => {
  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = alt || `media-${Date.now()}.${type === "photo" ? "jpg" : "mp4"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      // Fallback: open in new tab
      window.open(src, "_blank");
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 safe-area-inset-top">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          className="text-white hover:bg-white/20"
        >
          <Download className="h-6 w-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
        {type === "photo" ? (
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
            doubleClick={{ mode: "toggle", step: 2 }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <img
                    src={src}
                    alt={alt || "Media"}
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                  />
                </TransformComponent>
                
                {/* Zoom controls - visible on larger screens */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 bg-black/50 rounded-full px-3 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => zoomOut()}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => resetTransform()}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => zoomIn()}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Mobile hint */}
                <p className="absolute bottom-4 left-1/2 -translate-x-1/2 sm:hidden text-white/60 text-xs">
                  Pinch to zoom • Double-tap to zoom in
                </p>
              </>
            )}
          </TransformWrapper>
        ) : (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full"
          >
            <source src={src} type={mimeType || "video/mp4"} />
          </video>
        )}
      </div>
    </div>
  );
};

// Thumbnail component that opens the viewer
interface MediaThumbnailProps {
  src: string;
  alt?: string;
  type: "photo" | "video";
  mimeType?: string;
  className?: string;
}

export const MediaThumbnail = ({ src, alt, type, mimeType, className }: MediaThumbnailProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn("cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary rounded-md overflow-hidden", className)}
      >
        {type === "photo" ? (
          <img 
            src={src} 
            alt={alt || "Photo"} 
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={src}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        )}
      </button>
      
      {isOpen && (
        <MediaViewer
          src={src}
          alt={alt}
          type={type}
          mimeType={mimeType}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
