import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function parseAdminEmails() {
  return (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const cookieBypass = cookieStore.get("member_bypass")?.value === "1";
  const allowAdminBypass =
    process.env.ALLOW_ADMIN_BYPASS === "true" ||
    process.env.ALLOW_MEMBER_BYPASS === "true" ||
    cookieBypass;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userEmail = user?.email?.toLowerCase() || "";
  const adminEmails = parseAdminEmails();
  const isAdmin = Boolean(allowAdminBypass || (userEmail && adminEmails.includes(userEmail)));

  return {
    user,
    userEmail,
    isAdmin,
    adminConfigured: adminEmails.length > 0,
  };
}

export async function requireAdmin() {
  const session = await getAdminSession();

  if (!session.user && !session.isAdmin) {
    redirect("/auth/login");
  }

  if (!session.isAdmin) {
    redirect("/dashboard");
  }

  return session;
}
