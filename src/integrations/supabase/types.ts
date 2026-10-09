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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string
          id: number
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id: string
          id?: never
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string
          id?: never
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          altitude_m: number | null
          country: string
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          owner_name: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          altitude_m?: number | null
          country?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          owner_name?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          altitude_m?: number | null
          country?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          owner_name?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_tickets: {
        Row: {
          conversion_basis: string
          conversion_factor_to_kg: number | null
          created_at: string
          created_by: string | null
          data: Json
          farm_id: string
          harvest_date: string
          id: string
          intake_datetime: string
          kind: string
          organization_id: string
          parcel_id: string | null
          producer_name: string | null
          qty_kg: number | null
          qty_original: number
          uom_original: string
          variety: string | null
        }
        Insert: {
          conversion_basis?: string
          conversion_factor_to_kg?: number | null
          created_at?: string
          created_by?: string | null
          data?: Json
          farm_id: string
          harvest_date: string
          id?: string
          intake_datetime?: string
          kind: string
          organization_id: string
          parcel_id?: string | null
          producer_name?: string | null
          qty_kg?: number | null
          qty_original: number
          uom_original: string
          variety?: string | null
        }
        Update: {
          conversion_basis?: string
          conversion_factor_to_kg?: number | null
          created_at?: string
          created_by?: string | null
          data?: Json
          farm_id?: string
          harvest_date?: string
          id?: string
          intake_datetime?: string
          kind?: string
          organization_id?: string
          parcel_id?: string | null
          producer_name?: string | null
          qty_kg?: number | null
          qty_original?: number
          uom_original?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "harvest_tickets_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_tickets_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_links: {
        Row: {
          child_lot_id: string
          created_at: string
          kind: string
          parent_lot_id: string
          qty_kg: number
        }
        Insert: {
          child_lot_id: string
          created_at?: string
          kind: string
          parent_lot_id: string
          qty_kg: number
        }
        Update: {
          child_lot_id?: string
          created_at?: string
          kind?: string
          parent_lot_id?: string
          qty_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "lot_links_child_lot_id_fkey"
            columns: ["child_lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_links_parent_lot_id_fkey"
            columns: ["parent_lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_public_profiles: {
        Row: {
          is_public: boolean
          lot_id: string
          organization_id: string
          short_story: string | null
          tasting_notes: string | null
          updated_at: string
          visibility: Json
        }
        Insert: {
          is_public?: boolean
          lot_id: string
          organization_id: string
          short_story?: string | null
          tasting_notes?: string | null
          updated_at?: string
          visibility?: Json
        }
        Update: {
          is_public?: boolean
          lot_id?: string
          organization_id?: string
          short_story?: string | null
          tasting_notes?: string | null
          updated_at?: string
          visibility?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lot_public_profiles_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: true
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_public_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_sequences: {
        Row: {
          last_value: number
          organization_id: string
          prefix: string
          year: number
        }
        Insert: {
          last_value?: number
          organization_id: string
          prefix: string
          year: number
        }
        Update: {
          last_value?: number
          organization_id?: string
          prefix?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "lot_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          commercial_state: string
          created_at: string
          current_location: string | null
          current_moisture: number | null
          farm_id: string | null
          friendly_name: string
          harvest_ticket_id: string | null
          id: string
          lot_code: string
          organization_id: string
          parcel_id: string | null
          parent_lot_id: string | null
          physical_state: string
          process_type: string
          qty_blocked_kg: number
          qty_committed_kg: number
          qty_current_kg: number
          qty_free_kg: number | null
          qty_initial_kg: number
          qty_reserved_kg: number
          qty_sold_kg: number
          quality_status: string
          stock_safety_kg: number
          updated_at: string
          variety: string
        }
        Insert: {
          commercial_state?: string
          created_at?: string
          current_location?: string | null
          current_moisture?: number | null
          farm_id?: string | null
          friendly_name: string
          harvest_ticket_id?: string | null
          id?: string
          lot_code: string
          organization_id: string
          parcel_id?: string | null
          parent_lot_id?: string | null
          physical_state?: string
          process_type?: string
          qty_blocked_kg?: number
          qty_committed_kg?: number
          qty_current_kg: number
          qty_free_kg?: number | null
          qty_initial_kg: number
          qty_reserved_kg?: number
          qty_sold_kg?: number
          quality_status?: string
          stock_safety_kg?: number
          updated_at?: string
          variety?: string
        }
        Update: {
          commercial_state?: string
          created_at?: string
          current_location?: string | null
          current_moisture?: number | null
          farm_id?: string | null
          friendly_name?: string
          harvest_ticket_id?: string | null
          id?: string
          lot_code?: string
          organization_id?: string
          parcel_id?: string | null
          parent_lot_id?: string | null
          physical_state?: string
          process_type?: string
          qty_blocked_kg?: number
          qty_committed_kg?: number
          qty_current_kg?: number
          qty_free_kg?: number | null
          qty_initial_kg?: number
          qty_reserved_kg?: number
          qty_sold_kg?: number
          quality_status?: string
          stock_safety_kg?: number
          updated_at?: string
          variety?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_harvest_ticket_id_fkey"
            columns: ["harvest_ticket_id"]
            isOneToOne: false
            referencedRelation: "harvest_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_parent_lot_id_fkey"
            columns: ["parent_lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      moisture_logs: {
        Row: {
          device: string | null
          id: string
          lot_id: string
          measured_at: string
          measured_by: string | null
          moisture_pct: number
          notes: string | null
          organization_id: string
        }
        Insert: {
          device?: string | null
          id?: string
          lot_id: string
          measured_at?: string
          measured_by?: string | null
          moisture_pct: number
          notes?: string | null
          organization_id: string
        }
        Update: {
          device?: string | null
          id?: string
          lot_id?: string
          measured_at?: string
          measured_by?: string | null
          moisture_pct?: number
          notes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moisture_logs_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moisture_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          organization_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          organization_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          organization_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          region: string | null
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          name: string
          region?: string | null
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          region?: string | null
        }
        Relationships: []
      }
      parcels: {
        Row: {
          altitude_m: number | null
          area_ha: number | null
          created_at: string
          farm_id: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
          variety: string | null
        }
        Insert: {
          altitude_m?: number | null
          area_ha?: number | null
          created_at?: string
          farm_id: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
          variety?: string | null
        }
        Update: {
          altitude_m?: number | null
          area_ha?: number | null
          created_at?: string
          farm_id?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcels_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      process_phases: {
        Row: {
          ended_at: string | null
          expected_minutes: number | null
          id: string
          location: string | null
          lot_id: string
          name: string
          notes: string | null
          order_index: number
          organization_id: string
          paused_at: string | null
          responsible_user_id: string | null
          started_at: string
          status: string
          total_paused_minutes: number
        }
        Insert: {
          ended_at?: string | null
          expected_minutes?: number | null
          id?: string
          location?: string | null
          lot_id: string
          name: string
          notes?: string | null
          order_index?: number
          organization_id: string
          paused_at?: string | null
          responsible_user_id?: string | null
          started_at?: string
          status?: string
          total_paused_minutes?: number
        }
        Update: {
          ended_at?: string | null
          expected_minutes?: number | null
          id?: string
          location?: string | null
          lot_id?: string
          name?: string
          notes?: string | null
          order_index?: number
          organization_id?: string
          paused_at?: string | null
          responsible_user_id?: string | null
          started_at?: string
          status?: string
          total_paused_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_phases_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_phases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          phases: Json
          process_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          phases?: Json
          process_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          phases?: Json
          process_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      quality_samples: {
        Row: {
          created_by: string | null
          data: Json
          id: string
          lot_id: string
          moisture_pct: number | null
          organization_id: string
          sampled_at: string
          score: number | null
          status: string
          water_activity: number | null
        }
        Insert: {
          created_by?: string | null
          data?: Json
          id?: string
          lot_id: string
          moisture_pct?: number | null
          organization_id: string
          sampled_at?: string
          score?: number | null
          status: string
          water_activity?: number | null
        }
        Update: {
          created_by?: string | null
          data?: Json
          id?: string
          lot_id?: string
          moisture_pct?: number | null
          organization_id?: string
          sampled_at?: string
          score?: number | null
          status?: string
          water_activity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_samples_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_samples_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          confirmed_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          price: number | null
          qty_kg: number
          released_at: string | null
          reserved_at: string
          status: string
        }
        Insert: {
          confirmed_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          lot_id: string
          notes?: string | null
          organization_id: string
          price?: number | null
          qty_kg: number
          released_at?: string | null
          reserved_at?: string
          status?: string
        }
        Update: {
          confirmed_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          lot_id?: string
          notes?: string | null
          organization_id?: string
          price?: number | null
          qty_kg?: number
          released_at?: string | null
          reserved_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lot_id: string
          movement_type: string
          organization_id: string
          qty_kg: number
          reason: string | null
          reference_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_id: string
          movement_type: string
          organization_id: string
          qty_kg: number
          reason?: string | null
          reference_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_id?: string
          movement_type?: string
          organization_id?: string
          qty_kg?: number
          reason?: string | null
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          id: string
          is_configurable: boolean
          kg_factor: number | null
          liters_factor: number | null
          name: string
          notes: string | null
          organization_id: string
          symbol: string
          unit_type: string
        }
        Insert: {
          id?: string
          is_configurable?: boolean
          kg_factor?: number | null
          liters_factor?: number | null
          name: string
          notes?: string | null
          organization_id: string
          symbol: string
          unit_type?: string
        }
        Update: {
          id?: string
          is_configurable?: boolean
          kg_factor?: number | null
          liters_factor?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          symbol?: string
          unit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variable_definitions: {
        Row: {
          active: boolean
          category: string
          config: Json
          id: string
          name: string
          organization_id: string
          unit: string | null
          value_type: string
        }
        Insert: {
          active?: boolean
          category?: string
          config?: Json
          id?: string
          name: string
          organization_id: string
          unit?: string | null
          value_type: string
        }
        Update: {
          active?: boolean
          category?: string
          config?: Json
          id?: string
          name?: string
          organization_id?: string
          unit?: string | null
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "variable_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_logs: {
        Row: {
          id: string
          lot_id: string
          measured_at: string
          measured_by: string | null
          notes: string | null
          organization_id: string
          phase_id: string | null
          value: Json | null
          value_number: number | null
          variable_id: string | null
        }
        Insert: {
          id?: string
          lot_id: string
          measured_at?: string
          measured_by?: string | null
          notes?: string | null
          organization_id: string
          phase_id?: string | null
          value?: Json | null
          value_number?: number | null
          variable_id?: string | null
        }
        Update: {
          id?: string
          lot_id?: string
          measured_at?: string
          measured_by?: string | null
          notes?: string | null
          organization_id?: string
          phase_id?: string | null
          value?: Json | null
          value_number?: number | null
          variable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variable_logs_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_logs_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "process_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_logs_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: false
            referencedRelation: "variable_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_logs: {
        Row: {
          created_by: string | null
          destination: string
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          qty_kg: number
          reason: string
          registered_at: string
          waste_type: string
        }
        Insert: {
          created_by?: string | null
          destination?: string
          id?: string
          lot_id: string
          notes?: string | null
          organization_id: string
          qty_kg: number
          reason: string
          registered_at?: string
          waste_type: string
        }
        Update: {
          created_by?: string | null
          destination?: string
          id?: string
          lot_id?: string
          notes?: string | null
          organization_id?: string
          qty_kg?: number
          reason?: string
          registered_at?: string
          waste_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_logs_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _assert_qty: { Args: { _label?: string; _q: number }; Returns: undefined }
      _lock_reservation: {
        Args: { _id: string }
        Returns: {
          confirmed_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          price: number | null
          qty_kg: number
          released_at: string | null
          reserved_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _next_lot_code: {
        Args: { _org: string; _process: string }
        Returns: string
      }
      _release_reservation: {
        Args: {
          _new_status: string
          _r: Database["public"]["Tables"]["reservations"]["Row"]
          _reason: string
        }
        Returns: {
          confirmed_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          price: number | null
          qty_kg: number
          released_at: string | null
          reserved_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _require_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: undefined
      }
      adjust_inventory: {
        Args: { _delta: number; _lot: string; _reason: string }
        Returns: {
          commercial_state: string
          created_at: string
          current_location: string | null
          current_moisture: number | null
          farm_id: string | null
          friendly_name: string
          harvest_ticket_id: string | null
          id: string
          lot_code: string
          organization_id: string
          parcel_id: string | null
          parent_lot_id: string | null
          physical_state: string
          process_type: string
          qty_blocked_kg: number
          qty_committed_kg: number
          qty_current_kg: number
          qty_free_kg: number | null
          qty_initial_kg: number
          qty_reserved_kg: number
          qty_sold_kg: number
          quality_status: string
          stock_safety_kg: number
          updated_at: string
          variety: string
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_reservation: {
        Args: { _id: string; _reason?: string }
        Returns: {
          confirmed_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          price: number | null
          qty_kg: number
          released_at: string | null
          reserved_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_reservation: {
        Args: { _id: string }
        Returns: {
          confirmed_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          price: number | null
          qty_kg: number
          released_at: string | null
          reserved_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_lot: {
        Args: {
          _farm_id?: string
          _friendly_name: string
          _harvest_ticket_id?: string
          _org: string
          _parcel_id?: string
          _physical_state?: string
          _process_type?: string
          _qty_kg: number
          _variety?: string
        }
        Returns: {
          commercial_state: string
          created_at: string
          current_location: string | null
          current_moisture: number | null
          farm_id: string | null
          friendly_name: string
          harvest_ticket_id: string | null
          id: string
          lot_code: string
          organization_id: string
          parcel_id: string | null
          parent_lot_id: string | null
          physical_state: string
          process_type: string
          qty_blocked_kg: number
          qty_committed_kg: number
          qty_current_kg: number
          qty_free_kg: number | null
          qty_initial_kg: number
          qty_reserved_kg: number
          qty_sold_kg: number
          quality_status: string
          stock_safety_kg: number
          updated_at: string
          variety: string
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_reservation: {
        Args: {
          _currency?: string
          _customer: string
          _expires_at?: string
          _lot: string
          _notes?: string
          _price?: number
          _qty: number
        }
        Returns: {
          confirmed_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          price: number | null
          qty_kg: number
          released_at: string | null
          reserved_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deliver_reservation: {
        Args: { _id: string; _notes?: string }
        Returns: {
          confirmed_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          price: number | null
          qty_kg: number
          released_at: string | null
          reserved_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_reservations: { Args: { _org: string }; Returns: number }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      log_moisture: {
        Args: { _device?: string; _lot: string; _notes?: string; _pct: number }
        Returns: {
          device: string | null
          id: string
          lot_id: string
          measured_at: string
          measured_by: string | null
          moisture_pct: number
          notes: string | null
          organization_id: string
        }
        SetofOptions: {
          from: "*"
          to: "moisture_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_waste: {
        Args: {
          _destination?: string
          _lot: string
          _qty: number
          _reason: string
          _waste_type: string
        }
        Returns: {
          created_by: string | null
          destination: string
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          qty_kg: number
          reason: string
          registered_at: string
          waste_type: string
        }
        SetofOptions: {
          from: "*"
          to: "waste_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      merge_lots: {
        Args: { _lots: string[]; _name: string }
        Returns: {
          commercial_state: string
          created_at: string
          current_location: string | null
          current_moisture: number | null
          farm_id: string | null
          friendly_name: string
          harvest_ticket_id: string | null
          id: string
          lot_code: string
          organization_id: string
          parcel_id: string | null
          parent_lot_id: string | null
          physical_state: string
          process_type: string
          qty_blocked_kg: number
          qty_committed_kg: number
          qty_current_kg: number
          qty_free_kg: number | null
          qty_initial_kg: number
          qty_reserved_kg: number
          qty_sold_kg: number
          quality_status: string
          stock_safety_kg: number
          updated_at: string
          variety: string
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_membership: {
        Args: never
        Returns: {
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      record_quality: {
        Args: { _data?: Json; _lot: string; _score?: number; _status: string }
        Returns: {
          commercial_state: string
          created_at: string
          current_location: string | null
          current_moisture: number | null
          farm_id: string | null
          friendly_name: string
          harvest_ticket_id: string | null
          id: string
          lot_code: string
          organization_id: string
          parcel_id: string | null
          parent_lot_id: string | null
          physical_state: string
          process_type: string
          qty_blocked_kg: number
          qty_committed_kg: number
          qty_current_kg: number
          qty_free_kg: number | null
          qty_initial_kg: number
          qty_reserved_kg: number
          qty_sold_kg: number
          quality_status: string
          stock_safety_kg: number
          updated_at: string
          variety: string
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_member_role: {
        Args: {
          _active?: boolean
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: {
          active: boolean
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      split_lot: {
        Args: { _lot: string; _parts: Json }
        Returns: {
          commercial_state: string
          created_at: string
          current_location: string | null
          current_moisture: number | null
          farm_id: string | null
          friendly_name: string
          harvest_ticket_id: string | null
          id: string
          lot_code: string
          organization_id: string
          parcel_id: string | null
          parent_lot_id: string | null
          physical_state: string
          process_type: string
          qty_blocked_kg: number
          qty_committed_kg: number
          qty_current_kg: number
          qty_free_kg: number | null
          qty_initial_kg: number
          qty_reserved_kg: number
          qty_sold_kg: number
          quality_status: string
          stock_safety_kg: number
          updated_at: string
          variety: string
        }[]
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      write_audit: {
        Args: {
          _action: string
          _diff: Json
          _entity: string
          _id: string
          _org: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "administrador"
        | "encargado_beneficio"
        | "productor"
        | "comercial"
        | "consulta"
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
      app_role: [
        "administrador",
        "encargado_beneficio",
        "productor",
        "comercial",
        "consulta",
      ],
    },
  },
} as const
