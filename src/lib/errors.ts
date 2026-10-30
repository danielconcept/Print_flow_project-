export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly userMessage: string = message,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  SLUG_TAKEN: "That workspace URL is already in use. Choose another.",
  INVITATION_PENDING: "An invitation is already pending for this email address.",
  INVITATION_NOT_FOUND: "This invitation link is not valid.",
  INVITATION_INACTIVE: "This invitation has already been used or revoked.",
  INVITATION_EXPIRED: "This invitation has expired. Ask an administrator for a new one.",
  INVITATION_EMAIL_MISMATCH: "Sign in with the email address that was invited.",
  ALREADY_MEMBER: "You are already a member of this company.",
  MEMBERSHIP_NOT_FOUND: "Staff member not found.",
  ONLY_OWNER_CAN_MANAGE_ADMINS: "Only the company owner can manage administrators.",
  OWNER_TRANSFER_REQUIRED: "Use ownership transfer to change the company owner.",
  CANNOT_REMOVE_OWNER: "The company owner cannot be removed.",
  CANNOT_REMOVE_SELF: "You cannot remove your own membership.",
  TARGET_MEMBER_NOT_FOUND: "The selected staff member is not active in this company.",
  QUOTATION_NOT_FOUND: "Quotation not found.",
  QUOTATION_MUST_BE_ACCEPTED: "Only an accepted quotation can be converted into a job.",
  QUOTATION_ITEMS_LOCKED: "This quotation is no longer editable. Create a revision instead.",
  QUOTATION_NOT_CONVERTED_TO_JOB: "Create the job before marking this quotation as converted.",
  INVALID_QUOTATION_STATUS_TRANSITION: "That quotation status change is not allowed.",
  JOB_NOT_FOUND: "Job not found.",
  JOB_ALREADY_IN_STATUS: "The job is already in that status.",
  INVALID_JOB_STATUS_TRANSITION: "That job status change is not allowed.",
  JOB_STATUS_REQUIRES_TRANSITION_RPC: "Use the job workflow actions to change status.",
  ARTWORK_APPROVAL_REQUIRED: "The latest artwork must be approved before production starts.",
  APPROVAL_REQUIREMENT_LOCKED: "Artwork approval requirements cannot be changed after production is planned.",
  INVOICE_NOT_FOUND: "Invoice not found.",
  INVOICE_NOT_PAYABLE: "This invoice cannot receive payments.",
  INVOICE_ITEMS_LOCKED: "Invoice items are locked after issue. Void and reissue the invoice instead.",
  INVOICE_HAS_PAYMENTS: "Payments already exist against this invoice.",
  INVOICE_WITH_PAYMENTS_CANNOT_BE_VOIDED: "Reverse the payments before voiding this invoice.",
  INVOICE_ALREADY_VOID: "This invoice is already void.",
  ALLOCATION_EXCEEDS_OUTSTANDING_BALANCE: "An allocation cannot exceed the invoice balance.",
  ALLOCATION_EXCEEDS_OUTSTANDING: "An allocation cannot exceed the invoice balance.",
  ALLOCATIONS_EXCEED_PAYMENT: "Allocations cannot exceed the payment amount.",
  ALLOCATIONS_EXCEED_PAYMENT_AMOUNT: "Allocations cannot exceed the payment amount.",
  INVALID_ALLOCATIONS: "Enter valid payment allocations.",
  INVALID_ALLOCATION: "Enter a valid allocation amount.",
  PAYMENT_NOT_FOUND: "Payment not found.",
  PAYMENT_ALREADY_REVERSED: "This payment has already been reversed.",
  PAYMENT_AMOUNT_MUST_BE_POSITIVE: "Payment amount must be greater than zero.",
  PAYMENT_METHOD_REQUIRED: "Choose a payment method.",
  PAYMENT_CUSTOMER_MISMATCH: "The payment and invoice belong to different customers.",
  INVOICE_CUSTOMER_MISMATCH: "The invoice belongs to a different customer.",
  REVERSAL_REASON_REQUIRED: "Enter a reason for the reversal.",
  VOID_REASON_REQUIRED: "Enter a reason for voiding the invoice.",
  MATERIAL_NOT_FOUND: "Material not found.",
  INSUFFICIENT_STOCK: "There is not enough stock for this operation.",
  STOCK_MUST_BE_CHANGED_THROUGH_MOVEMENT: "Use a stock adjustment or production consumption entry.",
  CONSUMPTION_REQUIRES_ACTIVE_PRODUCTION: "Materials can only be consumed while a job is in production.",
  CONSUMPTION_ITEMS_REQUIRED: "Add at least one material usage line.",
  DUPLICATE_MATERIAL_IN_REQUEST: "Each material may appear only once per consumption entry.",
  PURCHASE_ORDER_NOT_FOUND: "Purchase order not found.",
  PURCHASE_ORDER_NOT_RECEIVABLE: "Only ordered purchase orders can receive goods.",
  PURCHASE_ORDER_STATUS_REQUIRES_RECEIVING_RPC: "Use the goods receipt workflow to update this purchase order.",
  PURCHASE_ORDER_ITEMS_LOCKED: "This purchase order is no longer editable.",
  RECEIPT_EXCEEDS_REMAINING_QUANTITY: "Received quantity exceeds the remaining ordered quantity.",
  RECEIVED_EXCEEDS_ORDERED: "Received quantity cannot exceed ordered quantity.",
  RECEIPT_ITEMS_REQUIRED: "Add at least one receipt line.",
  IDEMPOTENCY_KEY_REQUIRED: "The operation is missing a retry-safety key. Refresh and try again.",
  TENANT_MISMATCH: "This record does not belong to your company.",
  CUSTOMER_NOT_FOUND: "Customer not found.",
  CUSTOMER_MISMATCH: "The selected invoice belongs to a different customer.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_SLUG: "The company name could not be converted into a valid workspace address. Use at least three letters or numbers.",
  COMPANY_NAME_REQUIRED: "Enter a company name with at least two characters.",
  INVALID: "Check the highlighted fields and try again.",
  INVALID_PERMISSION: "One or more selected permissions are invalid.",
  INVALID_ROLE: "Select a valid role.",
  INVALID_STATUS: "Select a valid status.",
  INVALID_PRIORITY: "Select a valid priority.",
  INVALID_ARTWORK_STATUS: "Select a valid artwork decision.",
  NOTIFICATION_NOT_FOUND: "Notification not found.",
  STORAGE_NOT_CONFIGURED: "File storage is not configured.",
  EMAIL_NOT_CONFIGURED: "Email delivery is not configured.",
  WHATSAPP_NOT_CONFIGURED: "WhatsApp delivery is not configured.",
};

