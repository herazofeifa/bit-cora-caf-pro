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
      alerts: {
        Row: {
          created_at: string
          id: string
          kind: string
          lot_id: string | null
          message: string
          organization_id: string
          phase_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          lot_id?: string | null
          message: string
          organization_id: string
          phase_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lot_id?: string | null
          message?: string
          organization_id?: string
          phase_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "process_phases"
            referencedColumns: ["id"]
          },
        ]
      }
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
      evaluation_spaces: {
        Row: {
          blank_org: string
          created_at: string
          created_by: string | null
          evaluator_user: string | null
          sample_files: Json
          sample_org: string
          source_org: string
        }
        Insert: {
          blank_org: string
          created_at?: string
          created_by?: string | null
          evaluator_user?: string | null
          sample_files?: Json
          sample_org: string
          source_org: string
        }
        Update: {
          blank_org?: string
          created_at?: string
          created_by?: string | null
          evaluator_user?: string | null
          sample_files?: Json
          sample_org?: string
          source_org?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_spaces_blank_org_fkey"
            columns: ["blank_org"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_spaces_sample_org_fkey"
            columns: ["sample_org"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_spaces_source_org_fkey"
            columns: ["source_org"]
            isOneToOne: true
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
      files: {
        Row: {
          created_at: string
          id: string
          kind: string
          lot_id: string | null
          mime_type: string
          organization_id: string
          phase_id: string | null
          public_selected: boolean
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          lot_id?: string | null
          mime_type: string
          organization_id: string
          phase_id?: string | null
          public_selected?: boolean
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lot_id?: string | null
          mime_type?: string
          organization_id?: string
          phase_id?: string | null
          public_selected?: boolean
          size_bytes?: number
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "process_phases"
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
          cut_type: string | null
          data: Json
          farm_id: string
          harvest_date: string
          id: string
          initial_quality: string | null
          intake_datetime: string
          kind: string
          lot_id: string | null
          notes: string | null
          organization_id: string
          parcel_id: string | null
          producer_name: string | null
          qty_kg: number | null
          qty_original: number
          responsible: string | null
          season: string | null
          uom_original: string
          variety: string | null
          worker_count: number | null
          workers: Json
        }
        Insert: {
          conversion_basis?: string
          conversion_factor_to_kg?: number | null
          created_at?: string
          created_by?: string | null
          cut_type?: string | null
          data?: Json
          farm_id: string
          harvest_date: string
          id?: string
          initial_quality?: string | null
          intake_datetime?: string
          kind: string
          lot_id?: string | null
          notes?: string | null
          organization_id: string
          parcel_id?: string | null
          producer_name?: string | null
          qty_kg?: number | null
          qty_original: number
          responsible?: string | null
          season?: string | null
          uom_original: string
          variety?: string | null
          worker_count?: number | null
          workers?: Json
        }
        Update: {
          conversion_basis?: string
          conversion_factor_to_kg?: number | null
          created_at?: string
          created_by?: string | null
          cut_type?: string | null
          data?: Json
          farm_id?: string
          harvest_date?: string
          id?: string
          initial_quality?: string | null
          intake_datetime?: string
          kind?: string
          lot_id?: string | null
          notes?: string | null
          organization_id?: string
          parcel_id?: string | null
          producer_name?: string | null
          qty_kg?: number | null
          qty_original?: number
          responsible?: string | null
          season?: string | null
          uom_original?: string
          variety?: string | null
          worker_count?: number | null
          workers?: Json
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
            foreignKeyName: "harvest_tickets_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
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
          exported_at: string | null
          is_public: boolean
          lot_id: string
          organization_id: string
          public_token: string
          published_at: string | null
          short_story: string | null
          tasting_notes: string | null
          updated_at: string
          visibility: Json
        }
        Insert: {
          exported_at?: string | null
          is_public?: boolean
          lot_id: string
          organization_id: string
          public_token?: string
          published_at?: string | null
          short_story?: string | null
          tasting_notes?: string | null
          updated_at?: string
          visibility?: Json
        }
        Update: {
          exported_at?: string | null
          is_public?: boolean
          lot_id?: string
          organization_id?: string
          public_token?: string
          published_at?: string | null
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
          sale_released: boolean
          sale_released_at: string | null
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
          sale_released?: boolean
          sale_released_at?: string | null
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
          sale_released?: boolean
          sale_released_at?: string | null
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
      operation_keys: {
        Row: {
          actor_id: string | null
          args_hash: string | null
          created_at: string
          op_key: string
          operation: string
          organization_id: string
          result: Json
        }
        Insert: {
          actor_id?: string | null
          args_hash?: string | null
          created_at?: string
          op_key: string
          operation: string
          organization_id: string
          result: Json
        }
        Update: {
          actor_id?: string | null
          args_hash?: string | null
          created_at?: string
          op_key?: string
          operation?: string
          organization_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "operation_keys_organization_id_fkey"
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
          eval_kind: string | null
          id: string
          is_demo: boolean
          name: string
          region: string | null
        }
        Insert: {
          country?: string
          created_at?: string
          eval_kind?: string | null
          id?: string
          is_demo?: boolean
          name: string
          region?: string | null
        }
        Update: {
          country?: string
          created_at?: string
          eval_kind?: string | null
          id?: string
          is_demo?: boolean
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
          closed_by: string | null
          ended_at: string | null
          expected_minutes: number | null
          id: string
          location: string | null
          lot_id: string
          name: string
          notes: string | null
          operator_id: string | null
          order_index: number
          organization_id: string
          paused_at: string | null
          phase_key: string | null
          physical_state_after: string | null
          responsible_user_id: string | null
          started_at: string
          status: string
          template_id: string | null
          template_version: number | null
          total_paused_minutes: number
          variables: Json
          weight_in_kg: number | null
          weight_out_kg: number | null
        }
        Insert: {
          closed_by?: string | null
          ended_at?: string | null
          expected_minutes?: number | null
          id?: string
          location?: string | null
          lot_id: string
          name: string
          notes?: string | null
          operator_id?: string | null
          order_index?: number
          organization_id: string
          paused_at?: string | null
          phase_key?: string | null
          physical_state_after?: string | null
          responsible_user_id?: string | null
          started_at?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          total_paused_minutes?: number
          variables?: Json
          weight_in_kg?: number | null
          weight_out_kg?: number | null
        }
        Update: {
          closed_by?: string | null
          ended_at?: string | null
          expected_minutes?: number | null
          id?: string
          location?: string | null
          lot_id?: string
          name?: string
          notes?: string | null
          operator_id?: string | null
          order_index?: number
          organization_id?: string
          paused_at?: string | null
          phase_key?: string | null
          physical_state_after?: string | null
          responsible_user_id?: string | null
          started_at?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          total_paused_minutes?: number
          variables?: Json
          weight_in_kg?: number | null
          weight_out_kg?: number | null
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
          {
            foreignKeyName: "process_phases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_custom: boolean
          name: string
          organization_id: string
          phases: Json
          process_type: string
          root_id: string | null
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_custom?: boolean
          name: string
          organization_id: string
          phases?: Json
          process_type: string
          root_id?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_custom?: boolean
          name?: string
          organization_id?: string
          phases?: Json
          process_type?: string
          root_id?: string | null
          version?: number
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
      report_shares: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          organization_id: string
          payload: Json
          revoked_at: string | null
          title: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          organization_id: string
          payload: Json
          revoked_at?: string | null
          title: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          revoked_at?: string | null
          title?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_shares_organization_id_fkey"
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
          price_unit: string
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
          price_unit?: string
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
          price_unit?: string
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
      sacks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lot_id: string
          organization_id: string
          sack_token: string
          seq: number
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_id: string
          organization_id: string
          sack_token?: string
          seq: number
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_id?: string
          organization_id?: string
          sack_token?: string
          seq?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sacks_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sacks_organization_id_fkey"
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
          price_unit: string
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
      _op_get: {
        Args: { _args_hash: string; _key: string; _op: string; _org: string }
        Returns: Json
      }
      _op_put: {
        Args: { _key: string; _op: string; _org: string; _result: Json }
        Returns: undefined
      }
      _org_from_path: { Args: { _name: string }; Returns: string }
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
          price_unit: string
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
      _seed_eval_base: { Args: { _org: string }; Returns: undefined }
      _seed_eval_sample: { Args: { _org: string }; Returns: Json }
      _seed_process_templates: { Args: { _org: string }; Returns: undefined }
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
          sale_released: boolean
          sale_released_at: string | null
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
      can_see_user: { Args: { _user: string }; Returns: boolean }
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
          price_unit: string
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
      close_phase: {
        Args: {
          _notes?: string
          _op_key?: string
          _phase: string
          _physical_state?: string
          _weight_out_kg: number
        }
        Returns: {
          closed_by: string | null
          ended_at: string | null
          expected_minutes: number | null
          id: string
          location: string | null
          lot_id: string
          name: string
          notes: string | null
          operator_id: string | null
          order_index: number
          organization_id: string
          paused_at: string | null
          phase_key: string | null
          physical_state_after: string | null
          responsible_user_id: string | null
          started_at: string
          status: string
          template_id: string | null
          template_version: number | null
          total_paused_minutes: number
          variables: Json
          weight_in_kg: number | null
          weight_out_kg: number | null
        }
        SetofOptions: {
          from: "*"
          to: "process_phases"
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
          price_unit: string
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
      create_demo_environment: { Args: never; Returns: string }
      create_lot: {
        Args: {
          _farm_id?: string
          _friendly_name: string
          _harvest_ticket_id?: string
          _op_key?: string
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
          sale_released: boolean
          sale_released_at: string | null
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
          _op_key?: string
          _price?: number
          _price_unit?: string
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
          price_unit: string
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
      create_sacks: {
        Args: { _count: number; _lot: string; _weight_kg?: number }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          lot_id: string
          organization_id: string
          sack_token: string
          seq: number
          weight_kg: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "sacks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      declare_lot_export: {
        Args: { _exported_at: string; _lot: string }
        Returns: {
          exported_at: string | null
          is_public: boolean
          lot_id: string
          organization_id: string
          public_token: string
          published_at: string | null
          short_story: string | null
          tasting_notes: string | null
          updated_at: string
          visibility: Json
        }
        SetofOptions: {
          from: "*"
          to: "lot_public_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deliver_reservation: {
        Args: { _id: string; _notes?: string; _op_key?: string }
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
          price_unit: string
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
      is_real_org_admin: { Args: never; Returns: boolean }
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
      log_phase_variable: {
        Args: {
          _key: string
          _notes?: string
          _op_key?: string
          _phase: string
          _unit?: string
          _value: number
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "variable_logs"
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
          sale_released: boolean
          sale_released_at: string | null
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
      my_memberships: {
        Args: never
        Returns: {
          eval_kind: string
          is_demo: boolean
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      overdue_phases: {
        Args: { _org: string }
        Returns: {
          elapsed_days: number
          expected_minutes: number
          lot_code: string
          lot_id: string
          phase_id: string
          phase_name: string
          reason: string
          started_at: string
        }[]
      }
      provision_evaluation: {
        Args: { _evaluator?: string; _source_org: string }
        Returns: Json
      }
      public_lot_view: { Args: { _token: string }; Returns: Json }
      public_report_snapshot: { Args: { _token: string }; Returns: Json }
      public_sack_view: { Args: { _token: string }; Returns: Json }
      publish_lot: {
        Args: {
          _is_public: boolean
          _lot: string
          _short_story?: string
          _tasting_notes?: string
          _visibility?: Json
        }
        Returns: {
          exported_at: string | null
          is_public: boolean
          lot_id: string
          organization_id: string
          public_token: string
          published_at: string | null
          short_story: string | null
          tasting_notes: string | null
          updated_at: string
          visibility: Json
        }
        SetofOptions: {
          from: "*"
          to: "lot_public_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_report_snapshot: {
        Args: { _days?: number; _org: string; _payload: Json; _title: string }
        Returns: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          organization_id: string
          payload: Json
          revoked_at: string | null
          title: string
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "report_shares"
          isOneToOne: true
          isSetofReturn: false
        }
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
          sale_released: boolean
          sale_released_at: string | null
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
      register_harvest: {
        Args: {
          _data: Json
          _lot_name?: string
          _op_key?: string
          _org: string
          _target_lot?: string
        }
        Returns: Json
      }
      release_lot_for_sale: {
        Args: { _lot: string; _reason?: string }
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
          sale_released: boolean
          sale_released_at: string | null
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
      revoke_report_snapshot: { Args: { _id: string }; Returns: undefined }
      sales_summary: {
        Args: { _from: string; _org: string; _to: string }
        Returns: {
          currency: string
          deliveries: number
          kg_delivered: number
          kg_priced: number
          weighted_price_per_kg: number
        }[]
      }
      save_process_template: {
        Args: {
          _description: string
          _name: string
          _org: string
          _phases: Json
          _process_type: string
          _template: string
        }
        Returns: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_custom: boolean
          name: string
          organization_id: string
          phases: Json
          process_type: string
          root_id: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "process_templates"
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
          sale_released: boolean
          sale_released_at: string | null
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
      start_phase: {
        Args: {
          _expected_minutes?: number
          _lot: string
          _name: string
          _op_key?: string
          _phase_key?: string
          _template?: string
        }
        Returns: {
          closed_by: string | null
          ended_at: string | null
          expected_minutes: number | null
          id: string
          location: string | null
          lot_id: string
          name: string
          notes: string | null
          operator_id: string | null
          order_index: number
          organization_id: string
          paused_at: string | null
          phase_key: string | null
          physical_state_after: string | null
          responsible_user_id: string | null
          started_at: string
          status: string
          template_id: string | null
          template_version: number | null
          total_paused_minutes: number
          variables: Json
          weight_in_kg: number | null
          weight_out_kg: number | null
        }
        SetofOptions: {
          from: "*"
          to: "process_phases"
          isOneToOne: true
          isSetofReturn: false
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
