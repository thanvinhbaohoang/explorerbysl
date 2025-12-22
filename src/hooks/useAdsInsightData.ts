import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}

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

export const useAdAccounts = () => {
  return useQuery({
    queryKey: ["ad-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-ads', {
        body: { level: 'ad-accounts' },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return (data?.data || []) as AdAccount[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useAccountInsights = (accountId: string) => {
  return useQuery({
    queryKey: ["account-insights", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-ads', {
        body: {
          level: 'account',
          accountId,
          startDate: '2024-01-01',
          endDate: new Date().toISOString().split('T')[0],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return (data?.data?.data || []) as Insight[];
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useCampaigns = (accountId: string) => {
  return useQuery({
    queryKey: ["campaigns", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-ads', {
        body: {
          level: 'campaigns',
          accountId,
          startDate: '2024-01-01',
          endDate: new Date().toISOString().split('T')[0],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return (data?.data?.data || []) as Campaign[];
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useAdSets = (accountId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ["adsets", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-ads', {
        body: {
          level: 'adsets',
          accountId,
          startDate: '2024-01-01',
          endDate: new Date().toISOString().split('T')[0],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return (data?.data?.data || []) as AdSet[];
    },
    enabled: !!accountId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useAds = (accountId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ["ads", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-ads', {
        body: {
          level: 'ads',
          accountId,
          startDate: '2024-01-01',
          endDate: new Date().toISOString().split('T')[0],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return (data?.data?.data || []) as Ad[];
    },
    enabled: !!accountId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
