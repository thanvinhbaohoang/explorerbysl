import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TableSkeleton } from "@/components/TableSkeleton";

interface TrafficData {
  id: string;
  user_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  created_at: string | null;
}

const Traffic = () => {
  const navigate = useNavigate();
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [isLoadingTraffic, setIsLoadingTraffic] = useState(true);
  const [trafficPage, setTrafficPage] = useState(1);
  const [totalTraffic, setTotalTraffic] = useState(0);
  const [trafficDataCached, setTrafficDataCached] = useState(false);

  const ITEMS_PER_PAGE = 10;
  const totalTrafficPages = Math.ceil(totalTraffic / ITEMS_PER_PAGE);

  const fetchTrafficData = async (page: number) => {
    if (trafficDataCached && page === trafficPage) return;

    try {
      setIsLoadingTraffic(true);
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { count } = await supabase
        .from("telegram_leads")
        .select("*", { count: "exact", head: true });

      setTotalTraffic(count || 0);

      const { data, error } = await supabase
        .from("telegram_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setTrafficData(data || []);
      setTrafficDataCached(true);
    } catch (error) {
      console.error("Error fetching traffic data:", error);
      toast.error("Failed to load traffic data");
    } finally {
      setIsLoadingTraffic(false);
    }
  };

  useEffect(() => {
    if (!trafficDataCached) {
      fetchTrafficData(trafficPage);
    }
  }, []);

  useEffect(() => {
    fetchTrafficData(trafficPage);
  }, [trafficPage]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">Customer Traffic</h1>
            <p className="text-muted-foreground mt-2">Track your marketing campaign performance</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Traffic Sources</CardTitle>
            <CardDescription>Total leads: {totalTraffic}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTraffic ? (
              <TableSkeleton rows={10} columns={6} />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Ad Set</TableHead>
                        <TableHead>Ad</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Medium</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trafficData.map((traffic) => (
                        <TableRow key={traffic.id}>
                          <TableCell className="font-medium">
                            {traffic.campaign_name || traffic.utm_campaign || "-"}
                          </TableCell>
                          <TableCell>
                            {traffic.adset_name || "-"}
                          </TableCell>
                          <TableCell>
                            {traffic.ad_name || "-"}
                          </TableCell>
                          <TableCell>{traffic.utm_source || "-"}</TableCell>
                          <TableCell>{traffic.utm_medium || "-"}</TableCell>
                          <TableCell>
                            {traffic.created_at
                              ? new Date(traffic.created_at).toLocaleDateString()
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTrafficDataCached(false);
                      setTrafficPage((p) => Math.max(1, p - 1));
                    }}
                    disabled={trafficPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {trafficPage} of {totalTrafficPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTrafficDataCached(false);
                      setTrafficPage((p) => Math.min(totalTrafficPages, p + 1));
                    }}
                    disabled={trafficPage === totalTrafficPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Traffic;
