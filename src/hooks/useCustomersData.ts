import { useQuery, keepPreviousData } from "@tanstack/react-query";
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

export const customersQueryKey = (
  page: number,
  itemsPerPage: number,
  searchTerm: string,
  platformFilter: string,
  messengerEnabled: boolean,
) => ["customers", page, itemsPerPage, searchTerm, platformFilter, messengerEnabled] as const;

export const fetchCustomersPage = async (
  page: number,
  itemsPerPage: number,
  searchTerm: string,
  platformFilter: string,
  messengerEnabled: boolean,
): Promise<CustomersData> => {
  // Build base query for count
  let countQuery = supabase
    .from("customer")
    .select("*", { count: "exact", head: true })
    .is("linked_customer_id", null);

  if (!messengerEnabled) {
    countQuery = countQuery.or("messenger_id.is.null,messenger_name.neq.Unknown");
  }

  if (platformFilter === "telegram") {
    countQuery = countQuery.not("telegram_id", "is", null).is("messenger_id", null);
  } else if (platformFilter === "messenger") {
    countQuery = countQuery.not("messenger_id", "is", null);
  }

  if (searchTerm) {
    countQuery = countQuery.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,messenger_name.ilike.%${searchTerm}%`);
  }

  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  const from = (page - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  let dataQuery = supabase
    .from("customer")
    .select("*")
    .is("linked_customer_id", null);

  if (!messengerEnabled) {
    dataQuery = dataQuery.or("messenger_id.is.null,messenger_name.neq.Unknown");
  }

  if (platformFilter === "telegram") {
    dataQuery = dataQuery.not("telegram_id", "is", null).is("messenger_id", null);
  } else if (platformFilter === "messenger") {
    dataQuery = dataQuery.not("messenger_id", "is", null);
  }

  if (searchTerm) {
    dataQuery = dataQuery.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,messenger_name.ilike.%${searchTerm}%`);
  }

  const { data: customersData, error } = await dataQuery
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) throw error;

  let linkedPlatformsMap: LinkedPlatformsMap = {};
  let customersWithLeads = (customersData || []) as Customer[];

  if (customersData && customersData.length > 0) {
    const customerIds = customersData.map(c => c.id);

    const { data: linkedCustomers } = await supabase
      .from("customer")
      .select("id, linked_customer_id, telegram_id, messenger_id")
      .in("linked_customer_id", customerIds);

    customersData.forEach(customer => {
      const linkedToThis = linkedCustomers?.filter(lc => lc.linked_customer_id === customer.id) || [];
      const linkedIds = linkedToThis.map(lc => lc.id);
      const hasTelegram = customer.telegram_id !== null || linkedToThis.some(lc => lc.telegram_id !== null);
      const hasMessenger = customer.messenger_id !== null || linkedToThis.some(lc => lc.messenger_id !== null);

      linkedPlatformsMap[customer.id] = {
        telegram: hasTelegram,
        messenger: hasMessenger,
        linkedIds: linkedIds,
      };
    });

    const { data: leadsData } = await supabase
      .from("telegram_leads")
      .select("user_id, messenger_ref, campaign_name, ad_name, adset_name, referrer")
      .in("user_id", customerIds);

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
};

export const useCustomersData = (page: number, itemsPerPage: number = 10, searchTerm: string = "", platformFilter: string = "all", messengerEnabled: boolean = true) => {
  return useQuery({
    queryKey: customersQueryKey(page, itemsPerPage, searchTerm, platformFilter, messengerEnabled),
    queryFn: () => fetchCustomersPage(page, itemsPerPage, searchTerm, platformFilter, messengerEnabled),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

