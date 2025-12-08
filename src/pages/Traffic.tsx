import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
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
import { TrendingUp, Search, X, Filter, UserPlus, User } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";

interface MessengerAdContext {
  ad_id?: string;
  ad_title?: string;
  photo_url?: string;
  video_url?: string;
  post_id?: string;
  product_id?: string;
}

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
  messenger_ref: string | null;
  messenger_ad_context: MessengerAdContext | null;
  created_at: string;
  customer: {
    id: string;
    telegram_id: number | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    messenger_id: string | null;
    messenger_name: string | null;
    first_message_at: string | null;
  } | null;
  isNewCustomer: boolean;
}

const Traffic = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [isLoadingTraffic, setIsLoadingTraffic] = useState(false);
  const [totalTraffic, setTotalTraffic] = useState(0);
  const itemsPerPage = 10;

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [uniqueSources, setUniqueSources] = useState<string[]>([]);
  const [uniqueCampaigns, setUniqueCampaigns] = useState<string[]>([]);

  // Cache for storing fetched data
  const [dataCache, setDataCache] = useState<Record<string, { data: TrafficData[], total: number }>>({});

  // Get current page from URL params, default to 1
  const trafficPage = parseInt(searchParams.get("page") || "1", 10);

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
    // Generate cache key based on filters and page
    const cacheKey = `${page}-${searchTerm}-${sourceFilter}-${campaignFilter}`;
    
    // Check cache first
    if (dataCache[cacheKey]) {
      setTrafficData(dataCache[cacheKey].data);
      setTotalTraffic(dataCache[cacheKey].total);
      return;
    }

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
        .select("id, facebook_click_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_adset_id, utm_ad_id, utm_campaign_id, referrer, messenger_ref, messenger_ad_context, created_at, user_id");

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
              .select("id, telegram_id, username, first_name, last_name, messenger_id, messenger_name, first_message_at")
              .eq("id", lead.user_id)
              .maybeSingle();

            // Check if customer was new at the time of this lead
            const leadCreatedAt = new Date(lead.created_at || '');
            const customerFirstMessage = customer?.first_message_at ? new Date(customer.first_message_at) : null;
            // Customer is "new" if their first message was within 1 minute of lead creation
            const isNewCustomer = customerFirstMessage 
              ? Math.abs(leadCreatedAt.getTime() - customerFirstMessage.getTime()) < 60000
              : false;

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
              messenger_ref: lead.messenger_ref,
              messenger_ad_context: lead.messenger_ad_context as MessengerAdContext | null,
              created_at: lead.created_at,
              customer,
              isNewCustomer,
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
            messenger_ref: lead.messenger_ref,
            messenger_ad_context: lead.messenger_ad_context as MessengerAdContext | null,
            created_at: lead.created_at,
            customer: null,
            isNewCustomer: false,
          };
        })
      );

      setTrafficData(trafficWithCustomers);

      // Store in cache
      setDataCache(prev => ({
        ...prev,
        [cacheKey]: { data: trafficWithCustomers, total: count || 0 }
      }));
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
      // Reset to page 1 when search/filters change
      setSearchParams({ page: "1" });
      // Clear cache when filters change
      setDataCache({});
      fetchTrafficData(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, sourceFilter, campaignFilter]);

  // Fetch traffic when page changes
  useEffect(() => {
    fetchTrafficData(trafficPage);
  }, [trafficPage]);

  const clearFilters = () => {
    setSearchTerm("");
    setSourceFilter("");
    setCampaignFilter("");
    setSearchParams({ page: "1" });
    setDataCache({});
  };

  const updatePage = (page: number) => {
    setSearchParams({ page: page.toString() });
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
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ad Source</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trafficData.map((traffic) => {
                      // Get customer display name - prefer first/last name, fallback to messenger_name
                      const customerName = traffic.customer
                        ? (traffic.customer.first_name || traffic.customer.last_name)
                          ? `${traffic.customer.first_name || ''} ${traffic.customer.last_name || ''}`.trim()
                          : traffic.customer.messenger_name || 'Unknown'
                        : null;

                      return (
                      <TableRow key={traffic.id}>
                        <TableCell className="font-medium">
                          {traffic.customer ? (
                            <Link 
                              to={`/customer/${traffic.customer.id}`}
                              className="text-primary hover:underline"
                            >
                              {customerName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground italic">Not linked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {traffic.customer ? (
                            traffic.isNewCustomer ? (
                              <Badge variant="default" className="gap-1">
                                <UserPlus className="h-3 w-3" />
                                New
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <User className="h-3 w-3" />
                                Existing
                              </Badge>
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  {traffic.messenger_ref ? (
                                    <Badge variant="outline" className="font-mono">
                                      {traffic.messenger_ref}
                                    </Badge>
                                  ) : traffic.facebook_click_id ? (
                                    <Badge variant="default">
                                      FB Click
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
                                  {traffic.messenger_ref && (
                                    <div>
                                      <span className="font-semibold">Post Tag:</span>
                                      <span className="ml-2 text-muted-foreground font-mono">{traffic.messenger_ref}</span>
                                    </div>
                                  )}
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
                                  {traffic.messenger_ad_context && (
                                    <div className="border-t pt-2 mt-2">
                                      <div className="font-semibold text-foreground mb-2">
                                        Facebook Ad Context
                                      </div>
                                      {traffic.messenger_ad_context.ad_title && (
                                        <div>
                                          <span className="font-semibold">Ad Title:</span>
                                          <span className="ml-2 text-muted-foreground">{traffic.messenger_ad_context.ad_title}</span>
                                        </div>
                                      )}
                                      {traffic.messenger_ad_context.ad_id && (
                                        <div>
                                          <span className="font-semibold">Ad ID:</span>
                                          <span className="ml-2 text-muted-foreground font-mono text-xs">{traffic.messenger_ad_context.ad_id}</span>
                                        </div>
                                      )}
                                      {traffic.messenger_ad_context.post_id && (
                                        <div>
                                          <span className="font-semibold">Post ID:</span>
                                          <span className="ml-2 text-muted-foreground font-mono text-xs">{traffic.messenger_ad_context.post_id}</span>
                                        </div>
                                      )}
                                      {traffic.messenger_ad_context.product_id && (
                                        <div>
                                          <span className="font-semibold">Product ID:</span>
                                          <span className="ml-2 text-muted-foreground font-mono text-xs">{traffic.messenger_ad_context.product_id}</span>
                                        </div>
                                      )}
                                      {traffic.messenger_ad_context.photo_url && (
                                        <div className="mt-2">
                                          <span className="font-semibold block mb-1">Ad Image:</span>
                                          <img 
                                            src={traffic.messenger_ad_context.photo_url} 
                                            alt="Ad creative" 
                                            className="max-w-[200px] max-h-[150px] object-cover rounded border"
                                          />
                                        </div>
                                      )}
                                      {traffic.messenger_ad_context.video_url && (
                                        <div>
                                          <span className="font-semibold">Video URL:</span>
                                          <div className="text-xs text-muted-foreground break-all mt-1">
                                            {traffic.messenger_ad_context.video_url}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {!traffic.messenger_ref &&
                                   !traffic.facebook_click_id && 
                                   !traffic.utm_source && 
                                   !traffic.utm_medium && 
                                   !traffic.utm_campaign && 
                                   !traffic.referrer &&
                                   !traffic.messenger_ad_context && (
                                    <div className="text-muted-foreground italic">
                                      No tracking data available
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(traffic.created_at)}
                        </TableCell>
                      </TableRow>
                      );
                    })}
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
                        onClick={() => updatePage(Math.max(1, trafficPage - 1))}
                        className={trafficPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalTrafficPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => updatePage(page)}
                          isActive={page === trafficPage}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => updatePage(Math.min(totalTrafficPages, trafficPage + 1))}
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
