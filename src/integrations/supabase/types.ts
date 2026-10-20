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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      citizen_access_controls: {
        Row: {
          blocked_until: string | null
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          blocked_until?: string | null
          status: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          blocked_until?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          location_lat: number | null
          location_lng: number | null
          message: string
          response: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          message: string
          response?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          message?: string
          response?: string
          user_id?: string
        }
        Relationships: []
      }
      crime_reports: {
        Row: {
          admin_action: Json | null
          assigned_station: string | null
          authenticity_analysis: Json | null
          authenticity_score: number | null
          created_at: string
          crime_location_address: string | null
          crime_location_lat: number | null
          crime_location_lng: number | null
          crime_time: string | null
          description: string
          estimated_resolution_time: string | null
          id: string
          location_address: string | null
          location_lat: number
          location_lng: number
          media_names: string[] | null
          media_paths: string[]
          resolved_at: string | null
          severity: string
          status: string
          status_updates: Json | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_action?: Json | null
          assigned_station?: string | null
          authenticity_analysis?: Json | null
          authenticity_score?: number | null
          created_at?: string
          crime_location_address?: string | null
          crime_location_lat?: number | null
          crime_location_lng?: number | null
          crime_time?: string | null
          description?: string
          estimated_resolution_time?: string | null
          id?: string
          location_address?: string | null
          location_lat?: number
          location_lng?: number
          media_names?: string[] | null
          media_paths?: string[]
          resolved_at?: string | null
          severity?: string
          status?: string
          status_updates?: Json | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_action?: Json | null
          assigned_station?: string | null
          authenticity_analysis?: Json | null
          authenticity_score?: number | null
          created_at?: string
          crime_location_address?: string | null
          crime_location_lat?: number | null
          crime_location_lng?: number | null
          crime_time?: string | null
          description?: string
          estimated_resolution_time?: string | null
          id?: string
          location_address?: string | null
          location_lat?: number
          location_lng?: number
          media_names?: string[] | null
          media_paths?: string[]
          resolved_at?: string | null
          severity?: string
          status?: string
          status_updates?: Json | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crime_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_services: {
        Row: {
          address: string
          created_at: string
          distance: number | null
          id: string
          location_lat: number
          location_lng: number
          name: string
          phone: string
          type: string
        }
        Insert: {
          address?: string
          created_at?: string
          distance?: number | null
          id?: string
          location_lat?: number
          location_lng?: number
          name: string
          phone?: string
          type?: string
        }
        Update: {
          address?: string
          created_at?: string
          distance?: number | null
          id?: string
          location_lat?: number
          location_lng?: number
          name?: string
          phone?: string
          type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sos_alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          delivered_at: string | null
          eta_minutes: number | null
          id: string
          location_address: string | null
          location_lat: number
          location_lng: number
          resolved_at: string | null
          responder_name: string | null
          status: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          delivered_at?: string | null
          eta_minutes?: number | null
          id?: string
          location_address?: string | null
          location_lat: number
          location_lng: number
          resolved_at?: string | null
          responder_name?: string | null
          status?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          delivered_at?: string | null
          eta_minutes?: number | null
          id?: string
          location_address?: string | null
          location_lat?: number
          location_lng?: number
          resolved_at?: string | null
          responder_name?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_public_crime_heatmap: {
        Args: {
          p_days?: number | null
          p_type?: string | null
        }
        Returns: {
          incident_count: number
          intensity: number
          lat: number
          lng: number
          report_type: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      admin_set_citizen_access: {
        Args: {
          target_user_id: string
          new_status: string
          duration_hours?: number | null
        }
        Returns: Json
      }
      admin_delete_citizen: {
        Args: {
          target_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "citizen"
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
      app_role: ["admin", "citizen"],
    },
  },
} as const
