"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { archiveCustomer, createCustomer } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CustomerRecord {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export function CustomerManager({
  customers,
  canManage,
  loadError,
}: {
  customers: CustomerRecord[];
  canManage: boolean;
  loadError?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const visibleCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.customer_code, customer.phone, customer.email ?? ""]
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [customers, query]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    startTransition(async () => {
      const result = await createCustomer(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Customer created.");
      setShowForm(false);
      form.reset();
      router.refresh();
    });
  }

  function handleArchive(customer: CustomerRecord) {
    if (!window.confirm(`Archive ${customer.name}?`)) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await archiveCustomer(customer.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      {loadError && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">Could not load customers: {loadError}</p>}
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
      {success && <p role="status" className="rounded-md border border-green-600/30 bg-green-600/5 p-3 text-sm">{success}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          aria-label="Search customers"
          placeholder="Search name, code, phone, or email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="sm:max-w-sm"
        />
        {canManage && <Button onClick={() => setShowForm((shown) => !shown)}>{showForm ? "Cancel" : "New Customer"}</Button>}
      </div>

      {showForm && canManage && (
        <form onSubmit={handleCreate} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Name *</Label>
            <Input id="customer-name" name="name" required minLength={2} maxLength={160} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone *</Label>
            <Input id="customer-phone" name="phone" type="tel" required minLength={5} maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input id="customer-email" name="email" type="email" maxLength={254} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-address">Address</Label>
            <Input id="customer-address" name="address" maxLength={500} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer-notes">Notes</Label>
            <Textarea id="customer-notes" name="notes" maxLength={2000} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save customer"}</Button>
          </div>
        </form>
      )}

      {visibleCustomers.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((customer) => (
                <tr key={customer.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">{customer.customer_code}</div>
                  </td>
                  <td className="px-4 py-3">{customer.phone}</td>
                  <td className="px-4 py-3">{customer.email || "—"}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleArchive(customer)}>Archive</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{query ? "No matching customers" : "No customers yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{query ? "Try a different search." : "Create your first customer to get started."}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{visibleCustomers.length} of {customers.length} customers</p>
    </section>
  );
}
