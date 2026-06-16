export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          file_type: "pdf" | "docx" | "text";
          storage_path: string | null;
          extracted_text: string;
          character_count: number;
          usage_count: number;
          is_active: boolean;
          uploaded_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          file_type: "pdf" | "docx" | "text";
          storage_path?: string | null;
          extracted_text: string;
          character_count: number;
          usage_count?: number;
          is_active?: boolean;
          uploaded_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          file_type?: "pdf" | "docx" | "text";
          storage_path?: string | null;
          extracted_text?: string;
          character_count?: number;
          usage_count?: number;
          is_active?: boolean;
          uploaded_at?: string;
          updated_at?: string;
        };
      };
      optimization_runs: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          resume_name: string;
          title: string;
          job_description: string;
          optimized_resume: Json | null;
          score: number;
          status: "draft" | "exported";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_id: string;
          resume_name: string;
          title: string;
          job_description: string;
          optimized_resume?: Json | null;
          score?: number;
          status?: "draft" | "exported";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          resume_id?: string;
          resume_name?: string;
          title?: string;
          job_description?: string;
          optimized_resume?: Json | null;
          score?: number;
          status?: "draft" | "exported";
          created_at?: string;
          updated_at?: string;
        };
      };
      export_events: {
        Row: {
          id: string;
          user_id: string;
          run_id: string;
          export_type: "docx" | "pdf" | "copy";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          run_id: string;
          export_type: "docx" | "pdf" | "copy";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          run_id?: string;
          export_type?: "docx" | "pdf" | "copy";
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
