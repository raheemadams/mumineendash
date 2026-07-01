import { Construction } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Honest placeholder for modules whose data model exists in the Prisma schema
 * but whose UI is scheduled for a later build pass. Lists what will live here.
 */
export function ModuleStub({
  title,
  description,
  planned,
}: {
  title: string;
  description: string;
  planned: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} action={<Badge variant="warning">Scheduled</Badge>} />
      <Card>
        <CardContent className="py-10">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
              <Construction className="h-6 w-6" />
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              The data model for this module is already defined in the Prisma schema. This screen is
              scheduled for the next build pass.
            </p>
          </div>
          <div className="mx-auto mt-6 grid max-w-lg gap-2 sm:grid-cols-2">
            {planned.map((p) => (
              <div
                key={p}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-3 py-2 text-sm"
              >
                {p}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
