import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, DollarSign, MousePointer, Eye, RefreshCw, ArrowLeft, Building2, Download } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";

import { useNavigate } from "react-router-dom";
import { useAdAccounts, useAccountInsights, useCampaigns, useAdSets, useAds } from "@/hooks/useAdsInsightData";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface Insight {
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  cpm: string;
  date_start?: string;
  date_stop?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  insights?: {
    data: Insight[];
  };
}

interface AdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  insights?: {
    data: Insight[];
  };
}

interface Ad {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  insights?: {
    data: Insight[];
  };
}

const AdsInsight = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions } = useUserPermissions();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [fetchAdSets, setFetchAdSets] = useState(false);
  const [fetchAdsFlag, setFetchAdsFlag] = useState(false);

  // Use cached hooks
  const { data: adAccounts = [], isLoading: isLoadingAccounts } = useAdAccounts();
  const { data: accountInsights = [], isLoading: isLoadingInsights, dataUpdatedAt } = useAccountInsights(selectedAccountId);
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useCampaigns(selectedAccountId);
  const { data: adSets = [] } = useAdSets(selectedAccountId, fetchAdSets);
  const { data: ads = [] } = useAds(selectedAccountId, fetchAdsFlag);

  const isLoading = isLoadingInsights || isLoadingCampaigns;

  // Auto-select first account when accounts load
  useEffect(() => {
    if (adAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(adAccounts[0].id);
    }
  }, [adAccounts, selectedAccountId]);

  // Refetch data for the selected account
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["account-insights", selectedAccountId] });
    queryClient.invalidateQueries({ queryKey: ["campaigns", selectedAccountId] });
    queryClient.invalidateQueries({ queryKey: ["adsets", selectedAccountId] });
    queryClient.invalidateQueries({ queryKey: ["ads", selectedAccountId] });
    toast.success("Refreshing data...");
  };

  const calculateTotals = (insights: Insight[]) => {
    if (!insights || insights.length === 0) return { impressions: 0, clicks: 0, spend: 0, ctr: 0, cpc: 0 };
    
    const totals = insights.reduce((acc, insight) => ({
      impressions: acc.impressions + parseFloat(insight.impressions || '0'),
      clicks: acc.clicks + parseFloat(insight.clicks || '0'),
      spend: acc.spend + parseFloat(insight.spend || '0'),
    }), { impressions: 0, clicks: 0, spend: 0 });

    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    };
  };

  const totals = calculateTotals(accountInsights);

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const getInsightData = (item: Campaign | AdSet | Ad) => {
    if (!item.insights?.data || item.insights.data.length === 0) {
      return { impressions: 0, clicks: 0, spend: 0, ctr: 0, cpc: 0 };
    }
    return calculateTotals(item.insights.data);
  };

  const getAccountStatusLabel = (status: number) => {
    switch (status) {
      case 1: return 'Active';
      case 2: return 'Disabled';
      case 3: return 'Unsettled';
      case 7: return 'Pending Review';
      case 8: return 'Pending Closure';
      case 9: return 'In Grace Period';
      case 100: return 'Pending Settlement';
      case 101: return 'Closed';
      case 201: return 'Any Active';
      case 202: return 'Any Closed';
      default: return 'Unknown';
    }
  };

  const selectedAccount = adAccounts.find(acc => acc.id === selectedAccountId);

  

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">Ads Insight Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Monitor your Facebook advertising performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {dataUpdatedAt && (
              <span className="text-sm text-muted-foreground">
                Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={handleRefresh}
              disabled={isLoading || !selectedAccountId}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {permissions.canExportAds && (
              <Button
                variant="outline"
                onClick={() => {
                  const exportData = campaigns.map(campaign => {
                    const data = getInsightData(campaign);
                    return {
                      name: campaign.name,
                      status: campaign.status,
                      impressions: data.impressions,
                      clicks: data.clicks,
                      spend: data.spend,
                      ctr: data.ctr,
                      cpc: data.cpc,
                    };
                  });
                  exportToCSV(
                    exportData,
                    [
                      { key: 'name', header: 'Campaign Name' },
                      { key: 'status', header: 'Status' },
                      { key: 'impressions', header: 'Impressions' },
                      { key: 'clicks', header: 'Clicks' },
                      { key: 'spend', header: 'Spend', getValue: (c) => `$${Number(c.spend).toFixed(2)}` },
                      { key: 'ctr', header: 'CTR', getValue: (c) => `${Number(c.ctr).toFixed(2)}%` },
                      { key: 'cpc', header: 'CPC', getValue: (c) => `$${Number(c.cpc).toFixed(2)}` },
                    ],
                    'ads_campaigns'
                  );
                }}
                disabled={campaigns.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Ad Account Selector */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Ad Accounts
            </CardTitle>
            <CardDescription>
              Select an ad account to view its performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAccounts ? (
              <div className="text-muted-foreground">Loading ad accounts...</div>
            ) : adAccounts.length === 0 ? (
              <div className="text-muted-foreground">
                No ad accounts found. Make sure your Facebook System User Token has access to ad accounts.
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-[400px]">
                    <SelectValue placeholder="Select an ad account" />
                  </SelectTrigger>
                  <SelectContent>
                    {adAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <span>{account.name}</span>
                          <span className="text-muted-foreground text-xs">
                            ({account.id.replace('act_', '')})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAccount && (
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedAccount.account_status === 1 ? 'default' : 'secondary'}>
                      {getAccountStatusLabel(selectedAccount.account_status)}
                    </Badge>
                    <Badge variant="outline">{selectedAccount.currency}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {selectedAccount.timezone_name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedAccountId && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totals.spend)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(totals.impressions)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clicks</CardTitle>
                  <MousePointer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(totals.clicks)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg CPC</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totals.cpc)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    CTR: {formatPercent(totals.ctr)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for different views */}
            <Tabs defaultValue="campaigns" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="campaigns">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Campaigns
                </TabsTrigger>
                <TabsTrigger value="adsets" onClick={() => setFetchAdSets(true)}>
                  Ad Sets
                </TabsTrigger>
                <TabsTrigger value="ads" onClick={() => setFetchAdsFlag(true)}>
                  Individual Ads
                </TabsTrigger>
              </TabsList>

              <TabsContent value="campaigns">
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Performance</CardTitle>
                    <CardDescription>
                      Overview of all your advertising campaigns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading campaigns...
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No campaigns found for this account.
                      </div>
                    ) : (
                      <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Campaign Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Impressions</TableHead>
                                <TableHead className="text-right">Clicks</TableHead>
                                <TableHead className="text-right">Spend</TableHead>
                                <TableHead className="text-right">CTR</TableHead>
                                <TableHead className="text-right">CPC</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {campaigns.map((campaign) => {
                                const data = getInsightData(campaign);
                                return (
                                  <TableRow key={campaign.id}>
                                    <TableCell className="font-medium">{campaign.name}</TableCell>
                                    <TableCell>
                                      <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                        {campaign.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{formatNumber(data.impressions)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(data.clicks)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(data.spend)}</TableCell>
                                    <TableCell className="text-right">{formatPercent(data.ctr)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(data.cpc)}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="adsets">
                <Card>
                  <CardHeader>
                    <CardTitle>Ad Set Performance</CardTitle>
                    <CardDescription>
                      Detailed performance metrics for each ad set
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading ad sets...
                      </div>
                    ) : adSets.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No ad sets found.
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ad Set Name</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Impressions</TableHead>
                              <TableHead className="text-right">Clicks</TableHead>
                              <TableHead className="text-right">Spend</TableHead>
                              <TableHead className="text-right">CTR</TableHead>
                              <TableHead className="text-right">CPC</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adSets.map((adSet) => {
                              const data = getInsightData(adSet);
                              return (
                                <TableRow key={adSet.id}>
                                  <TableCell className="font-medium">{adSet.name}</TableCell>
                                  <TableCell>
                                    <Badge variant={adSet.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                      {adSet.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">{formatNumber(data.impressions)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(data.clicks)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(data.spend)}</TableCell>
                                  <TableCell className="text-right">{formatPercent(data.ctr)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(data.cpc)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ads">
                <Card>
                  <CardHeader>
                    <CardTitle>Individual Ads Performance</CardTitle>
                    <CardDescription>
                      Performance metrics for each individual ad
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading ads...
                      </div>
                    ) : ads.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No ads found.
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ad Name</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Impressions</TableHead>
                              <TableHead className="text-right">Clicks</TableHead>
                              <TableHead className="text-right">Spend</TableHead>
                              <TableHead className="text-right">CTR</TableHead>
                              <TableHead className="text-right">CPC</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ads.map((ad) => {
                              const data = getInsightData(ad);
                              return (
                                <TableRow 
                                  key={ad.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => navigate(`/ads-insight/${ad.id}`)}
                                >
                                  <TableCell className="font-medium">{ad.name}</TableCell>
                                  <TableCell>
                                    <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                      {ad.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">{formatNumber(data.impressions)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(data.clicks)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(data.spend)}</TableCell>
                                  <TableCell className="text-right">{formatPercent(data.ctr)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(data.cpc)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default AdsInsight;