export function friendlyMessage(codeOrMessage: string | null | undefined): string | null {
  if (!codeOrMessage) return null;
  const base = codeOrMessage.split(":")[0]?.trim() ?? codeOrMessage;
  if (FRIENDLY_MESSAGES[base]) return FRIENDLY_MESSAGES[base];
  if (codeOrMessage.startsWith("INSUFFICIENT_STOCK")) {
    return "There is not enough stock for this operation.";
  }
  return null;
}

export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return {
      ok: false,
      error: error.userMessage,
      code: error.code,
    };
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };

    const friendly = friendlyMessage(candidate.message);
    if (friendly) {
      return { ok: false, error: friendly, code: candidate.message?.split(":")[0] };
    }

    if (candidate.code === "23505" || candidate.code === "unique_violation") {
      return {
        ok: false,
        error: "A record with these details already exists.",
        code: "DUPLICATE",
      };
    }
    if (candidate.code === "23503" || candidate.code === "foreign_key_violation") {
      return {
        ok: false,
        error: "This record is still referenced and cannot be changed.",
        code: "REFERENCED_RECORD",
      };
    }
    if (candidate.code === "23514" || candidate.code === "check_violation") {
      return {
        ok: false,
        error: "The submitted values violate a business rule.",
        code: "CONSTRAINT_VIOLATION",
      };
    }
    if (candidate.code === "PGRST202" || candidate.code === "PGRST205") {
      return {
        ok: false,
        error: "Workspace setup is not available yet because the Supabase database migrations are missing or not refreshed.",
        code: "DATABASE_SETUP_INCOMPLETE",
      };
    }
    if (candidate.code === "P0001") {
      return {
        ok: false,
        error: friendlyMessage(candidate.message) ?? "The operation could not be completed.",
        code: candidate.message?.split(":")[0],
      };
    }
  }

  return {
    ok: false,
    error: "Something went wrong. Please try again. If it continues, contact support.",
    code: "INTERNAL",
  };
}

export function assertNotSupabaseError(
  error: { message?: string; code?: string; details?: string; hint?: string } | null,
  fallback: string,
): void {
  if (!error) return;
  const friendly = friendlyMessage(error.message);
  throw new AppError(
    error.code ?? "DATABASE_ERROR",
    error.message ?? fallback,
    friendly ?? fallback,
    500,
  );
}

export function validationErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}
