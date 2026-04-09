import Link from "next/link";
import { QuizAddForm } from "@/components/member/quiz-add-form";
import { createQuizAction } from "@/app/(member)/quizzes/actions";

export default async function AddQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Minimum 4 questions required.</p>
        <Link href="/quizzes" className="text-sm underline">
          Back to quizzes
        </Link>
      </div>
      <QuizAddForm action={createQuizAction} errorCode={params.error || null} />
    </div>
  );
}
