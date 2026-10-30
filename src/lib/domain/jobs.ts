export const JOB_STATUSES = [
  "received",
  "in_design",
  "in_production",
  "ready",
  "delivered",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  received: "Received",
  in_design: "In design",
  in_production: "In production",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const JOB_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export interface JobTransitionContext {
  designApprovalRequired: boolean;
  latestArtworkApprovalStatus?: string | null;
  canManageJobs: boolean;
  canUpdateStatus: boolean;
}

export interface JobTransitionResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  requiresManagePermission?: boolean;
}

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  received: ["in_design", "in_production", "cancelled"],
  in_design: ["in_production", "cancelled"],
  in_production: ["ready", "cancelled"],
  ready: ["delivered", "in_production", "cancelled"],
  delivered: ["in_production"],
  cancelled: [],
};

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export function canTransitionJob(
  from: JobStatus,
  to: JobStatus,
  context: JobTransitionContext,
): JobTransitionResult {
  if (from === to) {
    return { allowed: false, code: "SAME_STATUS", reason: "The job is already in that status." };
  }
  if (!context.canUpdateStatus) {
    return { allowed: false, code: "FORBIDDEN", reason: "You do not have permission to update job status." };
  }
  if (!TRANSITIONS[from].includes(to)) {
    return {
      allowed: false,
      code: "INVALID_TRANSITION",
      reason: `${JOB_STATUS_LABELS[from]} jobs cannot move to ${JOB_STATUS_LABELS[to]}.`,
    };
  }

  const requiresManage = to === "cancelled" || (to === "in_production" && (from === "ready" || from === "delivered"));
  if (requiresManage && !context.canManageJobs) {
    return {
      allowed: false,
      code: "MANAGE_PERMISSION_REQUIRED",
      reason: "A manager must authorise cancellation or rework.",
      requiresManagePermission: true,
    };
  }

  if (to === "in_production" && context.designApprovalRequired) {
    if (context.latestArtworkApprovalStatus !== "approved") {
      return {
        allowed: false,
        code: "ARTWORK_APPROVAL_REQUIRED",
        reason: "The latest artwork must be approved before production can start.",
      };
    }
  }

  return { allowed: true };
}

export function availableJobTransitions(
  from: JobStatus,
  context: JobTransitionContext,
): Array<{ status: JobStatus; label: string; allowed: boolean; reason?: string; requiresManagePermission: boolean }> {
  return JOB_STATUSES.filter((status) => status !== from).map((status) => {
    const result = canTransitionJob(from, status, context);
    return {
      status,
      label: JOB_STATUS_LABELS[status],
      allowed: result.allowed,
      reason: result.reason,
      requiresManagePermission: Boolean(result.requiresManagePermission),
    };
  });
}

export function isOverdueJob(
  job: { status: string; due_date: string | null },
  today = new Date().toISOString().slice(0, 10),
): boolean {
  return Boolean(
    job.due_date &&
      job.due_date < today &&
      job.status !== "delivered" &&
      job.status !== "cancelled",
  );
}

export function isActiveJob(status: JobStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}
