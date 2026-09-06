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
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          patient_id: string | null
          study_id: string | null
          worksheet_id: string | null
          hl7_message_id: string | null
          action: string
          status: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          patient_id?: string | null
          study_id?: string | null
          worksheet_id?: string | null
          hl7_message_id?: string | null
          action: string
          status: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          action?: string
          status?: string
          metadata?: Json
        }
        Relationships: []
      }
      hl7_messages: {
        Row: {
          created_at: string
          id: string
          message_type: string
          organization_id: string | null
          patient_id: string | null
          payload: string
          response_body: string | null
          error_message: string | null
          endpoint_url: string | null
          sent_by: string | null
          sent_at: string | null
          status: string
          study_id: string | null
          worksheet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_type?: string
          organization_id?: string | null
          patient_id?: string | null
          payload: string
          response_body?: string | null
          error_message?: string | null
          endpoint_url?: string | null
          sent_by?: string | null
          sent_at?: string | null
          status?: string
          study_id?: string | null
          worksheet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_type?: string
          organization_id?: string | null
          patient_id?: string | null
          payload?: string
          response_body?: string | null
          error_message?: string | null
          endpoint_url?: string | null
          sent_by?: string | null
          sent_at?: string | null
          status?: string
          study_id?: string | null
          worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hl7_messages_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          dob: string
          first_name: string
          gender: string | null
          id: string
          last_name: string
          medicare_number: string | null
          mrn: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          dob: string
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          medicare_number?: string | null
          mrn: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          dob?: string
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          medicare_number?: string | null
          mrn?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          organization_id?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      studies: {
        Row: {
          accession_number: string
          active_worksheet_id: string | null
          assigned_to: string | null
          clinical_indication: string | null
          description: string | null
          exam_type: string | null
          id: string
          modality: string
          organization_id: string | null
          patient_id: string
          provider_number: string | null
          referring_physician: string | null
          status: string | null
          study_date: string
        }
        Insert: {
          accession_number: string
          active_worksheet_id?: string | null
          assigned_to?: string | null
          clinical_indication?: string | null
          description?: string | null
          exam_type?: string | null
          id?: string
          modality?: string
          organization_id?: string | null
          patient_id: string
          provider_number?: string | null
          referring_physician?: string | null
          status?: string | null
          study_date?: string
        }
        Update: {
          accession_number?: string
          active_worksheet_id?: string | null
          assigned_to?: string | null
          clinical_indication?: string | null
          description?: string | null
          exam_type?: string | null
          id?: string
          modality?: string
          organization_id?: string | null
          patient_id?: string
          provider_number?: string | null
          referring_physician?: string | null
          status?: string | null
          study_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "studies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worksheets: {
        Row: {
          created_at: string
          created_by: string | null
          data?: Json
          form_data: Json
          id: string
          organization_id: string | null
          patient_id: string
          report_text: string | null
          signed_at: string | null
          signed_by: string | null
          sonographer_id: string
          status: string
          study_id: string
          updated_at: string
          user_id: string | null
          worksheet_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          form_data?: Json
          id?: string
          organization_id?: string | null
          patient_id: string
          report_text?: string | null
          signed_at?: string | null
          signed_by?: string | null
          sonographer_id: string
          status?: string
          study_id: string
          updated_at?: string
          user_id?: string | null
          worksheet_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          form_data?: Json
          id?: string
          organization_id?: string | null
          patient_id?: string
          report_text?: string | null
          signed_at?: string | null
          signed_by?: string | null
          sonographer_id?: string
          status?: string
          study_id?: string
          updated_at?: string
          user_id?: string | null
          worksheet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksheets_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "doctor" | "radiologist" | "sonographer"
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
      app_role: ["admin", "doctor"],
    },
  },
} as const
