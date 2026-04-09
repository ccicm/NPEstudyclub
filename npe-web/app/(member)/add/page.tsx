import { AddResourceForm } from "@/components/member/add-resource-form";
import { addResourceAction } from "./actions";

export default async function AddResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ uploaded?: string; error?: string }>;
}) {
  const params = await searchParams;
  const errorCode = params.error || null;

  return (
    <AddResourceForm
      action={addResourceAction}
      uploaded={params.uploaded === "1"}
      errorCode={errorCode}
    />
  );
}
