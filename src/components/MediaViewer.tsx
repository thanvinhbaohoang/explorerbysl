import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatMedia, ChatMediaItem } from "@/contexts/ChatMediaContext";

interface MediaViewerProps {
  items: ChatMediaItem[];
  initialIndex: number;
  onClose: () => void;
}

export const MediaViewer = ({ items, initialIndex, onClose }: MediaViewerProps) => {
  const [index, setIndex] = useState(initialIndex);
  const [rotation, setRotation] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  const current = items[index];
  const canPrev = index > 0;
  const canNext = index < items.length - 1;

  // Reset zoom + rotation when navigating
  useEffect(() => {
    setRotation(0);
    resetRef.current?.();
  }, [index]);

  const goPrev = useCallback(() => {
    if (canPrev) setIndex((i) => i - 1);
  }, [canPrev]);
  const goNext = useCallback(() => {
    if (canNext) setIndex((i) => i + 1);
  }, [canNext]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key.toLowerCase() === "r") setRotation((r) => (r + 90) % 360);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, onClose]);

  const handleDownload = async () => {
    if (!current) return;
    try {
      const response = await fetch(current.src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        current.alt || `media-${Date.now()}.${current.type === "photo" ? "jpg" : "mp4"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      window.open(current.src, "_blank");
    }
  };

  // Swipe (mobile)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 p-3 safe-area-inset-top">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
        <div className="text-white/80 text-sm tabular-nums">
          {index + 1} / {items.length}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="text-white hover:bg-white/20"
            title="Rotate (R)"
          >
            <RotateCw className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/20"
          >
            <Download className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden min-h-0 relative"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Prev / Next arrows */}
        {items.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              disabled={!canPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/40 text-white hover:bg-black/60 disabled:opacity-30"
            >
              <ChevronLeft className="h-7 w-7" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={!canNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/40 text-white hover:bg-black/60 disabled:opacity-30"
            >
              <ChevronRight className="h-7 w-7" />
            </Button>
          </>
        )}

        {current.type === "photo" ? (
          <TransformWrapper
            key={current.id}
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
            doubleClick={{ mode: "toggle", step: 2 }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => {
              resetRef.current = () => resetTransform();
              return (
                <>
                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="!w-full !h-full flex items-center justify-center"
                  >
                    <img
                      src={current.src}
                      alt={current.alt || "Media"}
                      className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
                      style={{ transform: `rotate(${rotation}deg)` }}
                      draggable={false}
                    />
                  </TransformComponent>

                  {/* Zoom controls */}
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 bg-black/50 rounded-full px-3 py-2 z-10">
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
                      onClick={() => {
                        resetTransform();
                        setRotation(0);
                      }}
                      className="h-8 w-8 text-white hover:bg-white/20"
                      title="Reset"
                    >
                      <Maximize className="h-4 w-4" />
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
                </>
              );
            }}
          </TransformWrapper>
        ) : (
          <video
            key={current.id}
            src={current.src}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full"
          >
            <source src={current.src} type={current.mimeType || "video/mp4"} />
          </video>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div className="flex-shrink-0 bg-black/60 px-2 py-2 overflow-x-auto">
          <div className="flex gap-1.5 justify-center min-w-min">
            {items.map((it, i) => (
              <button
                key={it.id}
                onClick={() => setIndex(i)}
                className={cn(
                  "relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 rounded overflow-hidden border-2 transition-all",
                  i === index
                    ? "border-primary opacity-100 scale-105"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                {it.type === "photo" ? (
                  <img src={it.src} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <video src={it.src} className="w-full h-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="h-4 w-4 text-white fill-white" />
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Thumbnail component that opens the viewer
interface MediaThumbnailProps {
  src: string;
  alt?: string;
  type: "photo" | "video";
  mimeType?: string;
  mediaId?: string;
  className?: string;
}

export const MediaThumbnail = ({
  src,
  alt,
  type,
  mimeType,
  mediaId,
  className,
}: MediaThumbnailProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const chatMedia = useChatMedia();

  const { items, initialIndex } = useMemo(() => {
    if (chatMedia && mediaId) {
      const idx = chatMedia.items.findIndex((m) => m.id === mediaId);
      if (idx !== -1) {
        return { items: chatMedia.items, initialIndex: idx };
      }
    }
    return {
      items: [{ id: mediaId || src, src, type, mimeType, alt }] as ChatMediaItem[],
      initialIndex: 0,
    };
  }, [chatMedia, mediaId, src, type, mimeType, alt]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary rounded-md overflow-hidden",
          className
        )}
      >
        {type === "photo" ? (
          <img src={src} alt={alt || "Photo"} className="w-full h-full object-cover" />
        ) : (
          <video src={src} className="w-full h-full object-cover" muted preload="metadata" />
        )}
      </button>

      {isOpen && (
        <MediaViewer
          items={items}
          initialIndex={initialIndex}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
