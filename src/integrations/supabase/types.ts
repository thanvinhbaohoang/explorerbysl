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
      bot_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      connected_pages: {
        Row: {
          created_at: string
          id: string
          page_access_token: string
          page_id: string
          page_name: string
          token_expires_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_access_token: string
          page_id: string
          page_name: string
          token_expires_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_access_token?: string
          page_id?: string
          page_name?: string
          token_expires_at?: string | null
        }
        Relationships: []
      }
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
          legal_first_name: string | null
          legal_last_name: string | null
          legal_middle_name: string | null
          linked_customer_id: string | null
          locale: string | null
          messenger_id: string | null
          messenger_name: string | null
          messenger_profile_pic: string | null
          national_id: string | null
          nationality: string | null
          page_id: string | null
          passport_number: string | null
          sex: string | null
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
          legal_first_name?: string | null
          legal_last_name?: string | null
          legal_middle_name?: string | null
          linked_customer_id?: string | null
          locale?: string | null
          messenger_id?: string | null
          messenger_name?: string | null
          messenger_profile_pic?: string | null
          national_id?: string | null
          nationality?: string | null
          page_id?: string | null
          passport_number?: string | null
          sex?: string | null
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
          legal_first_name?: string | null
          legal_last_name?: string | null
          legal_middle_name?: string | null
          linked_customer_id?: string | null
          locale?: string | null
          messenger_id?: string | null
          messenger_name?: string | null
          messenger_profile_pic?: string | null
          national_id?: string | null
          nationality?: string | null
          page_id?: string | null
          passport_number?: string | null
          sex?: string | null
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
      fb_contacts: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          page_id: string
          profile_pic: string | null
          psid: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          page_id: string
          profile_pic?: string | null
          psid: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          page_id?: string
          profile_pic?: string | null
          psid?: string
        }
        Relationships: []
      }
      fb_messages: {
        Row: {
          created_time: string
          direction: string
          id: string
          message_text: string | null
          page_id: string
          psid: string
        }
        Insert: {
          created_time?: string
          direction?: string
          id?: string
          message_text?: string | null
          page_id: string
          psid: string
        }
        Update: {
          created_time?: string
          direction?: string
          id?: string
          message_text?: string | null
          page_id?: string
          psid?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          customer_id: string | null
          document_mime_type: string | null
          document_name: string | null
          document_size: number | null
          document_url: string | null
          id: string
          is_read: boolean | null
          latitude: number | null
          location_address: string | null
          location_live_period: number | null
          location_title: string | null
          longitude: number | null
          media_group_id: string | null
          message_text: string | null
          message_type: string | null
          messenger_mid: string | null
          photo_file_id: string | null
          photo_url: string | null
          platform: string
          sender_type: string | null
          sent_by_name: string | null
          telegram_id: number | null
          telegram_message_id: number | null
          telegram_update_id: number | null
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
          document_mime_type?: string | null
          document_name?: string | null
          document_size?: number | null
          document_url?: string | null
          id?: string
          is_read?: boolean | null
          latitude?: number | null
          location_address?: string | null
          location_live_period?: number | null
          location_title?: string | null
          longitude?: number | null
          media_group_id?: string | null
          message_text?: string | null
          message_type?: string | null
          messenger_mid?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          platform?: string
          sender_type?: string | null
          sent_by_name?: string | null
          telegram_id?: number | null
          telegram_message_id?: number | null
          telegram_update_id?: number | null
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
          document_mime_type?: string | null
          document_name?: string | null
          document_size?: number | null
          document_url?: string | null
          id?: string
          is_read?: boolean | null
          latitude?: number | null
          location_address?: string | null
          location_live_period?: number | null
          location_title?: string | null
          longitude?: number | null
          media_group_id?: string | null
          message_text?: string | null
          message_type?: string | null
          messenger_mid?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          platform?: string
          sender_type?: string | null
          sent_by_name?: string | null
          telegram_id?: number | null
          telegram_message_id?: number | null
          telegram_update_id?: number | null
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
      messenger_webhook_events: {
        Row: {
          body: Json | null
          event_kinds: string[] | null
          has_echo: boolean | null
          id: string
          page_id: string | null
          received_at: string
        }
        Insert: {
          body?: Json | null
          event_kinds?: string[] | null
          has_echo?: boolean | null
          id?: string
          page_id?: string | null
          received_at?: string
        }
        Update: {
          body?: Json | null
          event_kinds?: string[] | null
          has_echo?: boolean | null
          id?: string
          page_id?: string | null
          received_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_system: boolean
          name: string
          permissions: Json
          priority: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_system?: boolean
          name: string
          permissions?: Json
          priority?: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_system?: boolean
          name?: string
          permissions?: Json
          priority?: number
        }
        Relationships: []
      }
      saved_replies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          image_mime_type: string | null
          image_name: string | null
          image_path: string | null
          image_size: number | null
          keywords: string[]
          last_used_at: string | null
          message: string
          shortcut: string
          updated_at: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          image_mime_type?: string | null
          image_name?: string | null
          image_path?: string | null
          image_size?: number | null
          keywords?: string[]
          last_used_at?: string | null
          message: string
          shortcut: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          image_mime_type?: string | null
          image_name?: string | null
          image_path?: string | null
          image_size?: number | null
          keywords?: string[]
          last_used_at?: string | null
          message?: string
          shortcut?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: []
      }
      saved_reply_image_cleanup: {
        Row: {
          creator_id: string
          id: string
          image_path: string
          queued_at: string
        }
        Insert: {
          creator_id: string
          id?: string
          image_path: string
          queued_at?: string
        }
        Update: {
          creator_id?: string
          id?: string
          image_path?: string
          queued_at?: string
        }
        Relationships: []
      }
      saved_reply_images: {
        Row: {
          created_at: string
          id: string
          image_mime_type: string
          image_name: string
          image_path: string
          image_size: number
          position: number
          saved_reply_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_mime_type: string
          image_name: string
          image_path: string
          image_size: number
          position: number
          saved_reply_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_mime_type?: string
          image_name?: string
          image_path?: string
          image_size?: number
          position?: number
          saved_reply_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reply_images_saved_reply_id_fkey"
            columns: ["saved_reply_id"]
            isOneToOne: false
            referencedRelation: "saved_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_voices: {
        Row: {
          audio_mime_type: string
          audio_path: string
          audio_size: number
          created_at: string
          created_by: string
          duration_sec: number
          id: string
          keywords: string[]
          last_used_at: string | null
          title: string
          updated_at: string
          use_count: number
        }
        Insert: {
          audio_mime_type: string
          audio_path: string
          audio_size: number
          created_at?: string
          created_by: string
          duration_sec: number
          id: string
          keywords?: string[]
          last_used_at?: string | null
          title: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          audio_mime_type?: string
          audio_path?: string
          audio_size?: number
          created_at?: string
          created_by?: string
          duration_sec?: number
          id?: string
          keywords?: string[]
          last_used_at?: string | null
          title?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: []
      }
      telegram_leads: {
        Row: {
          ad_id: string | null
          ad_title: string | null
          created_at: string | null
          facebook_click_id: string | null
          id: string
          messenger_ad_context: Json | null
          messenger_ref: string | null
          platform: string
          post_id: string | null
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
          ad_title?: string | null
          created_at?: string | null
          facebook_click_id?: string | null
          id?: string
          messenger_ad_context?: Json | null
          messenger_ref?: string | null
          platform?: string
          post_id?: string | null
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
          ad_title?: string | null
          created_at?: string | null
          facebook_click_id?: string | null
          id?: string
          messenger_ad_context?: Json | null
          messenger_ref?: string | null
          platform?: string
          post_id?: string | null
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
      telegram_webhook_failures: {
        Row: {
          chat_id: number | null
          created_at: string
          customer_id: string | null
          error: string
          id: string
          message_type: string | null
          raw_update: Json | null
          replay_error: string | null
          replayed_at: string | null
          stage: string
          update_id: number | null
        }
        Insert: {
          chat_id?: number | null
          created_at?: string
          customer_id?: string | null
          error: string
          id?: string
          message_type?: string | null
          raw_update?: Json | null
          replay_error?: string | null
          replayed_at?: string | null
          stage: string
          update_id?: number | null
        }
        Update: {
          chat_id?: number | null
          created_at?: string
          customer_id?: string | null
          error?: string
          id?: string
          message_type?: string | null
          raw_update?: Json | null
          replay_error?: string | null
          replayed_at?: string | null
          stage?: string
          update_id?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _saved_reply_apply_images: {
        Args: { p_images: Json; p_reply_id: string }
        Returns: undefined
      }
      _saved_reply_is_staff: { Args: never; Returns: boolean }
      _saved_reply_path_referenced: {
        Args: { p_path: string }
        Returns: boolean
      }
      _saved_reply_queue_path: { Args: { p_path: string }; Returns: undefined }
      _saved_reply_validate_images: {
        Args: { p_creator: string; p_images: Json; p_reply_id: string }
        Returns: undefined
      }
      _saved_voice_validate: {
        Args: { p_creator: string; p_id: string; p_path: string }
        Returns: undefined
      }
      claim_saved_reply_cleanup: { Args: never; Returns: string[] }
      complete_saved_reply_cleanup: {
        Args: { p_path: string }
        Returns: boolean
      }
      create_saved_reply: {
        Args: {
          p_id: string
          p_images: Json
          p_keywords: string[]
          p_message: string
          p_shortcut: string
        }
        Returns: undefined
      }
      create_saved_voice: {
        Args: {
          p_duration: number
          p_id: string
          p_keywords: string[]
          p_path: string
          p_size: number
          p_title: string
        }
        Returns: undefined
      }
      delete_saved_reply: { Args: { p_id: string }; Returns: undefined }
      delete_saved_voice: { Args: { p_id: string }; Returns: string }
      execute_unknown_messenger_cleanup: { Args: never; Returns: Json }
      get_filtered_customer_ids: {
        Args: {
          p_filter: string
          p_limit?: number
          p_messenger_enabled?: boolean
          p_offset?: number
          p_platform?: string
          p_search?: string
        }
        Returns: Json
      }
      get_latest_messages: {
        Args: { p_customer_ids: string[] }
        Returns: {
          customer_id: string
          message_text: string
          message_type: string
          sender_type: string
          sent_by_name: string
          timestamp: string
        }[]
      }
      get_unanswered_customer_ids: {
        Args: never
        Returns: {
          customer_id: string
        }[]
      }
      get_unread_counts: {
        Args: never
        Returns: {
          customer_id: string
          unread_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      preview_unknown_messenger_cleanup: { Args: never; Returns: Json }
      record_saved_reply_use: { Args: { p_id: string }; Returns: undefined }
      record_saved_voice_use: { Args: { p_id: string }; Returns: undefined }
      update_saved_reply: {
        Args: {
          p_id: string
          p_images: Json
          p_keywords: string[]
          p_message: string
          p_shortcut: string
        }
        Returns: undefined
      }
      update_saved_voice: {
        Args: {
          p_duration: number
          p_id: string
          p_keywords: string[]
          p_path: string
          p_size: number
          p_title: string
        }
        Returns: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
