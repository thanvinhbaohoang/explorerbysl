import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { TrendingUp, Search, X, Filter } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";

interface TrafficData {
  id: string;
  facebook_click_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_adset_id: string | null;
  utm_ad_id: string | null;
  utm_campaign_id: string | null;
  referrer: string | null;
  created_at: string;
  customer: {
    id: string;
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

const Traffic = () => {
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [isLoadingTraffic, setIsLoadingTraffic] = useState(false);
  const [trafficPage, setTrafficPage] = useState(1);
  const [totalTraffic, setTotalTraffic] = useState(0);
  const itemsPerPage = 10;

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [uniqueSources, setUniqueSources] = useState<string[]>([]);
  const [uniqueCampaigns, setUniqueCampaigns] = useState<string[]>([]);

  // Fetch unique values for filters
  const fetchFilterOptions = async () => {
    try {
      const { data: sources } = await supabase
        .from("telegram_leads")
        .select("utm_source")
        .not("utm_source", "is", null);

      const { data: campaigns } = await supabase
        .from("telegram_leads")
        .select("utm_campaign")
        .not("utm_campaign", "is", null);

      const uniqueSourceValues = [...new Set(sources?.map(s => s.utm_source).filter(Boolean))] as string[];
      const uniqueCampaignValues = [...new Set(campaigns?.map(c => c.utm_campaign).filter(Boolean))] as string[];

      setUniqueSources(uniqueSourceValues);
      setUniqueCampaigns(uniqueCampaignValues);
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  // Fetch traffic data with pagination and filters
  const fetchTrafficData = async (page: number) => {
    setIsLoadingTraffic(true);
    try {
      let userIdsToInclude: string[] = [];

      // If searching, find matching customers first
      if (searchTerm) {
        const { data: matchingCustomers, error: customerError } = await supabase
          .from("customer")
          .select("id")
          .or(`username.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
        
        if (!customerError) {
          userIdsToInclude = matchingCustomers?.map(c => c.id) || [];
        }
      }

      // Build query with filters
      let countQuery = supabase
        .from("telegram_leads")
        .select("*", { count: "exact", head: true });

      let dataQuery = supabase
        .from("telegram_leads")
        .select("id, facebook_click_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_adset_id, utm_ad_id, utm_campaign_id, referrer, created_at, user_id");

      // Apply global search
      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        
        // Search in telegram_leads fields OR matching customer user_ids
        if (userIdsToInclude.length > 0) {
          const leadsSearchCondition = `utm_source.ilike.${searchPattern},utm_campaign.ilike.${searchPattern},utm_medium.ilike.${searchPattern},utm_content.ilike.${searchPattern},facebook_click_id.ilike.${searchPattern},user_id.in.(${userIdsToInclude.join(',')})`;
          countQuery = countQuery.or(leadsSearchCondition);
          dataQuery = dataQuery.or(leadsSearchCondition);
        } else {
          // Only search telegram_leads fields if no matching customers
          const leadsSearchCondition = `utm_source.ilike.${searchPattern},utm_campaign.ilike.${searchPattern},utm_medium.ilike.${searchPattern},utm_content.ilike.${searchPattern},facebook_click_id.ilike.${searchPattern}`;
          countQuery = countQuery.or(leadsSearchCondition);
          dataQuery = dataQuery.or(leadsSearchCondition);
        }
      }

      // Apply specific filters
      if (sourceFilter && sourceFilter !== "all") {
        countQuery = countQuery.eq("utm_source", sourceFilter);
        dataQuery = dataQuery.eq("utm_source", sourceFilter);
      }

      if (campaignFilter && campaignFilter !== "all") {
        countQuery = countQuery.eq("utm_campaign", campaignFilter);
        dataQuery = dataQuery.eq("utm_campaign", campaignFilter);
      }

      // Get filtered count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalTraffic(count || 0);

      // Fetch paginated data
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: leads, error } = await dataQuery
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch customer data for each lead that has a user_id
      const trafficWithCustomers = await Promise.all(
        (leads || []).map(async (lead) => {
          if (lead.user_id) {
            const { data: customer } = await supabase
              .from("customer")
              .select("id, telegram_id, username, first_name, last_name")
              .eq("id", lead.user_id)
              .maybeSingle();

            return {
              id: lead.id,
              facebook_click_id: lead.facebook_click_id,
              utm_source: lead.utm_source,
              utm_medium: lead.utm_medium,
              utm_campaign: lead.utm_campaign,
              utm_content: lead.utm_content,
              utm_term: lead.utm_term,
              utm_adset_id: lead.utm_adset_id,
              utm_ad_id: lead.utm_ad_id,
              utm_campaign_id: lead.utm_campaign_id,
              referrer: lead.referrer,
              created_at: lead.created_at,
              customer,
            };
          }
          return {
            id: lead.id,
            facebook_click_id: lead.facebook_click_id,
            utm_source: lead.utm_source,
            utm_medium: lead.utm_medium,
            utm_campaign: lead.utm_campaign,
            utm_content: lead.utm_content,
            utm_term: lead.utm_term,
            utm_adset_id: lead.utm_adset_id,
            utm_ad_id: lead.utm_ad_id,
            utm_campaign_id: lead.utm_campaign_id,
            referrer: lead.referrer,
            created_at: lead.created_at,
            customer: null,
          };
        })
      );

      setTrafficData(trafficWithCustomers);
    } catch (error: any) {
      console.error("Error fetching traffic data:", error);
      toast.error("Failed to load traffic data");
    } finally {
      setIsLoadingTraffic(false);
    }
  };

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setTrafficPage(1); // Reset to page 1 when search/filters change
      fetchTrafficData(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, sourceFilter, campaignFilter]);

  // Fetch traffic when page changes (without filters)
  useEffect(() => {
    if (trafficPage !== 1) {
      fetchTrafficData(trafficPage);
    }
  }, [trafficPage]);

  const clearFilters = () => {
    setSearchTerm("");
    setSourceFilter("");
    setCampaignFilter("");
    setTrafficPage(1);
  };

  const activeFilterCount = [searchTerm, sourceFilter, campaignFilter].filter(Boolean).length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Pagination calculations (data is already paginated from DB)
  const totalTrafficPages = Math.ceil(totalTraffic / itemsPerPage);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Customer Traffic</h1>
            <p className="text-muted-foreground mt-2">
              Track ad source and customer acquisition data
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-5 w-5" />
            <span className="text-2xl font-semibold">{totalTraffic}</span>
            <span>Total Traffic Records</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Traffic Data</CardTitle>
                  <CardDescription>
                    Ad source tracking and customer acquisition information
                  </CardDescription>
                </div>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Filter className="h-3 w-3" />
                    {activeFilterCount} active
                  </Badge>
                )}
              </div>
              
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search across all fields..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    disabled={isLoadingTraffic}
                  />
                </div>

                <Select value={sourceFilter} onValueChange={setSourceFilter} disabled={isLoadingTraffic}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {uniqueSources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={campaignFilter} onValueChange={setCampaignFilter} disabled={isLoadingTraffic}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {uniqueCampaigns.map((campaign) => (
                      <SelectItem key={campaign} value={campaign}>
                        {campaign}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearFilters}
                    title="Clear filters"
                    disabled={isLoadingTraffic}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Results info */}
              {!isLoadingTraffic && (searchTerm || sourceFilter || campaignFilter) && (
                <p className="text-sm text-muted-foreground">
                  Showing {totalTraffic} filtered result{totalTraffic !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTraffic ? (
              <TableSkeleton rows={10} columns={6} />
            ) : trafficData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No traffic data yet.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token ID</TableHead>
                      <TableHead>Ad Source</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Telegram ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trafficData.map((traffic) => (
                      <TableRow key={traffic.id}>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {traffic.id.slice(0, 8)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  {traffic.facebook_click_id ? (
                                    <Badge variant="default">
                                      FB: {traffic.facebook_click_id.slice(0, 12)}...
                                    </Badge>
                                  ) : traffic.utm_source ? (
                                    <Badge variant="default" className="capitalize">
                                      {traffic.utm_source}
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">Direct</Badge>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md p-4" side="right">
                                <div className="space-y-2 text-sm">
                                  <div className="font-semibold text-foreground border-b pb-2">
                                    Tracking Information
                                  </div>
                                  {traffic.facebook_click_id && (
                                    <div>
                                      <span className="font-semibold">Facebook Click ID:</span>
                                      <div className="text-xs font-mono text-muted-foreground break-all mt-1">
                                        {traffic.facebook_click_id}
                                      </div>
                                    </div>
                                  )}
                                  {traffic.utm_source && (
                                    <div>
                                      <span className="font-semibold">UTM Source:</span>
                                      <span className="ml-2 text-muted-foreground">{traffic.utm_source}</span>
                                    </div>
                                  )}
                                  {traffic.utm_medium && (
                                    <div>
                                      <span className="font-semibold">UTM Medium:</span>
                                      <span className="ml-2 text-muted-foreground">{traffic.utm_medium}</span>
                                    </div>
                                  )}
                                  {traffic.utm_campaign && (
                                    <div>
                                      <span className="font-semibold">UTM Campaign:</span>
                                      <span className="ml-2 text-muted-foreground">{traffic.utm_campaign}</span>
                                    </div>
                                  )}
                                  {traffic.utm_campaign_id && (
                                    <div>
                                      <span className="font-semibold">Campaign ID:</span>
                                      <span className="ml-2 text-muted-foreground font-mono">{traffic.utm_campaign_id}</span>
                                    </div>
                                  )}
                                  {traffic.utm_adset_id && (
                                    <div>
                                      <span className="font-semibold">Ad Set ID:</span>
                                      <span className="ml-2 text-muted-foreground font-mono">{traffic.utm_adset_id}</span>
                                    </div>
                                  )}
                                  {traffic.utm_ad_id && (
                                    <div>
                                      <span className="font-semibold">Ad ID:</span>
                                      <span className="ml-2 text-muted-foreground font-mono">{traffic.utm_ad_id}</span>
                                    </div>
                                  )}
                                  {traffic.utm_content && (
                                    <div>
                                      <span className="font-semibold">UTM Content:</span>
                                      <span className="ml-2 text-muted-foreground">{traffic.utm_content}</span>
                                    </div>
                                  )}
                                  {traffic.utm_term && (
                                    <div>
                                      <span className="font-semibold">UTM Term:</span>
                                      <span className="ml-2 text-muted-foreground">{traffic.utm_term}</span>
                                    </div>
                                  )}
                                  {traffic.referrer && (
                                    <div>
                                      <span className="font-semibold">Referrer:</span>
                                      <div className="text-xs text-muted-foreground break-all mt-1">
                                        {traffic.referrer}
                                      </div>
                                    </div>
                                  )}
                                  {!traffic.facebook_click_id && 
                                   !traffic.utm_source && 
                                   !traffic.utm_medium && 
                                   !traffic.utm_campaign && 
                                   !traffic.referrer && (
                                    <div className="text-muted-foreground italic">
                                      No tracking data available
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="font-medium">
                          {traffic.customer ? (
                            `${traffic.customer.first_name || ''} ${traffic.customer.last_name || ''}`
                          ) : (
                            <span className="text-muted-foreground italic">Not linked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {traffic.customer ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {traffic.customer.telegram_id}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {traffic.customer?.username ? (
                            <span className="text-muted-foreground">
                              @{traffic.customer.username}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(traffic.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {totalTraffic > itemsPerPage && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setTrafficPage((prev) => Math.max(1, prev - 1))}
                        className={trafficPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalTrafficPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setTrafficPage(page)}
                          isActive={page === trafficPage}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setTrafficPage((prev) => Math.min(totalTrafficPages, prev + 1))}
                        className={trafficPage === totalTrafficPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Traffic;
