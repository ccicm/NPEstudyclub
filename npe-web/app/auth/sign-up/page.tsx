import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="rounded-2xl border bg-card p-6">
          <h1 className="text-2xl">Create your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the same email you submitted in your access request.
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  );
}
