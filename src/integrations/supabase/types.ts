export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      customer: {
        Row: {
          created_at: string
          detected_language: string | null
          first_message_at: string
          first_name: string | null
          id: string
          is_premium: boolean | null
          language_code: string | null
          last_message_at: string | null
          last_name: string | null
          linked_customer_id: string | null
          locale: string | null
          messenger_id: string | null
          messenger_name: string | null
          messenger_profile_pic: string | null
          page_id: string | null
          telegram_id: number | null
          timezone_offset: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          detected_language?: string | null
          first_message_at?: string
          first_name?: string | null
          id?: string
          is_premium?: boolean | null
          language_code?: string | null
          last_message_at?: string | null
          last_name?: string | null
          linked_customer_id?: string | null
          locale?: string | null
          messenger_id?: string | null
          messenger_name?: string | null
          messenger_profile_pic?: string | null
          page_id?: string | null
          telegram_id?: number | null
          timezone_offset?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          detected_language?: string | null
          first_message_at?: string
          first_name?: string | null
          id?: string
          is_premium?: boolean | null
          language_code?: string | null
          last_message_at?: string | null
          last_name?: string | null
          linked_customer_id?: string | null
          locale?: string | null
          messenger_id?: string | null
          messenger_name?: string | null
          messenger_profile_pic?: string | null
          page_id?: string | null
          telegram_id?: number | null
          timezone_offset?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_linked_customer_id_fkey"
            columns: ["linked_customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_action_items: {
        Row: {
          action_text: string
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          customer_id: string
          id: string
          is_completed: boolean
        }
        Insert: {
          action_text: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_completed?: boolean
        }
        Update: {
          action_text?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_action_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          customer_id: string
          id: string
          note_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_id: string
          id?: string
          note_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_id?: string
          id?: string
          note_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_summaries: {
        Row: {
          created_at: string
          customer_id: string
          generated_at: string
          id: string
          message_count: number
          summary_data: Json
        }
        Insert: {
          created_at?: string
          customer_id: string
          generated_at?: string
          id?: string
          message_count?: number
          summary_data: Json
        }
        Update: {
          created_at?: string
          customer_id?: string
          generated_at?: string
          id?: string
          message_count?: number
          summary_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "customer_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_pages: {
        Row: {
          access_token: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          page_id: string
          picture_url: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          page_id: string
          picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          page_id?: string
          picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          is_read: boolean | null
          message_text: string | null
          message_type: string | null
          messenger_mid: string | null
          photo_file_id: string | null
          photo_url: string | null
          platform: string
          sender_type: string | null
          sent_by_name: string | null
          telegram_id: number | null
          timestamp: string
          video_duration: number | null
          video_file_id: string | null
          video_mime_type: string | null
          video_url: string | null
          voice_duration: number | null
          voice_file_id: string | null
          voice_transcription: string | null
          voice_url: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string | null
          message_type?: string | null
          messenger_mid?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          platform?: string
          sender_type?: string | null
          sent_by_name?: string | null
          telegram_id?: number | null
          timestamp?: string
          video_duration?: number | null
          video_file_id?: string | null
          video_mime_type?: string | null
          video_url?: string | null
          voice_duration?: number | null
          voice_file_id?: string | null
          voice_transcription?: string | null
          voice_url?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string | null
          message_type?: string | null
          messenger_mid?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          platform?: string
          sender_type?: string | null
          sent_by_name?: string | null
          telegram_id?: number | null
          timestamp?: string
          video_duration?: number | null
          video_file_id?: string | null
          video_mime_type?: string | null
          video_url?: string | null
          voice_duration?: number | null
          voice_file_id?: string | null
          voice_transcription?: string | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_leads: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          created_at: string | null
          facebook_click_id: string | null
          id: string
          messenger_ad_context: Json | null
          messenger_ref: string | null
          platform: string
          referrer: string | null
          updated_at: string | null
          user_id: string | null
          utm_ad_id: string | null
          utm_adset_id: string | null
          utm_campaign: string | null
          utm_campaign_id: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string | null
          facebook_click_id?: string | null
          id?: string
          messenger_ad_context?: Json | null
          messenger_ref?: string | null
          platform?: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
          utm_ad_id?: string | null
          utm_adset_id?: string | null
          utm_campaign?: string | null
          utm_campaign_id?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string | null
          facebook_click_id?: string | null
          id?: string
          messenger_ad_context?: Json | null
          messenger_ref?: string | null
          platform?: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
          utm_ad_id?: string | null
          utm_adset_id?: string | null
          utm_campaign?: string | null
          utm_campaign_id?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
