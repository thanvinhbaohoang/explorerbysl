import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SETTING_KEY = "messenger_integration_enabled";

export const useMessengerIntegration = () => {
  const queryClient = useQueryClient();

  const { data: isEnabled = false, isLoading } = useQuery({
    queryKey: ["messenger-integration-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .maybeSingle();

      if (error) throw error;
      // Default to false (disabled) if no setting exists
      return data?.value === "true";
    },
    staleTime: 60 * 1000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: existing } = await supabase
        .from("bot_settings")
        .select("id")
        .eq("key", SETTING_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("bot_settings")
          .update({ value: String(enabled), updated_at: new Date().toISOString() })
          .eq("key", SETTING_KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bot_settings")
          .insert({ key: SETTING_KEY, value: String(enabled) });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messenger-integration-enabled"] });
      // Also invalidate customer data so lists refresh
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  return { isEnabled, isLoading, toggle: toggleMutation.mutate, isToggling: toggleMutation.isPending };
};
