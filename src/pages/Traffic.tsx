import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { TrendingUp, Search, X, Filter, UserPlus, User, CalendarIcon, MessageCircle, Send, Hash, Link as LinkIcon, Megaphone } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";
import { cn } from "@/lib/utils";
import { useTrafficFilterOptions, useTrafficData } from "@/hooks/useTrafficData";

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
  platform: string;
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
  const itemsPerPage = 10;

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [postTagFilter, setPostTagFilter] = useState<string>("");

  // Date range filter
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Customer status filter
  const [customerStatusFilter, setCustomerStatusFilter] = useState<string>("");

  // Get current page from URL params, default to 1
  const trafficPage = parseInt(searchParams.get("page") || "1", 10);

  // Use cached filter options
  const { data: filterOptions } = useTrafficFilterOptions();
  const uniqueSources = filterOptions?.sources || [];
  const uniqueCampaigns = filterOptions?.campaigns || [];
  const uniquePostTags = filterOptions?.postTags || [];

  // Build date strings for query
  const startDateStr = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
  const endDateStr = endDate ? format(new Date(endDate.getTime() + 86400000), 'yyyy-MM-dd') : undefined;

  // Use cached traffic data
  const { data: trafficResult, isLoading: isLoadingTraffic } = useTrafficData({
    page: trafficPage,
    searchTerm,
    sourceFilter,
    campaignFilter,
    platformFilter,
    postTagFilter,
    startDate: startDateStr,
    endDate: endDateStr,
    itemsPerPage,
  });

  const trafficData = trafficResult?.data || [];
  const totalTraffic = trafficResult?.total || 0;

  const clearFilters = () => {
    setSearchTerm("");
    setSourceFilter("");
    setCampaignFilter("");
    setPlatformFilter("");
    setPostTagFilter("");
    setStartDate(undefined);
    setEndDate(undefined);
    setCustomerStatusFilter("");
    setSearchParams({ page: "1" });
  };

  const updatePage = (page: number) => {
    setSearchParams({ page: page.toString() });
  };

  const updatePage = (page: number) => {
    setSearchParams({ page: page.toString() });
  };

  const activeFilterCount = [searchTerm, sourceFilter, campaignFilter, platformFilter, postTagFilter, startDate, endDate, customerStatusFilter].filter(Boolean).length;

  const formatDisplayDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get platform display info
  const getPlatformInfo = (platform: string) => {
    if (platform === 'messenger') {
      return {
        icon: MessageCircle,
        label: 'Messenger',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
      };
    }
    return {
      icon: Send,
      label: 'Telegram',
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10',
    };
  };

  // Get traffic source info
  const getTrafficSourceInfo = (traffic: TrafficData) => {
    if (traffic.messenger_ad_context) {
      return {
        type: 'Facebook Ad',
        icon: Megaphone,
        value: traffic.messenger_ad_context.ad_title || 'Facebook Ad',
        variant: 'default' as const,
      };
    }
    if (traffic.messenger_ref && traffic.messenger_ref !== 'direct_message') {
      return {
        type: 'Post Tag',
        icon: Hash,
        value: traffic.messenger_ref,
        variant: 'outline' as const,
      };
    }
    if (traffic.utm_source) {
      return {
        type: 'UTM',
        icon: LinkIcon,
        value: traffic.utm_source,
        variant: 'secondary' as const,
      };
    }
    if (traffic.facebook_click_id) {
      return {
        type: 'FB Click',
        icon: Megaphone,
        value: 'Facebook Click',
        variant: 'default' as const,
      };
    }
    return {
      type: 'Direct',
      icon: MessageCircle,
      value: 'Direct Message',
      variant: 'secondary' as const,
    };
  };

  // Client-side filtering for customer status and text search on displayed data
  const filteredTrafficData = useMemo(() => {
    let filtered = trafficData;
    
    // Filter by customer status
    if (customerStatusFilter === "new") {
      filtered = filtered.filter(t => t.isNewCustomer);
    } else if (customerStatusFilter === "existing") {
      filtered = filtered.filter(t => t.customer && !t.isNewCustomer);
    }
    
    // Client-side text search for dates and status (since DB can't search formatted dates)
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(traffic => {
        // Check formatted date
        const formattedDate = formatDisplayDate(traffic.created_at).toLowerCase();
        if (formattedDate.includes(lowerSearch)) return true;
        
        // Check customer name
        const customerName = traffic.customer
          ? (traffic.customer.first_name || traffic.customer.last_name)
            ? `${traffic.customer.first_name || ''} ${traffic.customer.last_name || ''}`.trim()
            : traffic.customer.messenger_name || ''
          : '';
        if (customerName.toLowerCase().includes(lowerSearch)) return true;
        
        // Check status
        const status = traffic.isNewCustomer ? 'new' : 'existing';
        if (status.includes(lowerSearch)) return true;
        
        // Check ad source fields
        if (traffic.messenger_ref?.toLowerCase().includes(lowerSearch)) return true;
        if (traffic.utm_source?.toLowerCase().includes(lowerSearch)) return true;
        if (traffic.utm_campaign?.toLowerCase().includes(lowerSearch)) return true;
        if (traffic.platform?.toLowerCase().includes(lowerSearch)) return true;
        
        return false;
      });
    }
    
    return filtered;
  }, [trafficData, customerStatusFilter, searchTerm]);

  // Pagination calculations (data is already paginated from DB)
  const totalTrafficPages = Math.ceil(totalTraffic / itemsPerPage);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Customer Traffic</h1>
            <p className="text-muted-foreground mt-2">
              Track traffic sources and customer acquisition data
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
                    Traffic source tracking and customer acquisition information
                  </CardDescription>
                </div>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Filter className="h-3 w-3" />
                    {activeFilterCount} active
                  </Badge>
                )}
              </div>
              
              {/* Search and Filters - Row 1 */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customer, source, tag..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      disabled={isLoadingTraffic}
                    />
                  </div>

                  <Select value={customerStatusFilter} onValueChange={setCustomerStatusFilter} disabled={isLoadingTraffic}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="new">New Customers</SelectItem>
                      <SelectItem value="existing">Existing Customers</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={platformFilter} onValueChange={setPlatformFilter} disabled={isLoadingTraffic}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="messenger">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-blue-500" />
                          Messenger
                        </div>
                      </SelectItem>
                      <SelectItem value="telegram">
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-sky-500" />
                          Telegram
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filters - Row 2 */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={postTagFilter} onValueChange={setPostTagFilter} disabled={isLoadingTraffic}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Post Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Post Tags</SelectItem>
                      {uniquePostTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          <div className="flex items-center gap-2">
                            <Hash className="h-3 w-3" />
                            {tag}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sourceFilter} onValueChange={setSourceFilter} disabled={isLoadingTraffic}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="UTM Source" />
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
                    <SelectTrigger className="w-full sm:w-[150px]">
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
                </div>

                {/* Date Range Filters - Row 3 */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-[180px] justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                        disabled={isLoadingTraffic}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-[180px] justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                        disabled={isLoadingTraffic}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      onClick={clearFilters}
                      title="Clear filters"
                      disabled={isLoadingTraffic}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>

              {/* Results info */}
              {!isLoadingTraffic && activeFilterCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Showing {filteredTrafficData.length} filtered result{filteredTrafficData.length !== 1 ? 's' : ''}
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
                      <TableHead>Platform</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Traffic Source</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrafficData.map((traffic) => {
                      // Get customer display name - prefer first/last name, fallback to messenger_name
                      const customerName = traffic.customer
                        ? (traffic.customer.first_name || traffic.customer.last_name)
                          ? `${traffic.customer.first_name || ''} ${traffic.customer.last_name || ''}`.trim()
                          : traffic.customer.messenger_name || 'Unknown'
                        : null;

                      const platformInfo = getPlatformInfo(traffic.platform);
                      const PlatformIcon = platformInfo.icon;
                      const sourceInfo = getTrafficSourceInfo(traffic);
                      const SourceIcon = sourceInfo.icon;

                      return (
                      <TableRow key={traffic.id}>
                        <TableCell>
                          <div className={cn("flex items-center gap-2 px-2 py-1 rounded-md w-fit", platformInfo.bgColor)}>
                            <PlatformIcon className={cn("h-4 w-4", platformInfo.color)} />
                            <span className={cn("text-sm font-medium", platformInfo.color)}>
                              {platformInfo.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {traffic.customer ? (
                            <Link 
                              to={`/customers/${traffic.customer.id}`}
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
                                  <Badge variant={sourceInfo.variant} className="gap-1 font-normal">
                                    <SourceIcon className="h-3 w-3" />
                                    <span className="text-xs text-muted-foreground mr-1">{sourceInfo.type}:</span>
                                    <span className="font-medium truncate max-w-[120px]">{sourceInfo.value}</span>
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md p-4" side="right">
                                <div className="space-y-2 text-sm">
                                  <div className="font-semibold text-foreground border-b pb-2">
                                    Tracking Information
                                  </div>
                                  <div>
                                    <span className="font-semibold">Platform:</span>
                                    <span className="ml-2 text-muted-foreground capitalize">{traffic.platform}</span>
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
                          {formatDisplayDate(traffic.created_at)}
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
