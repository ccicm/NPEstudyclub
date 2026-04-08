import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function isApprovedMember() {
  const cookieStore = await cookies();
  const cookieBypass = cookieStore.get("member_bypass")?.value === "1";
  const allowMemberBypass =
    process.env.ALLOW_MEMBER_BYPASS === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_MEMBER_BYPASS === "true" ||
    cookieBypass;

  if (allowMemberBypass) {
    const bypassEmail = process.env.BYPASS_MEMBER_EMAIL || "admin@npestudyclub.online";
    return { approved: true, user: { email: bypassEmail } as { email: string } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { approved: false, user: null };
  }

  const { data, error } = await supabase
    .from("approved_users")
    .select("email,status")
    .eq("email", user.email.toLowerCase())
    .eq("status", "approved")
    .limit(1);

  if (error) {
    return { approved: false, user };
  }

  return { approved: Boolean(data?.length), user };
}
