import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SAVED_REPLY_BUCKET, thumbKey } from "@/hooks/useSavedReplies";
import { cn } from "@/lib/utils";

class MissingObjectError extends Error {}

/** Adds a cache-busting param so a retry always issues a new image request. */
export const retrySrc = (url: string, nonce: number) =>
  nonce === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}r=${nonce}`;

export const SavedReplyThumbnail = ({ path, className }: { path: string | null; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => { setFailed(false); setNonce(0); }, [path]);

  useEffect(() => {
    if (!path || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [path]);

  const { data: url } = useQuery({
    queryKey: thumbKey(path ?? ""),
    enabled: !!path && visible,
    staleTime: 8 * 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) => !(err instanceof MissingObjectError) && count < 1,
    queryFn: async () => {
      if (!path) throw new MissingObjectError("missing");
      const { data, error } = await supabase.storage.from(SAVED_REPLY_BUCKET).createSignedUrl(path, 600);
      if (error || !data?.signedUrl) {
        if (/not.?found/i.test(error?.message ?? "")) throw new MissingObjectError("missing");
        throw new Error(error?.message || "sign failed");
      }
      return data.signedUrl;
    },
  });

  const retry = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!path) return;
    setNonce((n) => n + 1);
    setFailed(false);
    void qc.invalidateQueries({ queryKey: thumbKey(path) });
  };

  return (
    <div ref={ref} className={cn("relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center", className)}>
      {path && url && !failed ? (
        <img
          key={nonce}
          src={retrySrc(url, nonce)}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
      {path && failed && (
        <button
          type="button"
          aria-label="Retry loading picture"
          title="Retry loading picture"
          onClick={retry}
          className="absolute inset-0 flex items-center justify-center bg-background/70 text-foreground hover:bg-background/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
};
