import { AddResourceForm } from "@/components/member/add-resource-form";
import { addResourceAction } from "./actions";

export default async function AddResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ uploaded?: string; error?: string; db_code?: string; db_hint?: string; db_col?: string }>;
}) {
  const params = await searchParams;
  const errorCode = params.error || null;
  const dbCode = params.db_code || null;
  const dbHint = params.db_hint || null;
  const dbColumn = params.db_col || null;

  return (
    <AddResourceForm
      action={addResourceAction}
      uploaded={params.uploaded === "1"}
      errorCode={errorCode}
      dbCode={dbCode}
      dbHint={dbHint}
      dbColumn={dbColumn}
    />
  );
}
