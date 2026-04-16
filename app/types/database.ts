export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accountstorage: {
        Row: {
          bonus_bytes: number
          total_quota_bytes: number
          total_used_bytes: number
          user_id: string
        }
        Insert: {
          bonus_bytes?: number
          total_quota_bytes?: number
          total_used_bytes?: number
          user_id: string
        }
        Update: {
          bonus_bytes?: number
          total_quota_bytes?: number
          total_used_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountstorage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      circle: {
        Row: {
          challenge_streak: number
          circle_type: string
          created_at: string
          created_by: string
          e2ee_enabled: boolean
          e2ee_enabled_at: string | null
          grace_period_until: string | null
          id: string
          name: string
          subscription_status: string
        }
        Insert: {
          challenge_streak?: number
          circle_type?: string
          created_at?: string
          created_by: string
          e2ee_enabled?: boolean
          e2ee_enabled_at?: string | null
          grace_period_until?: string | null
          id?: string
          name: string
          subscription_status?: string
        }
        Update: {
          challenge_streak?: number
          circle_type?: string
          created_at?: string
          created_by?: string
          e2ee_enabled?: boolean
          e2ee_enabled_at?: string | null
          grace_period_until?: string | null
          id?: string
          name?: string
          subscription_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      circleinvite: {
        Row: {
          circle_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "circleinvite_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circle"
            referencedColumns: ["id"]
          },
        ]
      }
      circlemember: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          memorial_date: string | null
          memorial_message: string | null
          memorial_status: string
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          memorial_date?: string | null
          memorial_message?: string | null
          memorial_status?: string
          role?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          memorial_date?: string | null
          memorial_message?: string | null
          memorial_status?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circlemember_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circlemember_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      featureflag: {
        Row: {
          enabled_globally: boolean
          enabled_pct: number
          enabled_user_ids: string[]
          id: string
          key: string
        }
        Insert: {
          enabled_globally?: boolean
          enabled_pct?: number
          enabled_user_ids?: string[]
          id?: string
          key: string
        }
        Update: {
          enabled_globally?: boolean
          enabled_pct?: number
          enabled_user_ids?: string[]
          id?: string
          key?: string
        }
        Relationships: []
      }
      memory: {
        Row: {
          alt_text: string | null
          contributions_open: boolean
          created_at: string
          circle_id: string
          group_id: string | null
          id: string
          is_collaborative: boolean
          memory_date: string
          milestone_is_custom: boolean
          milestone_label: string | null
          note: string | null
          owner_user_id: string
          visibility: string
        }
        Insert: {
          alt_text?: string | null
          circle_id: string
          contributions_open?: boolean
          created_at?: string
          group_id?: string | null
          id?: string
          is_collaborative?: boolean
          memory_date?: string
          milestone_is_custom?: boolean
          milestone_label?: string | null
          note?: string | null
          owner_user_id: string
          visibility?: string
        }
        Update: {
          alt_text?: string | null
          circle_id?: string
          contributions_open?: boolean
          created_at?: string
          group_id?: string | null
          id?: string
          is_collaborative?: boolean
          memory_date?: string
          milestone_is_custom?: boolean
          milestone_label?: string | null
          note?: string | null
          owner_user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      memorycomment: {
        Row: {
          body: string
          created_at: string
          id: string
          memory_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          memory_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          memory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorycomment_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorycomment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      memorymedia: {
        Row: {
          created_at: string
          file_size: number
          guest_name: string | null
          id: string
          lat: number | null
          live_path: string | null
          lng: number | null
          location_name: string | null
          media_type: string
          memory_id: string
          phash: string | null
          still_path: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_size: number
          guest_name?: string | null
          id?: string
          lat?: number | null
          live_path?: string | null
          lng?: number | null
          location_name?: string | null
          media_type: string
          memory_id: string
          phash?: string | null
          still_path?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          file_size?: number
          guest_name?: string | null
          id?: string
          lat?: number | null
          live_path?: string | null
          lng?: number | null
          location_name?: string | null
          media_type?: string
          memory_id?: string
          phash?: string | null
          still_path?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorymedia_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memory"
            referencedColumns: ["id"]
          },
        ]
      }
      memoryreaction: {
        Row: {
          created_at: string
          duration_seconds: number | null
          emoji: string | null
          id: string
          media_path: string | null
          memory_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          emoji?: string | null
          id?: string
          media_path?: string | null
          memory_id: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          emoji?: string | null
          id?: string
          media_path?: string | null
          memory_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memoryreaction_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memoryreaction_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      notificationpreference: {
        Row: {
          circle_id: string
          circle_muted: boolean
          email_digest_frequency: string
          id: string
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          user_id: string
        }
        Insert: {
          circle_id: string
          circle_muted?: boolean
          email_digest_frequency?: string
          id?: string
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string
          circle_muted?: boolean
          email_digest_frequency?: string
          id?: string
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificationpreference_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificationpreference_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      user: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          platform_role: string
          referral_code: string
          referred_by_user_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_status: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          platform_role?: string
          referral_code?: string
          referred_by_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          platform_role?: string
          referral_code?: string
          referred_by_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_referred_by_user_id_fkey"
            columns: ["referred_by_user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_circle_ids: { Args: never; Returns: string[] }
      get_my_circle_ids_as_role: {
        Args: { required_roles: string[] }
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

