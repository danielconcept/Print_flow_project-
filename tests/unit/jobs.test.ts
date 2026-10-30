import { describe, expect, it } from "vitest";
import {
  canTransitionJob,
  isActiveJob,
  isJobStatus,
  isOverdueJob,
  availableJobTransitions,
} from "@/lib/domain/jobs";

const staff = {
  designApprovalRequired: false,
  canManageJobs: false,
  canUpdateStatus: true,
};

const manager = {
  designApprovalRequired: false,
  canManageJobs: true,
  canUpdateStatus: true,
};

describe("job status transitions", () => {
  it("allows normal production flow", () => {
    expect(canTransitionJob("received", "in_production", manager).allowed).toBe(true);
    expect(canTransitionJob("in_production", "ready", staff).allowed).toBe(true);
    expect(canTransitionJob("ready", "delivered", staff).allowed).toBe(true);
  });

  it("blocks invalid jumps", () => {
    const result = canTransitionJob("received", "delivered", manager);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("INVALID_TRANSITION");
    expect(canTransitionJob("cancelled", "received", manager).allowed).toBe(false);
  });

  it("requires management permission for cancellation and rework", () => {
    expect(canTransitionJob("received", "cancelled", staff).code).toBe("MANAGE_PERMISSION_REQUIRED");
    expect(canTransitionJob("received", "cancelled", manager).allowed).toBe(true);
    expect(canTransitionJob("delivered", "in_production", staff).code).toBe("MANAGE_PERMISSION_REQUIRED");
    expect(canTransitionJob("delivered", "in_production", manager).allowed).toBe(true);
  });

  it("requires artwork approval before production when configured", () => {
    const context = { ...manager, designApprovalRequired: true, latestArtworkApprovalStatus: "pending" };
    expect(canTransitionJob("in_design", "in_production", context).code).toBe("ARTWORK_APPROVAL_REQUIRED");
    expect(
      canTransitionJob("in_design", "in_production", {
        ...context,
        latestArtworkApprovalStatus: "approved",
      }).allowed,
    ).toBe(true);
  });

  it("requires status update permission", () => {
    expect(canTransitionJob("received", "in_design", { ...staff, canUpdateStatus: false }).code).toBe(
      "FORBIDDEN",
    );
  });

  it("exposes allowed and blocked transitions for the UI", () => {
    const transitions = availableJobTransitions("received", manager);
    expect(transitions.find((entry) => entry.status === "cancelled")?.requiresManagePermission).toBe(
      false,
    );
    expect(transitions.find((entry) => entry.status === "delivered")?.allowed).toBe(false);
  });
});

describe("job helpers", () => {
  it("detects valid statuses and active work", () => {
    expect(isJobStatus("ready")).toBe(true);
    expect(isJobStatus("printing")).toBe(false);
    expect(isActiveJob("in_production")).toBe(true);
    expect(isActiveJob("delivered")).toBe(false);
  });

  it("detects overdue open jobs", () => {
    expect(isOverdueJob({ status: "received", due_date: "2026-01-01" }, "2026-01-02")).toBe(true);
    expect(isOverdueJob({ status: "delivered", due_date: "2026-01-01" }, "2026-01-02")).toBe(false);
    expect(isOverdueJob({ status: "received", due_date: null }, "2026-01-02")).toBe(false);
  });
});
