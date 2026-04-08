import { createClient } from "@/lib/supabase/server";

export async function isApprovedMember() {
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
