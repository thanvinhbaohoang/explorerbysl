import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SAVED_REPLY_BUCKET, thumbKey } from "@/hooks/useSavedReplies";
import { cn } from "@/lib/utils";

class MissingObjectError extends Error {}

export const SavedReplyThumbnail = ({ path, className }: { path: string | null; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [retried, setRetried] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setRetried(false); setFailed(false); }, [path]);

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

  const { data: url, refetch } = useQuery({
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

  return (
    <div ref={ref} className={cn("h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center", className)}>
      {path && url && !failed ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => {
            if (!retried) {
              setRetried(true);
              void refetch();
            } else setFailed(true);
          }}
        />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
};
