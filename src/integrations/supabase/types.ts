export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_requests: {
        Row: {
          id: string
          notes: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          tool_id: string
          user_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          tool_id: string
          user_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          tool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_label: string
          created_at: string
          end_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notice_deadline: string | null
          notes: string | null
          ocr_extracted_fields: Json
          ocr_extracted_text: string | null
          ocr_model: string | null
          ocr_status: string
          renewal_notice_days: number | null
          renewal_period_months: number | null
          renewal_type: string
          source_url: string | null
          start_date: string | null
          status: string
          team_id: string | null
          terms_checked_at: string | null
          terms_status: string
          terms_summary: string | null
          terms_url: string | null
          tool_name: string
          updated_at: string
          user_id: string
          vendor_name: string | null
        }
        Insert: {
          contract_label: string
          created_at?: string
          end_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notice_deadline?: string | null
          notes?: string | null
          ocr_extracted_fields?: Json
          ocr_extracted_text?: string | null
          ocr_model?: string | null
          ocr_status?: string
          renewal_notice_days?: number | null
          renewal_period_months?: number | null
          renewal_type?: string
          source_url?: string | null
          start_date?: string | null
          status?: string
          team_id?: string | null
          terms_checked_at?: string | null
          terms_status?: string
          terms_summary?: string | null
          terms_url?: string | null
          tool_name: string
          updated_at?: string
          user_id?: string
          vendor_name?: string | null
        }
        Update: {
          contract_label?: string
          created_at?: string
          end_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notice_deadline?: string | null
          notes?: string | null
          ocr_extracted_fields?: Json
          ocr_extracted_text?: string | null
          ocr_model?: string | null
          ocr_status?: string
          renewal_notice_days?: number | null
          renewal_period_months?: number | null
          renewal_type?: string
          source_url?: string | null
          start_date?: string | null
          status?: string
          team_id?: string | null
          terms_checked_at?: string | null
          terms_status?: string
          terms_summary?: string | null
          terms_url?: string | null
          tool_name?: string
          updated_at?: string
          user_id?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          role: string | null
          updated_at: string
          user_id: string
          slack_token: string | null
          notion_token: string | null
          hubspot_token: string | null
          microsoft_token: string | null
          onoff_api_key: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          role?: string | null
          updated_at?: string
          user_id: string
          slack_token?: string | null
          notion_token?: string | null
          hubspot_token?: string | null
          microsoft_token?: string | null
          onoff_api_key?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          role?: string | null
          updated_at?: string
          user_id?: string
          slack_token?: string | null
          notion_token?: string | null
          hubspot_token?: string | null
          microsoft_token?: string | null
          onoff_api_key?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          monthly_cost: number | null
          name: string
          total_seats: number | null
          updated_at: string
          used_seats: number | null
          website_url: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monthly_cost?: number | null
          name: string
          total_seats?: number | null
          updated_at?: string
          used_seats?: number | null
          website_url?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monthly_cost?: number | null
          name?: string
          total_seats?: number | null
          updated_at?: string
          used_seats?: number | null
          website_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      workflow_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          executed_by: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          started_at: string | null
          status: string | null
          step_id: string | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          executed_by?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status?: string | null
          step_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          executed_by?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status?: string | null
          step_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_logs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_logs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          action_id: string | null
          configuration: Json | null
          created_at: string
          id: string
          name: string
          order_index: number
          updated_at: string
          workflow_id: string
        }
        Insert: {
          action_id?: string | null
          configuration?: Json | null
          created_at?: string
          id?: string
          name: string
          order_index: number
          updated_at?: string
          workflow_id: string
        }
        Update: {
          action_id?: string | null
          configuration?: Json | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_variables: {
        Row: {
          created_at: string | null
          id: string
          name: string
          value_options: Json | null
          variable_type: string
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          value_options?: Json | null
          variable_type: string
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          value_options?: Json | null
          variable_type?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_variables_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          steps: Json | null
          type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          steps?: Json | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          steps?: Json | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { _token: string; _user_id: string }
        Returns: boolean
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      is_team_lead: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
