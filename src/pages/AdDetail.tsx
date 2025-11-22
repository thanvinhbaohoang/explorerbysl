import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Eye, MousePointer, DollarSign, Target, TrendingUp } from "lucide-react";

interface AdDetail {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative?: {
    id: string;
    name: string;
    title?: string;
    body?: string;
    image_url?: string;
    video_id?: string;
    thumbnail_url?: string;
    object_story_spec?: any;
  };
  targeting?: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    geo_locations?: any;
    interests?: any[];
  };
  insights?: {
    data: Array<{
      impressions: string;
      clicks: string;
      spend: string;
      ctr: string;
      cpc: string;
      cpm: string;
      reach?: string;
      frequency?: string;
      actions?: any[];
      cost_per_action_type?: any[];
    }>;
  };
}

const AdDetail = () => {
  const { adId } = useParams<{ adId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [adDetail, setAdDetail] = useState<AdDetail | null>(null);

  const fetchAdDetail = async () => {
    if (!adId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-ads', {
        body: {
          adId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data) {
        setAdDetail(data);
        toast.success('Ad details loaded successfully');
      }
    } catch (error: any) {
      console.error('Error fetching ad details:', error);
      toast.error('Failed to fetch ad details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdDetail();
  }, [adId]);

  const formatCurrency = (value: string | number) => `$${parseFloat(value.toString()).toFixed(2)}`;
  const formatNumber = (value: string | number) => parseFloat(value.toString()).toLocaleString();
  const formatPercent = (value: string | number) => `${parseFloat(value.toString()).toFixed(2)}%`;

  const insights = adDetail?.insights?.data?.[0];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading ad details...</p>
        </div>
      </div>
    );
  }

  if (!adDetail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No ad details found</p>
          <Button onClick={() => navigate('/ads-insight')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/ads-insight')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">Ad Details</h1>
              <p className="text-muted-foreground mt-2">{adDetail.name}</p>
            </div>
          </div>
          <Button
            onClick={fetchAdDetail}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Status and Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={adDetail.status === 'ACTIVE' ? 'default' : 'secondary'} className="mt-1">
                  {adDetail.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ad ID</p>
                <p className="font-mono text-sm mt-1">{adDetail.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ad Set ID</p>
                <p className="font-mono text-sm mt-1">{adDetail.adset_id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        {insights && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(insights.impressions)}</div>
                {insights.reach && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Reach: {formatNumber(insights.reach)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clicks</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(insights.clicks)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  CTR: {formatPercent(insights.ctr)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(insights.spend)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  CPM: {formatCurrency(insights.cpm)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost Per Click</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(insights.cpc)}</div>
                {insights.frequency && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Frequency: {parseFloat(insights.frequency).toFixed(2)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Creative Details */}
        {adDetail.creative && (
          <Card>
            <CardHeader>
              <CardTitle>Creative</CardTitle>
              <CardDescription>Ad creative content and media</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {adDetail.creative.title && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Title</p>
                  <p className="mt-1">{adDetail.creative.title}</p>
                </div>
              )}
              {adDetail.creative.body && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Body</p>
                  <p className="mt-1">{adDetail.creative.body}</p>
                </div>
              )}
              {adDetail.creative.image_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Image</p>
                  <img 
                    src={adDetail.creative.image_url} 
                    alt="Ad creative" 
                    className="rounded-lg max-w-md border"
                  />
                </div>
              )}
              {adDetail.creative.thumbnail_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Video Thumbnail</p>
                  <img 
                    src={adDetail.creative.thumbnail_url} 
                    alt="Video thumbnail" 
                    className="rounded-lg max-w-md border"
                  />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Creative ID</p>
                <p className="font-mono text-sm mt-1">{adDetail.creative.id}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Targeting Details */}
        {adDetail.targeting && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Targeting
              </CardTitle>
              <CardDescription>Audience targeting settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(adDetail.targeting.age_min || adDetail.targeting.age_max) && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Age Range</p>
                    <p className="mt-1">
                      {adDetail.targeting.age_min || 'N/A'} - {adDetail.targeting.age_max || 'N/A'} years
                    </p>
                  </div>
                )}
                {adDetail.targeting.genders && adDetail.targeting.genders.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Genders</p>
                    <p className="mt-1">
                      {adDetail.targeting.genders.map(g => g === 1 ? 'Male' : g === 2 ? 'Female' : 'All').join(', ')}
                    </p>
                  </div>
                )}
              </div>
              {adDetail.targeting.geo_locations && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Geographic Locations</p>
                  <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto">
                    {JSON.stringify(adDetail.targeting.geo_locations, null, 2)}
                  </pre>
                </div>
              )}
              {adDetail.targeting.interests && adDetail.targeting.interests.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Interests</p>
                  <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto">
                    {JSON.stringify(adDetail.targeting.interests, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {insights?.actions && insights.actions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Conversions and user actions</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto">
                {JSON.stringify(insights.actions, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdDetail;
