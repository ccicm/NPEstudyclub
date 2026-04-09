import { type NextRequest } from "next/server";
import { generateUserCalendarIcs } from "@/lib/calendar-export";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const ics = await generateUserCalendarIcs({
    supabase,
    userId: user.id,
    origin,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="npe-study-plan.ics"',
      "Cache-Control": "no-store",
    },
  });
}
