export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
    api_rate_limits: {
      Row: {
        rate_key: string;
        window_started_at: string;
        request_count: number;
      };
      Insert: {
        rate_key: string;
        window_started_at?: string;
        request_count?: number;
      };
      Update: {
        rate_key?: string;
        window_started_at?: string;
        request_count?: number;
      };
      Relationships: [];
    };
    artwork_files: {
      Row: {
        id: string;
        company_id: string;
        job_order_id: string;
        storage_path: string;
        original_filename: string;
        mime_type: string;
        file_size: number;
        version_number: number;
        uploaded_by: string;
        approval_status: string;
        approved_by: string | null;
        approved_at: string | null;
        approval_note: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        job_order_id: string;
        storage_path: string;
        original_filename: string;
        mime_type: string;
        file_size: number;
        version_number: number;
        uploaded_by: string;
        approval_status?: string;
        approved_by?: string | null;
        approved_at?: string | null;
        approval_note?: string | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        job_order_id?: string;
        storage_path?: string;
        original_filename?: string;
        mime_type?: string;
        file_size?: number;
        version_number?: number;
        uploaded_by?: string;
        approval_status?: string;
        approved_by?: string | null;
        approved_at?: string | null;
        approval_note?: string | null;
        created_at?: string;
      };
      Relationships: [];
    };
    audit_logs: {
      Row: {
        id: string;
        company_id: string;
        actor_user_id: string | null;
        action: string;
        entity_type: string;
        entity_id: string | null;
        before_data: Json | null;
        after_data: Json | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        actor_user_id?: string | null;
        action: string;
        entity_type: string;
        entity_id?: string | null;
        before_data?: Json | null;
        after_data?: Json | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        actor_user_id?: string | null;
        action?: string;
        entity_type?: string;
        entity_id?: string | null;
        before_data?: Json | null;
        after_data?: Json | null;
        created_at?: string;
      };
      Relationships: [];
    };
    companies: {
      Row: {
        id: string;
        name: string;
        slug: string;
        legal_name: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        logo_path: string | null;
        currency: string;
        timezone: string;
        tax_settings: Json;
        settings: Json;
        created_by: string | null;
        created_at: string;
        updated_at: string;
        archived_at: string | null;
      };
      Insert: {
        id?: string;
        name: string;
        slug: string;
        legal_name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        logo_path?: string | null;
        currency?: string;
        timezone?: string;
        tax_settings?: Json;
        settings?: Json;
        created_by?: string | null;
        created_at?: string;
        updated_at?: string;
        archived_at?: string | null;
      };
      Update: {
        id?: string;
        name?: string;
        slug?: string;
        legal_name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        logo_path?: string | null;
        currency?: string;
        timezone?: string;
        tax_settings?: Json;
        settings?: Json;
        created_by?: string | null;
        created_at?: string;
        updated_at?: string;
        archived_at?: string | null;
      };
      Relationships: [];
    };
    company_memberships: {
      Row: {
        id: string;
        company_id: string;
        user_id: string;
        role: string;
        permissions: string[];
        status: string;
        invited_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        user_id: string;
        role?: string;
        permissions?: string[];
        status?: string;
        invited_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        user_id?: string;
        role?: string;
        permissions?: string[];
        status?: string;
        invited_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    customers: {
      Row: {
        id: string;
        company_id: string;
        customer_code: string;
        name: string;
        phone: string;
        email: string | null;
        address: string | null;
        notes: string | null;
        archived_at: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        customer_code: string;
        name: string;
        phone: string;
        email?: string | null;
        address?: string | null;
        notes?: string | null;
        archived_at?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        customer_code?: string;
        name?: string;
        phone?: string;
        email?: string | null;
        address?: string | null;
        notes?: string | null;
        archived_at?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    document_counters: {
      Row: {
        company_id: string;
        doc_type: string;
        next_value: number;
        updated_at: string;
      };
      Insert: {
        company_id: string;
        doc_type: string;
        next_value?: number;
        updated_at?: string;
      };
      Update: {
        company_id?: string;
        doc_type?: string;
        next_value?: number;
        updated_at?: string;
      };
      Relationships: [];
    };
    expenses: {
      Row: {
        id: string;
        company_id: string;
        expense_number: string;
        category: string;
        description: string;
        amount_minor: number;
        expense_date: string;
        payment_method: string | null;
        supplier_id: string | null;
        receipt_path: string | null;
        notes: string | null;
        recorded_by: string;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        expense_number: string;
        category: string;
        description: string;
        amount_minor: number;
        expense_date?: string;
        payment_method?: string | null;
        supplier_id?: string | null;
        receipt_path?: string | null;
        notes?: string | null;
        recorded_by: string;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        expense_number?: string;
        category?: string;
        description?: string;
        amount_minor?: number;
        expense_date?: string;
        payment_method?: string | null;
        supplier_id?: string | null;
        receipt_path?: string | null;
        notes?: string | null;
        recorded_by?: string;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    invitations: {
      Row: {
        id: string;
        company_id: string;
        email: string;
        role: string;
        permissions: string[];
        token_hash: string;
        expires_at: string;
        invited_by: string;
        accepted_by: string | null;
        accepted_at: string | null;
        revoked_at: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        email: string;
        role?: string;
        permissions?: string[];
        token_hash: string;
        expires_at: string;
        invited_by: string;
        accepted_by?: string | null;
        accepted_at?: string | null;
        revoked_at?: string | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        email?: string;
        role?: string;
        permissions?: string[];
        token_hash?: string;
        expires_at?: string;
        invited_by?: string;
        accepted_by?: string | null;
        accepted_at?: string | null;
        revoked_at?: string | null;
        created_at?: string;
      };
      Relationships: [];
    };
    invoice_items: {
      Row: {
        id: string;
        company_id: string;
        invoice_id: string;
        service_id: string | null;
        description: string;
        quantity: unknown;
        unit: string;
        unit_price_minor: number;
        discount_minor: number;
        tax_rate: unknown;
        tax_minor: number;
        line_total_minor: number;
        position: number;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        invoice_id: string;
        service_id?: string | null;
        description: string;
        quantity: unknown;
        unit?: string;
        unit_price_minor?: number;
        discount_minor?: number;
        tax_rate?: unknown;
        tax_minor?: number;
        line_total_minor?: number;
        position?: number;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        invoice_id?: string;
        service_id?: string | null;
        description?: string;
        quantity?: unknown;
        unit?: string;
        unit_price_minor?: number;
        discount_minor?: number;
        tax_rate?: unknown;
        tax_minor?: number;
        line_total_minor?: number;
        position?: number;
        created_at?: string;
      };
      Relationships: [];
    };
    invoices: {
      Row: {
        id: string;
        company_id: string;
        customer_id: string;
        job_order_id: string | null;
        quotation_id: string | null;
        invoice_number: string;
        status: string;
        issue_date: string;
        due_date: string | null;
        subtotal_minor: number;
        item_discount_minor: number;
        order_discount_minor: number;
        discount_minor: number;
        tax_minor: number;
        total_minor: number;
        amount_paid_minor: number;
        void_reason: string | null;
        voided_at: string | null;
        voided_by: string | null;
        notes: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        customer_id: string;
        job_order_id?: string | null;
        quotation_id?: string | null;
        invoice_number: string;
        status?: string;
        issue_date?: string;
        due_date?: string | null;
        subtotal_minor?: number;
        item_discount_minor?: number;
        order_discount_minor?: number;
        discount_minor?: number;
        tax_minor?: number;
        total_minor?: number;
        amount_paid_minor?: number;
        void_reason?: string | null;
        voided_at?: string | null;
        voided_by?: string | null;
        notes?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        customer_id?: string;
        job_order_id?: string | null;
        quotation_id?: string | null;
        invoice_number?: string;
        status?: string;
        issue_date?: string;
        due_date?: string | null;
        subtotal_minor?: number;
        item_discount_minor?: number;
        order_discount_minor?: number;
        discount_minor?: number;
        tax_minor?: number;
        total_minor?: number;
        amount_paid_minor?: number;
        void_reason?: string | null;
        voided_at?: string | null;
        voided_by?: string | null;
        notes?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    job_items: {
      Row: {
        id: string;
        company_id: string;
        job_order_id: string;
        service_id: string | null;
        description: string;
        quantity: unknown;
        unit: string;
        dimensions: Json | null;
        unit_price_minor: number;
        discount_minor: number;
        tax_minor: number;
        line_total_minor: number;
        production_notes: string | null;
        position: number;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        job_order_id: string;
        service_id?: string | null;
        description: string;
        quantity: unknown;
        unit?: string;
        dimensions?: Json | null;
        unit_price_minor?: number;
        discount_minor?: number;
        tax_minor?: number;
        line_total_minor?: number;
        production_notes?: string | null;
        position?: number;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        job_order_id?: string;
        service_id?: string | null;
        description?: string;
        quantity?: unknown;
        unit?: string;
        dimensions?: Json | null;
        unit_price_minor?: number;
        discount_minor?: number;
        tax_minor?: number;
        line_total_minor?: number;
        production_notes?: string | null;
        position?: number;
        created_at?: string;
      };
      Relationships: [];
    };
    job_orders: {
      Row: {
        id: string;
        company_id: string;
        customer_id: string;
        quotation_id: string | null;
        job_number: string;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        due_date: string | null;
        design_required: boolean;
        design_approval_required: boolean;
        assigned_to: string | null;
        production_started_at: string | null;
        ready_at: string | null;
        delivered_at: string | null;
        cancelled_at: string | null;
        cancellation_reason: string | null;
        delivery_notes: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        customer_id: string;
        quotation_id?: string | null;
        job_number: string;
        title: string;
        description?: string | null;
        status?: string;
        priority?: string;
        due_date?: string | null;
        design_required?: boolean;
        design_approval_required?: boolean;
        assigned_to?: string | null;
        production_started_at?: string | null;
        ready_at?: string | null;
        delivered_at?: string | null;
        cancelled_at?: string | null;
        cancellation_reason?: string | null;
        delivery_notes?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        customer_id?: string;
        quotation_id?: string | null;
        job_number?: string;
        title?: string;
        description?: string | null;
        status?: string;
        priority?: string;
        due_date?: string | null;
        design_required?: boolean;
        design_approval_required?: boolean;
        assigned_to?: string | null;
        production_started_at?: string | null;
        ready_at?: string | null;
        delivered_at?: string | null;
        cancelled_at?: string | null;
        cancellation_reason?: string | null;
        delivery_notes?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    job_status_history: {
      Row: {
        id: string;
        company_id: string;
        job_order_id: string;
        previous_status: string | null;
        new_status: string;
        changed_by: string | null;
        note: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        job_order_id: string;
        previous_status?: string | null;
        new_status: string;
        changed_by?: string | null;
        note?: string | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        job_order_id?: string;
        previous_status?: string | null;
        new_status?: string;
        changed_by?: string | null;
        note?: string | null;
        created_at?: string;
      };
      Relationships: [];
    };
    material_recipes: {
      Row: {
        id: string;
        company_id: string;
        service_id: string;
        material_id: string;
        quantity_per_output_unit: unknown;
        waste_percentage: unknown;
        active: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        service_id: string;
        material_id: string;
        quantity_per_output_unit: unknown;
        waste_percentage?: unknown;
        active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        service_id?: string;
        material_id?: string;
        quantity_per_output_unit?: unknown;
        waste_percentage?: unknown;
        active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    materials: {
      Row: {
        id: string;
        company_id: string;
        material_code: string;
        name: string;
        category: string;
        unit: string;
        quantity_on_hand: unknown;
        reorder_level: unknown;
        average_unit_cost_minor: number;
        active: boolean;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        material_code: string;
        name: string;
        category?: string;
        unit?: string;
        quantity_on_hand?: unknown;
        reorder_level?: unknown;
        average_unit_cost_minor?: number;
        active?: boolean;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        material_code?: string;
        name?: string;
        category?: string;
        unit?: string;
        quantity_on_hand?: unknown;
        reorder_level?: unknown;
        average_unit_cost_minor?: number;
        active?: boolean;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    notification_outbox: {
      Row: {
        id: string;
        company_id: string;
        notification_id: string;
        channel: string;
        status: string;
        attempts: number;
        next_attempt_at: string;
        last_error: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        notification_id: string;
        channel: string;
        status?: string;
        attempts?: number;
        next_attempt_at?: string;
        last_error?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        notification_id?: string;
        channel?: string;
        status?: string;
        attempts?: number;
        next_attempt_at?: string;
        last_error?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    notifications: {
      Row: {
        id: string;
        company_id: string;
        recipient_user_id: string | null;
        customer_id: string | null;
        event_type: string;
        channel: string;
        destination: string | null;
        status: string;
        provider_reference: string | null;
        error_message: string | null;
        payload: Json;
        dedupe_key: string | null;
        sent_at: string | null;
        read_at: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        recipient_user_id?: string | null;
        customer_id?: string | null;
        event_type: string;
        channel: string;
        destination?: string | null;
        status?: string;
        provider_reference?: string | null;
        error_message?: string | null;
        payload?: Json;
        dedupe_key?: string | null;
        sent_at?: string | null;
        read_at?: string | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        recipient_user_id?: string | null;
        customer_id?: string | null;
        event_type?: string;
        channel?: string;
        destination?: string | null;
        status?: string;
        provider_reference?: string | null;
        error_message?: string | null;
        payload?: Json;
        dedupe_key?: string | null;
        sent_at?: string | null;
        read_at?: string | null;
        created_at?: string;
      };
      Relationships: [];
    };
    payment_allocations: {
      Row: {
        id: string;
        company_id: string;
        payment_id: string;
        invoice_id: string;
        amount_minor: number;
        status: string;
        reversed_at: string | null;
        reversed_by: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        payment_id: string;
        invoice_id: string;
        amount_minor: number;
        status?: string;
        reversed_at?: string | null;
        reversed_by?: string | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        payment_id?: string;
        invoice_id?: string;
        amount_minor?: number;
        status?: string;
        reversed_at?: string | null;
        reversed_by?: string | null;
        created_at?: string;
      };
      Relationships: [];
    };
    payments: {
      Row: {
        id: string;
        company_id: string;
        customer_id: string;
        payment_reference: string;
        amount_minor: number;
        payment_method: string;
        payment_date: string;
        external_reference: string | null;
        notes: string | null;
        recorded_by: string;
        status: string;
        idempotency_key: string;
        reversed_at: string | null;
        reversed_by: string | null;
        reversal_reason: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        customer_id: string;
        payment_reference: string;
        amount_minor: number;
        payment_method: string;
        payment_date?: string;
        external_reference?: string | null;
        notes?: string | null;
        recorded_by: string;
        status?: string;
        idempotency_key: string;
        reversed_at?: string | null;
        reversed_by?: string | null;
        reversal_reason?: string | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        customer_id?: string;
        payment_reference?: string;
        amount_minor?: number;
        payment_method?: string;
        payment_date?: string;
        external_reference?: string | null;
        notes?: string | null;
        recorded_by?: string;
        status?: string;
        idempotency_key?: string;
        reversed_at?: string | null;
        reversed_by?: string | null;
        reversal_reason?: string | null;
        created_at?: string;
      };
      Relationships: [];
    };
    profiles: {
      Row: {
        id: string;
        full_name: string;
        phone: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id: string;
        full_name: string;
        phone?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        full_name?: string;
        phone?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    purchase_order_items: {
      Row: {
        id: string;
        company_id: string;
        purchase_order_id: string;
        material_id: string;
        quantity_ordered: unknown;
        quantity_received: unknown;
        unit_cost_minor: number;
        line_total_minor: number;
        position: number;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        purchase_order_id: string;
        material_id: string;
        quantity_ordered: unknown;
        quantity_received?: unknown;
        unit_cost_minor?: number;
        line_total_minor?: number;
        position?: number;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        purchase_order_id?: string;
        material_id?: string;
        quantity_ordered?: unknown;
        quantity_received?: unknown;
        unit_cost_minor?: number;
        line_total_minor?: number;
        position?: number;
        created_at?: string;
      };
      Relationships: [];
    };
    purchase_orders: {
      Row: {
        id: string;
        company_id: string;
        supplier_id: string;
        purchase_order_number: string;
        status: string;
        order_date: string;
        expected_date: string | null;
        subtotal_minor: number;
        total_minor: number;
        notes: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        supplier_id: string;
        purchase_order_number: string;
        status?: string;
        order_date?: string;
        expected_date?: string | null;
        subtotal_minor?: number;
        total_minor?: number;
        notes?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        supplier_id?: string;
        purchase_order_number?: string;
        status?: string;
        order_date?: string;
        expected_date?: string | null;
        subtotal_minor?: number;
        total_minor?: number;
        notes?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    quotation_items: {
      Row: {
        id: string;
        company_id: string;
        quotation_id: string;
        service_id: string | null;
        description: string;
        quantity: unknown;
        unit: string;
        unit_price_minor: number;
        discount_minor: number;
        tax_rate: unknown;
        tax_minor: number;
        line_total_minor: number;
        position: number;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        quotation_id: string;
        service_id?: string | null;
        description: string;
        quantity: unknown;
        unit?: string;
        unit_price_minor?: number;
        discount_minor?: number;
        tax_rate?: unknown;
        tax_minor?: number;
        line_total_minor?: number;
        position?: number;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        quotation_id?: string;
        service_id?: string | null;
        description?: string;
        quantity?: unknown;
        unit?: string;
        unit_price_minor?: number;
        discount_minor?: number;
        tax_rate?: unknown;
        tax_minor?: number;
        line_total_minor?: number;
        position?: number;
        created_at?: string;
      };
      Relationships: [];
    };
    quotations: {
      Row: {
        id: string;
        company_id: string;
        customer_id: string;
        quotation_number: string;
        status: string;
        issue_date: string;
        valid_until: string | null;
        subtotal_minor: number;
        item_discount_minor: number;
        order_discount_minor: number;
        discount_minor: number;
        tax_minor: number;
        total_minor: number;
        notes: string | null;
        terms: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        customer_id: string;
        quotation_number: string;
        status?: string;
        issue_date?: string;
        valid_until?: string | null;
        subtotal_minor?: number;
        item_discount_minor?: number;
        order_discount_minor?: number;
        discount_minor?: number;
        tax_minor?: number;
        total_minor?: number;
        notes?: string | null;
        terms?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        customer_id?: string;
        quotation_number?: string;
        status?: string;
        issue_date?: string;
        valid_until?: string | null;
        subtotal_minor?: number;
        item_discount_minor?: number;
        order_discount_minor?: number;
        discount_minor?: number;
        tax_minor?: number;
        total_minor?: number;
        notes?: string | null;
        terms?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    services: {
      Row: {
        id: string;
        company_id: string;
        name: string;
        description: string | null;
        category: string;
        default_unit: string;
        default_unit_price_minor: number;
        active: boolean;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        name: string;
        description?: string | null;
        category?: string;
        default_unit?: string;
        default_unit_price_minor?: number;
        active?: boolean;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        name?: string;
        description?: string | null;
        category?: string;
        default_unit?: string;
        default_unit_price_minor?: number;
        active?: boolean;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    stock_movements: {
      Row: {
        id: string;
        company_id: string;
        material_id: string;
        movement_type: string;
        quantity_delta: unknown;
        unit_cost_minor: number | null;
        reference_type: string | null;
        reference_id: string | null;
        note: string | null;
        performed_by: string | null;
        idempotency_key: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        material_id: string;
        movement_type: string;
        quantity_delta: unknown;
        unit_cost_minor?: number | null;
        reference_type?: string | null;
        reference_id?: string | null;
        note?: string | null;
        performed_by?: string | null;
        idempotency_key?: string | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        material_id?: string;
        movement_type?: string;
        quantity_delta?: unknown;
        unit_cost_minor?: number | null;
        reference_type?: string | null;
        reference_id?: string | null;
        note?: string | null;
        performed_by?: string | null;
        idempotency_key?: string | null;
        created_at?: string;
      };
      Relationships: [];
    };
    suppliers: {
      Row: {
        id: string;
        company_id: string;
        supplier_code: string;
        name: string;
        contact_person: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        notes: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        company_id: string;
        supplier_code: string;
        name: string;
        contact_person?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        notes?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        company_id?: string;
        supplier_code?: string;
        name?: string;
        contact_person?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        notes?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    };
    Views: {
    customer_balances: {
      Row: {
        customer_id: string | null;
        company_id: string | null;
        name: string | null;
        customer_code: string | null;
        invoiced_minor: number | null;
        paid_minor: number | null;
        outstanding_minor: number | null;
      };
      Relationships: [];
    };
    invoice_balances: {
      Row: {
        id: string | null;
        company_id: string | null;
        customer_id: string | null;
        invoice_number: string | null;
        status: string | null;
        issue_date: string | null;
        due_date: string | null;
        total_minor: number | null;
        paid_minor: number | null;
        outstanding_minor: number | null;
      };
      Relationships: [];
    };
    job_profitability: {
      Row: {
        job_order_id: string | null;
        company_id: string | null;
        job_number: string | null;
        title: string | null;
        status: string | null;
        customer_id: string | null;
        revenue_minor: number | null;
        material_cost_minor: number | null;
        gross_profit_minor: number | null;
        gross_margin_percent: number | null;
      };
      Relationships: [];
    };
    material_valuation: {
      Row: {
        id: string | null;
        company_id: string | null;
        material_code: string | null;
        name: string | null;
        unit: string | null;
        quantity_on_hand: unknown | null;
        reorder_level: unknown | null;
        average_unit_cost_minor: number | null;
        stock_value_minor: number | null;
        is_low_stock: boolean | null;
      };
      Relationships: [];
    };
    payment_balances: {
      Row: {
        id: string | null;
        company_id: string | null;
        customer_id: string | null;
        payment_reference: string | null;
        payment_method: string | null;
        payment_date: string | null;
        status: string | null;
        amount_minor: number | null;
        allocated_minor: number | null;
        unallocated_minor: number | null;
      };
      Relationships: [];
    };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
