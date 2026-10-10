import { Badge } from "@/components/ui/badge";
import type { GuardWarning, Rating, ResultSource } from "@/lib/schemas";

export const RATING_LABEL: Record<Rating, string> = {
  not_evident: "Not evident",
  weak: "Weak",
  moderate: "Moderate",
  strong: "Strong",
};

const RATING_CLASS: Record<Rating, string> = {
  not_evident: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  weak: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  moderate: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  strong: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
};

export function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${RATING_CLASS[rating]}`}>
      {RATING_LABEL[rating]}
    </span>
  );
}

/** Required on anything that came from cached demo data. */
export function SourceBadge({ source }: { source: ResultSource }) {
  if (source !== "sample") return null;
  return <Badge variant="outline">Sample result</Badge>;
}

export const WARNING_LABEL: Record<GuardWarning["kind"], string> = {
  unsupported_number: "Number not in your facts",
  unsupported_entity: "Name not in your facts",
  inflated_verb: "Stronger claim than your facts",
  invalid_fact_id: "Unknown or unconfirmed fact",
  unsupported_claim: "Needs your review",
  unverified_segment: "Unknown source",
};

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}
