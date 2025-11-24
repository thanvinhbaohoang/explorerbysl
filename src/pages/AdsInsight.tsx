import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, DollarSign, MousePointer, Eye, RefreshCw, ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

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

interface AccountInfo {
  id: string;
  name: string;
  account_status: string;
  currency: string;
  timezone_name: string;
}

const AdsInsight = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [accountInsights, setAccountInsights] = useState<Insight[]>([]);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAccountInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-ads', {
        body: { level: 'account-info' },
      });

      if (error) throw error;
      if (data?.error) {
        console.error('Failed to fetch account info:', data.error);
        return;
      }

      if (data?.data) {
        setAccountInfo(data.data);
      }
    } catch (error: any) {
      console.error('Error fetching account info:', error);
    }
  };

  const fetchAdsData = async (level: 'account' | 'campaigns' | 'adsets' | 'ads') => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-ads', {
        body: {
          level,
          startDate: '2024-01-01',
          endDate: new Date().toISOString().split('T')[0],
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (level === 'account' && data?.data?.data) {
        setAccountInsights(data.data.data);
      } else if (level === 'campaigns' && data?.data?.data) {
        setCampaigns(data.data.data);
      } else if (level === 'adsets' && data?.data?.data) {
        setAdSets(data.data.data);
      } else if (level === 'ads' && data?.data?.data) {
        setAds(data.data.data);
      }

      setLastRefreshed(new Date());
      toast.success(`${level} data refreshed successfully`);
    } catch (error: any) {
      console.error('Error fetching ads data:', error);
      toast.error('Failed to fetch ads data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountInfo();
    fetchAdsData('account');
    fetchAdsData('campaigns');
  }, []);

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

  const COLORS = ['hsl(0, 0%, 0%)', 'hsl(0, 0%, 20%)', 'hsl(0, 0%, 40%)', 'hsl(0, 0%, 60%)', 'hsl(0, 0%, 80%)'];

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
              {accountInfo && (
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    {accountInfo.name}
                  </Badge>
                  <Badge variant="secondary" className="text-sm font-mono">
                    ID: {accountInfo.id.replace('act_', '')}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastRefreshed && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={() => {
                fetchAdsData('account');
                fetchAdsData('campaigns');
              }}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

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
            <TabsTrigger value="adsets" onClick={() => adSets.length === 0 && fetchAdsData('adsets')}>
              Ad Sets
            </TabsTrigger>
            <TabsTrigger value="ads" onClick={() => ads.length === 0 && fetchAdsData('ads')}>
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
                    No campaigns found. Make sure your Facebook credentials are configured correctly.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Pie Chart */}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={campaigns.map(campaign => {
                              const data = getInsightData(campaign);
                              return {
                                name: campaign.name,
                                value: data.spend,
                              };
                            })}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                            outerRadius={80}
                            fill="hsl(var(--foreground))"
                            dataKey="value"
                          >
                            {campaigns.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Table */}
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
      </div>
    </div>
  );
};

export default AdsInsight;