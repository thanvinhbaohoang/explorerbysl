import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Image, Video, Mic, Calendar, User, Loader2, X } from "lucide-react";
import { format } from "date-fns";

interface MediaItem {
  id: string;
  customer_id: string;
  message_type: string;
  photo_url: string | null;
  video_url: string | null;
  voice_url: string | null;
  voice_duration: number | null;
  timestamp: string;
  platform: string;
  sender_type: string;
  customer?: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    messenger_name: string | null;
  };
}

const MediaGallery = () => {
  const navigate = useNavigate();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          id,
          customer_id,
          message_type,
          photo_url,
          video_url,
          voice_url,
          voice_duration,
          timestamp,
          platform,
          sender_type,
          customer:customer_id (
            first_name,
            last_name,
            username,
            messenger_name
          )
        `)
        .or("photo_url.neq.null,video_url.neq.null,voice_url.neq.null")
        .order("timestamp", { ascending: false })
        .limit(200);

      if (error) throw error;
      setMedia((data as any) || []);
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCustomerName = (item: MediaItem) => {
    if (!item.customer) return "Unknown";
    if (item.customer.messenger_name) return item.customer.messenger_name;
    if (item.customer.first_name || item.customer.last_name) {
      return `${item.customer.first_name || ""} ${item.customer.last_name || ""}`.trim();
    }
    return item.customer.username || "Unknown";
  };

  const filteredMedia = media.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "photos") return item.photo_url;
    if (activeTab === "videos") return item.video_url;
    if (activeTab === "voice") return item.voice_url;
    return true;
  });

  const photos = media.filter((m) => m.photo_url);
  const videos = media.filter((m) => m.video_url);
  const voice = media.filter((m) => m.voice_url);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Media Gallery</h1>
            <p className="text-muted-foreground">
              All photos, videos, and voice messages from customers
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Image className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{photos.length}</p>
                <p className="text-sm text-muted-foreground">Photos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Video className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{videos.length}</p>
                <p className="text-sm text-muted-foreground">Videos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Mic className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{voice.length}</p>
                <p className="text-sm text-muted-foreground">Voice Messages</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{media.length}</p>
                <p className="text-sm text-muted-foreground">Total Media</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({media.length})</TabsTrigger>
            <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>
            <TabsTrigger value="videos">Videos ({videos.length})</TabsTrigger>
            <TabsTrigger value="voice">Voice ({voice.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMedia.length === 0 ? (
              <Card>
                <CardContent className="py-20 text-center text-muted-foreground">
                  No media found
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredMedia.map((item) => (
                  <Card
                    key={item.id}
                    className="group cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => setSelectedMedia(item)}
                  >
                    <div className="aspect-square relative bg-muted">
                      {item.photo_url && (
                        <img
                          src={item.photo_url}
                          alt="Photo"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      {item.video_url && (
                        <div className="w-full h-full flex items-center justify-center bg-black/80">
                          <Video className="h-12 w-12 text-white/80" />
                        </div>
                      )}
                      {item.voice_url && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-500/20 to-green-600/20">
                          <Mic className="h-12 w-12 text-green-500" />
                          {item.voice_duration && (
                            <span className="text-sm text-muted-foreground">
                              {Math.floor(item.voice_duration / 60)}:{String(item.voice_duration % 60).padStart(2, "0")}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                      {/* Platform badge */}
                      <Badge
                        variant="secondary"
                        className="absolute top-2 right-2 text-xs capitalize"
                      >
                        {item.platform}
                      </Badge>
                    </div>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{getCustomerName(item)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.timestamp), "MMM d, yyyy HH:mm")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Media Preview Dialog */}
        <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Media Preview</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {selectedMedia?.platform}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {selectedMedia?.sender_type}
                  </Badge>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Media content */}
              <div className="rounded-lg overflow-hidden bg-muted">
                {selectedMedia?.photo_url && (
                  <img
                    src={selectedMedia.photo_url}
                    alt="Full size"
                    className="w-full h-auto max-h-[60vh] object-contain mx-auto"
                  />
                )}
                {selectedMedia?.video_url && (
                  <video
                    src={selectedMedia.video_url}
                    controls
                    className="w-full max-h-[60vh]"
                  />
                )}
                {selectedMedia?.voice_url && (
                  <div className="p-8 flex flex-col items-center gap-4">
                    <Mic className="h-16 w-16 text-green-500" />
                    <audio src={selectedMedia.voice_url} controls className="w-full max-w-md" />
                    {selectedMedia.voice_duration && (
                      <p className="text-muted-foreground">
                        Duration: {Math.floor(selectedMedia.voice_duration / 60)}:
                        {String(selectedMedia.voice_duration % 60).padStart(2, "0")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">From</p>
                  <p className="font-medium">{selectedMedia && getCustomerName(selectedMedia)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {selectedMedia && format(new Date(selectedMedia.timestamp), "PPpp")}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = selectedMedia?.photo_url || selectedMedia?.video_url || selectedMedia?.voice_url;
                    if (url) window.open(url, "_blank");
                  }}
                >
                  Open Original
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedMedia?.customer_id && navigate(`/customers/${selectedMedia.customer_id}`)}
                >
                  View Customer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MediaGallery;
