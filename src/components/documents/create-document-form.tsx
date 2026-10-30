"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createQuotation } from "@/app/actions/quotations";
import { createJob } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Customer = { id: string; name: string; customer_code: string };

export function CreateDocumentForm({ type, customers, defaultTerms }: {
  type: "quotation" | "job";
  customers: Customer[];
  defaultTerms?: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const item = {
      description: values.itemDescription,
      quantity: values.quantity,
      unit: values.unit,
      unitPrice: values.unitPrice,
      discount: values.discount || "0",
      taxRate: values.taxRate || "0",
    };
    const input = type === "quotation" ? {
      customerId: values.customerId,
      issueDate: values.issueDate,
      validUntil: values.validUntil,
      orderDiscount: values.orderDiscount || "0",
      notes: values.notes,
      terms: values.terms,
      items: [item],
    } : {
      customerId: values.customerId,
      title: values.title,
      description: values.notes,
      priority: values.priority,
      dueDate: values.dueDate,
      designRequired: values.designRequired === "on",
      designApprovalRequired: values.designApprovalRequired === "on",
      items: [item],
    };

    startTransition(async () => {
      const result = type === "quotation" ? await createQuotation(input) : await createJob(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(type === "quotation" ? "/quotations" : "/jobs");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6 rounded-lg border p-5">
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="customerId">Customer *</Label>
        <select id="customerId" name="customerId" required defaultValue="" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="" disabled>Select a customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} ({customer.customer_code})</option>)}
        </select>
        {!customers.length && <p className="text-sm text-muted-foreground">Create a customer before creating a {type}.</p>}
      </div>

      {type === "quotation" ? <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="issueDate">Issue date *</Label><Input id="issueDate" name="issueDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
        <div className="space-y-2"><Label htmlFor="validUntil">Valid until</Label><Input id="validUntil" name="validUntil" type="date" /></div>
      </div> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="title">Job title *</Label><Input id="title" name="title" required minLength={2} maxLength={180} /></div>
          <div className="space-y-2"><Label htmlFor="priority">Priority</Label><select id="priority" name="priority" className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
          <div className="space-y-2"><Label htmlFor="dueDate">Due date</Label><Input id="dueDate" name="dueDate" type="date" /></div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="designRequired" /> Design required</label><label className="flex items-center gap-2"><input type="checkbox" name="designApprovalRequired" /> Customer approval required</label></div>
      </>}

      <fieldset className="space-y-4 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">First line item</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="itemDescription">Description *</Label><Input id="itemDescription" name="itemDescription" required maxLength={500} /></div>
          <div className="space-y-2"><Label htmlFor="quantity">Quantity *</Label><Input id="quantity" name="quantity" type="number" min="0.001" step="0.001" required defaultValue="1" /></div>
          <div className="space-y-2"><Label htmlFor="unit">Unit *</Label><Input id="unit" name="unit" required maxLength={30} defaultValue="piece" /></div>
          <div className="space-y-2"><Label htmlFor="unitPrice">Unit price *</Label><Input id="unitPrice" name="unitPrice" type="number" min="0" step="0.01" required defaultValue="0" /></div>
          <div className="space-y-2"><Label htmlFor="discount">Line discount</Label><Input id="discount" name="discount" type="number" min="0" step="0.01" defaultValue="0" /></div>
          <div className="space-y-2"><Label htmlFor="taxRate">Tax rate (%)</Label><Input id="taxRate" name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue="0" /></div>
        </div>
      </fieldset>

      {type === "quotation" && <div className="space-y-2"><Label htmlFor="orderDiscount">Order discount</Label><Input id="orderDiscount" name="orderDiscount" type="number" min="0" step="0.01" defaultValue="0" /><Label htmlFor="terms">Terms</Label><Textarea id="terms" name="terms" maxLength={4000} defaultValue={defaultTerms} /><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" maxLength={2000} /></div>}
      {type === "job" && <div className="space-y-2"><Label htmlFor="notes">Description / notes</Label><Textarea id="notes" name="notes" maxLength={3000} /></div>}
      <div className="flex gap-3"><Button type="submit" disabled={busy || !customers.length}>{busy ? "Saving…" : type === "quotation" ? "Create quotation" : "Create job"}</Button><Button type="button" variant="outline" asChild><Link href={type === "quotation" ? "/quotations" : "/jobs"}>Cancel</Link></Button></div>
    </form>
  );
}
