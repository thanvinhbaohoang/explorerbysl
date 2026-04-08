import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export const useTrafficFilterOptions = () => {
  return useQuery({
    queryKey: ["traffic-filter-options"],
    queryFn: async () => {
      const [sourcesRes, campaignsRes, postTagsRes] = await Promise.all([
        supabase.from("telegram_leads").select("utm_source").not("utm_source", "is", null),
        supabase.from("telegram_leads").select("utm_campaign").not("utm_campaign", "is", null),
        supabase.from("telegram_leads").select("messenger_ref").not("messenger_ref", "is", null).neq("messenger_ref", "direct_message"),
      ]);

      return {
        sources: [...new Set(sourcesRes.data?.map(s => s.utm_source).filter(Boolean))] as string[],
        campaigns: [...new Set(campaignsRes.data?.map(c => c.utm_campaign).filter(Boolean))] as string[],
        postTags: [...new Set(postTagsRes.data?.map(p => p.messenger_ref).filter(Boolean))] as string[],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

interface TrafficQueryParams {
  page: number;
  searchTerm: string;
  sourceFilter: string;
  campaignFilter: string;
  platformFilter: string;
  postTagFilter: string;
  startDate?: string;
  endDate?: string;
  itemsPerPage: number;
}

export const useTrafficData = (params: TrafficQueryParams) => {
  const { page, searchTerm, sourceFilter, campaignFilter, platformFilter, postTagFilter, startDate, endDate, itemsPerPage } = params;

  return useQuery({
    queryKey: ["traffic", page, searchTerm, sourceFilter, campaignFilter, platformFilter, postTagFilter, startDate, endDate],
    queryFn: async () => {
      let userIdsToInclude: string[] = [];

      // If searching for customer names, find matching customers first
      if (searchTerm) {
        const { data: matchingCustomers } = await supabase
          .from("customer")
          .select("id")
          .or(`username.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,messenger_name.ilike.%${searchTerm}%`);
        userIdsToInclude = matchingCustomers?.map(c => c.id) || [];
      }

      // Build query with filters
      let countQuery = supabase.from("telegram_leads").select("*", { count: "exact", head: true });
      let dataQuery = supabase.from("telegram_leads").select("id, facebook_click_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_adset_id, utm_ad_id, utm_campaign_id, referrer, messenger_ref, messenger_ad_context, platform, created_at, user_id");

      // Apply global search
      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        const leadsSearchCondition = userIdsToInclude.length > 0
          ? `utm_source.ilike.${searchPattern},utm_campaign.ilike.${searchPattern},utm_medium.ilike.${searchPattern},utm_content.ilike.${searchPattern},facebook_click_id.ilike.${searchPattern},messenger_ref.ilike.${searchPattern},user_id.in.(${userIdsToInclude.join(',')})`
          : `utm_source.ilike.${searchPattern},utm_campaign.ilike.${searchPattern},utm_medium.ilike.${searchPattern},utm_content.ilike.${searchPattern},facebook_click_id.ilike.${searchPattern},messenger_ref.ilike.${searchPattern}`;
        countQuery = countQuery.or(leadsSearchCondition);
        dataQuery = dataQuery.or(leadsSearchCondition);
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
      if (platformFilter && platformFilter !== "all") {
        countQuery = countQuery.eq("platform", platformFilter);
        dataQuery = dataQuery.eq("platform", platformFilter);
      }
      if (postTagFilter && postTagFilter !== "all") {
        countQuery = countQuery.eq("messenger_ref", postTagFilter);
        dataQuery = dataQuery.eq("messenger_ref", postTagFilter);
      }
      if (startDate) {
        countQuery = countQuery.gte("created_at", startDate);
        dataQuery = dataQuery.gte("created_at", startDate);
      }
      if (endDate) {
        countQuery = countQuery.lt("created_at", endDate);
        dataQuery = dataQuery.lt("created_at", endDate);
      }

      const { count } = await countQuery;
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: leads, error } = await dataQuery.order("created_at", { ascending: false }).range(from, to);
      if (error) throw error;

      // Fetch customer data for each lead
      const trafficWithCustomers = await Promise.all(
        (leads || []).map(async (lead) => {
          if (lead.user_id) {
            const { data: customer } = await supabase
              .from("customer")
              .select("id, telegram_id, username, first_name, last_name, messenger_id, messenger_name, first_message_at")
              .eq("id", lead.user_id)
              .maybeSingle();

            const leadCreatedAt = new Date(lead.created_at || '');
            const customerFirstMessage = customer?.first_message_at ? new Date(customer.first_message_at) : null;
            const isNewCustomer = customerFirstMessage ? Math.abs(leadCreatedAt.getTime() - customerFirstMessage.getTime()) < 60000 : false;

            return {
              ...lead,
              messenger_ad_context: lead.messenger_ad_context as MessengerAdContext | null,
              customer,
              isNewCustomer,
            };
          }
          return {
            ...lead,
            messenger_ad_context: lead.messenger_ad_context as MessengerAdContext | null,
            customer: null,
            isNewCustomer: false,
          };
        })
      );

      return { data: trafficWithCustomers as TrafficData[], total: count || 0 };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
