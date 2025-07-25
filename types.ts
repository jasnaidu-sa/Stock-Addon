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
      accessories: {
        Row: {
          code: string
          created_at: string | null
          description: string
          id: string
          price: number
          size: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          id?: string
          price: number
          size: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          price?: number
          size?: string
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      base: {
        Row: {
          code: string
          description: string
          id: string
          price: number
        }
        Insert: {
          code: string
          description: string
          id?: string
          price: number
        }
        Update: {
          code?: string
          description?: string
          id?: string
          price?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          comment: string | null
          created_at: string | null
          email: string
          id: string
          name: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      foam: {
        Row: {
          code: string
          created_at: string | null
          description: string
          id: string
          price: number
          size: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          id?: string
          price: number
          size: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          price?: number
          size?: string
        }
        Relationships: []
      }
      furniture: {
        Row: {
          code: string
          created_at: string | null
          description: string
          id: string
          price: number
          size: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          id?: string
          price: number
          size: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          price?: number
          size?: string
        }
        Relationships: []
      }
      headboards: {
        Row: {
          code: string
          created_at: string | null
          description: string
          id: string
          price: number
          size: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          id?: string
          price: number
          size: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          price?: number
          size?: string
        }
        Relationships: []
      }
      mattress: {
        Row: {
          base_code: string
          base_price: number
          base_price_total: number
          base_qty: number
          description: string
          id: string
          mattress_code: string
          mattress_price: number
          set_price: number
          size: string
        }
        Insert: {
          base_code: string
          base_price: number
          base_price_total: number
          base_qty: number
          description: string
          id?: string
          mattress_code: string
          mattress_price: number
          set_price: number
          size: string
        }
        Update: {
          base_code?: string
          base_price?: number
          base_price_total?: number
          base_qty?: number
          description?: string
          id?: string
          mattress_code?: string
          mattress_price?: number
          set_price?: number
          size?: string
        }
        Relationships: []
      }
      order_history: {
        Row: {
          action_type: string | null
          admin_notes: string | null
          changes_summary: string | null
          created_at: string | null
          details: Json | null
          id: string
          order_id: string
          order_items: Json | null
          original_qty: number | null
          original_value: number | null
          status: string
          updated_qty: number | null
          updated_value: number | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          admin_notes?: string | null
          changes_summary?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id: string
          order_items?: Json | null
          original_qty?: number | null
          original_value?: number | null
          status?: string
          updated_qty?: number | null
          updated_value?: number | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          admin_notes?: string | null
          changes_summary?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id?: string
          order_items?: Json | null
          original_qty?: number | null
          original_value?: number | null
          status?: string
          updated_qty?: number | null
          updated_value?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          price: number
          product_name: string | null
          quantity: number
          status: string | null
          stock_item_id: string
          total: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          price: number
          product_name?: string | null
          quantity: number
          status?: string | null
          stock_item_id: string
          total?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          price?: number
          product_name?: string | null
          quantity?: number
          status?: string | null
          stock_item_id?: string
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_number_errors: {
        Row: {
          additional_info: Json | null
          attempted_order_number: string | null
          created_at: string | null
          error_message: string | null
          id: string
          order_id: string | null
          user_id: string | null
        }
        Insert: {
          additional_info?: Json | null
          attempted_order_number?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          user_id?: string | null
        }
        Update: {
          additional_info?: Json | null
          attempted_order_number?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_sequence: {
        Row: {
          current_value: number | null
          id: number
        }
        Insert: {
          current_value?: number | null
          id?: number
        }
        Update: {
          current_value?: number | null
          id?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          category: string
          created_at: string | null
          id: string
          "Order Owner": string | null
          order_number: string | null
          order_owner_id: string
          quantity: number
          status: string
          store_name: string
          user_id: string | null
          value: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          "Order Owner"?: string | null
          order_number?: string | null
          order_owner_id: string
          quantity: number
          status?: string
          store_name: string
          user_id?: string | null
          value?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          "Order Owner"?: string | null
          order_number?: string | null
          order_owner_id?: string
          quantity?: number
          status?: string
          store_name?: string
          user_id?: string | null
          value?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string | null
          group_type: string | null
          id: string
          last_sign_in_at: string | null
          name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          group_type?: string | null
          id?: string
          last_sign_in_at?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          group_type?: string | null
          id?: string
          last_sign_in_at?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      clear_all_users: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      ensure_customer_exists: {
        Args: { user_id: string; user_email: string; user_name: string }
        Returns: undefined
      }
      ensure_mattress_stock_items: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: {
          role: string
          status: string
        }[]
      }
      handle_admin_operation: {
        Args: { operation: string; user_id?: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_check: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_order_number_error: {
        Args: {
          p_error_message: string
          p_order_id?: string
          p_attempted_order_number?: string
          p_user_id?: string
          p_additional_info?: Json
        }
        Returns: string
      }
    }
    Enums: {
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "user"],
    },
  },
} as const
