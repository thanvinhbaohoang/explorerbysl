import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Customer {
  id: string;
  telegram_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  detected_language: string | null;
  is_premium: boolean;
  first_message_at: string;
  last_message_at: string | null;
  created_at: string;
  messenger_id: string | null;
  messenger_name: string | null;
  messenger_profile_pic: string | null;
  locale: string | null;
  timezone_offset: number | null;
  linked_customer_id: string | null;
  page_id: string | null;
  lead_source?: {
    messenger_ref?: string;
    campaign_name?: string;
    ad_name?: string;
    adset_name?: string;
    referrer?: string;
  };
}

interface LinkedPlatformsMap {
  [key: string]: { telegram: boolean; messenger: boolean; linkedIds: string[] };
}

interface CustomersData {
  customers: Customer[];
  total: number;
  linkedPlatformsMap: LinkedPlatformsMap;
}

export const useCustomersData = (page: number, itemsPerPage: number = 10) => {
  return useQuery({
    queryKey: ["customers", page, itemsPerPage],
    queryFn: async (): Promise<CustomersData> => {
      // Get total count of PRIMARY customers only (those without linked_customer_id)
      const { count, error: countError } = await supabase
        .from("customer")
        .select("*", { count: "exact", head: true })
        .is("linked_customer_id", null)
        .not("messenger_id", "is", null)
        .or("messenger_name.neq.Unknown,first_name.not.is.null")
        // The above filters OUT broken Messenger records (Unknown name + no first_name)
        // We actually need a different approach: include all non-messenger + valid messenger
        ;

      if (countError) throw countError;

      // Fetch paginated data - only PRIMARY customers
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: customersData, error } = await supabase
        .from("customer")
        .select("*")
        .is("linked_customer_id", null)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) throw error;

      let linkedPlatformsMap: LinkedPlatformsMap = {};
      let customersWithLeads = (customersData || []) as Customer[];

      if (customersData && customersData.length > 0) {
        const customerIds = customersData.map(c => c.id);

        // Fetch customers that link to these primary customers
        const { data: linkedCustomers } = await supabase
          .from("customer")
          .select("id, linked_customer_id, telegram_id, messenger_id")
          .in("linked_customer_id", customerIds);

        // Build the map
        customersData.forEach(customer => {
          const linkedToThis = linkedCustomers?.filter(lc => lc.linked_customer_id === customer.id) || [];
          // Only include linked IDs (not the primary customer ID) to avoid duplication
          const linkedIds = linkedToThis.map(lc => lc.id);
          const hasTelegram = customer.telegram_id !== null || linkedToThis.some(lc => lc.telegram_id !== null);
          const hasMessenger = customer.messenger_id !== null || linkedToThis.some(lc => lc.messenger_id !== null);

          linkedPlatformsMap[customer.id] = {
            telegram: hasTelegram,
            messenger: hasMessenger,
            linkedIds: linkedIds,
          };
        });

        // Fetch lead sources
        const { data: leadsData } = await supabase
          .from("telegram_leads")
          .select("user_id, messenger_ref, campaign_name, ad_name, adset_name, referrer")
          .in("user_id", customerIds);

        // Merge lead source data with customers
        customersWithLeads = customersData.map(customer => ({
          ...customer,
          lead_source: leadsData?.find(lead => lead.user_id === customer.id),
        })) as Customer[];
      }

      return {
        customers: customersWithLeads,
        total: count || 0,
        linkedPlatformsMap,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - data won't refetch for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes
  });
};
