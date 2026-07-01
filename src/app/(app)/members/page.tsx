"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
} from "@/components/ui/dialog";
import { useStore, type NewMember } from "@/lib/store/provider";
import { formatDate, initials } from "@/lib/utils";

const TONE: Record<string, "success" | "secondary" | "warning"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  PENDING: "warning",
  SUSPENDED: "danger" as never,
};

const empty: NewMember = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  type: "REGULAR",
  status: "ACTIVE",
  family: "",
};

export default function MembersPage() {
  const { state, addMember } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewMember>(empty);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return state.members.filter(
      (m) =>
        !needle ||
        m.fullName.toLowerCase().includes(needle) ||
        m.email.toLowerCase().includes(needle) ||
        m.memberCode.toLowerCase().includes(needle),
    );
  }, [state.members, q]);

  function submit() {
    if (!form.firstName || !form.lastName) return;
    addMember(form);
    setForm(empty);
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Members"
        description={`${state.members.length} people in the community directory.`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4" /> Add member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a member</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </Field>
                <Field label="Last name">
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <Field label="Family name">
                  <Input value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })} />
                </Field>
                <Field label="Membership type">
                  <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {["REGULAR", "FAMILY", "STUDENT", "SENIOR", "LIFETIME", "HONORARY"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Status">
                  <NativeSelect
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as NewMember["status"] })}
                  >
                    {["ACTIVE", "PENDING", "INACTIVE", "SUSPENDED", "DECEASED", "MOVED_AWAY"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={submit} disabled={!form.firstName || !form.lastName}>
                  Add member
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-3 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
        <Input className="pl-9" placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Family</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => (
              <TableRow
                key={m.id}
                className="cursor-pointer"
                onClick={() => router.push(`/members/${m.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-accent-foreground)]">
                      {initials(m.fullName)}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--color-primary)] hover:underline">{m.fullName}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{m.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-[var(--color-muted-foreground)]">{m.memberCode}</TableCell>
                <TableCell>{m.family}</TableCell>
                <TableCell className="text-[var(--color-muted-foreground)]">{m.type}</TableCell>
                <TableCell className="text-[var(--color-muted-foreground)]">{formatDate(m.joined)}</TableCell>
                <TableCell>
                  <Badge variant={TONE[m.status] ?? "secondary"}>{m.status.toLowerCase()}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
