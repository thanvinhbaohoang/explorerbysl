import { useQuery, keepPreviousData, type QueryClient } from "@tanstack/react-query";
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

export type ConversationFilter = "all" | "unread" | "not_replied";

export const customersQueryKey = (
  page: number,
  itemsPerPage: number,
  searchTerm: string,
  platformFilter: string,
  messengerEnabled: boolean,
  filter: ConversationFilter = "all",
) =>
  // The "all" key is exactly the original 6-element key; filtered modes
  // append the filter as a 7th element so All caches are never disturbed.
  filter === "all"
    ? (["customers", page, itemsPerPage, searchTerm, platformFilter, messengerEnabled] as const)
    : (["customers", page, itemsPerPage, searchTerm, platformFilter, messengerEnabled, filter] as const);

export const fetchCustomersPage = async (
  page: number,
  itemsPerPage: number,
  searchTerm: string,
  platformFilter: string,
  messengerEnabled: boolean,
  filter: ConversationFilter = "all",
): Promise<CustomersData> => {
  // Filtered modes: fetch matching IDs + total from the RPC, then hydrate rows.
  if (filter !== "all") {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_filtered_customer_ids", {
      p_filter: filter,
      p_search: searchTerm,
      p_platform: platformFilter,
      p_messenger_enabled: messengerEnabled,
      p_limit: itemsPerPage,
      p_offset: (page - 1) * itemsPerPage,
    });

    if (rpcError) throw rpcError;

    // Defensive validation: malformed JSON must surface as an error,
    // never as an apparently empty inbox.
    const result = rpcData as { customer_ids?: unknown; total_count?: unknown } | null;
    if (
      !result ||
      !Array.isArray(result.customer_ids) ||
      typeof result.total_count !== "number"
    ) {
      throw new Error("Malformed response from get_filtered_customer_ids");
    }

    const ids = result.customer_ids as string[];
    const total = result.total_count;

    if (ids.length === 0) {
      return { customers: [], total, linkedPlatformsMap: {} };
    }

    const { data: rows, error: rowsError } = await supabase
      .from("customer")
      .select("*")
      .in("id", ids);

    if (rowsError) throw rowsError;

    // .in() does not preserve order — re-order to match the RPC's ID order
    const byId = new Map((rows || []).map(r => [r.id, r]));
    const ordered = ids.map(id => byId.get(id)).filter(Boolean) as Customer[];

    let customersWithLeads = ordered;
    const { data: leadsData } = await supabase
      .from("telegram_leads")
      .select("user_id, messenger_ref, referrer")
      .in("user_id", ids);

    customersWithLeads = ordered.map(customer => ({
      ...customer,
      lead_source: leadsData?.find(lead => lead.user_id === customer.id),
    })) as Customer[];

    return { customers: customersWithLeads, total, linkedPlatformsMap: {} };
  }

  // "all": existing code path, unchanged.
  // Build base query for count - each platform account is its own conversation
  let countQuery = supabase
    .from("customer")
    .select("*", { count: "exact", head: true });

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
    .select("*");

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

  let customersWithLeads = (customersData || []) as Customer[];

  if (customersData && customersData.length > 0) {
    const customerIds = customersData.map(c => c.id);

    const { data: leadsData } = await supabase
      .from("telegram_leads")
      .select("user_id, messenger_ref, referrer")
      .in("user_id", customerIds);

    customersWithLeads = customersData.map(customer => ({
      ...customer,
      lead_source: leadsData?.find(lead => lead.user_id === customer.id),
    })) as Customer[];
  }

  return {
    customers: customersWithLeads,
    total: count || 0,
    linkedPlatformsMap: {},
  };
};


export const useCustomersData = (page: number, itemsPerPage: number = 10, searchTerm: string = "", platformFilter: string = "all", messengerEnabled: boolean = true, filter: ConversationFilter = "all") => {
  return useQuery({
    queryKey: customersQueryKey(page, itemsPerPage, searchTerm, platformFilter, messengerEnabled, filter),
    queryFn: () => fetchCustomersPage(page, itemsPerPage, searchTerm, platformFilter, messengerEnabled, filter),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    // Filtered tabs always re-check the server when the list mounts so changes
    // made elsewhere (e.g. another staff member reading a chat) are picked up.
    // All keeps its original refetch behavior.
    ...(filter !== "all" ? { refetchOnMount: "always" as const } : {}),
  });
};

// Invalidate EVERY cached page of one filtered tab. Matches only keys whose
// 7th element is the filter; the 6-element All key can never match.
export const invalidateFilteredCustomerCaches = (
  queryClient: QueryClient,
  filter: Exclude<ConversationFilter, "all">,
) =>
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey.length === 7 &&
      query.queryKey[0] === "customers" &&
      query.queryKey[6] === filter,
  });

