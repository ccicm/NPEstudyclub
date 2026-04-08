export const COMMUNITY_CHANNELS = [
  {
    key: "announcements",
    name: "Announcements",
    description: "Admin updates and important notices",
    icon: "📢",
  },
  {
    key: "exam-prep",
    name: "Exam Prep",
    description: "NPE domains, strategy, and study questions",
    icon: "🧠",
  },
  {
    key: "clinical-practice",
    name: "Clinical Practice",
    description: "Cases, interventions, and supervision discussion",
    icon: "🏥",
  },
  {
    key: "ahpra-registration",
    name: "AHPRA & Registration",
    description: "Registration pathways and documentation help",
    icon: "📋",
  },
  {
    key: "resource-requests",
    name: "Resource Requests",
    description: "Ask for specific material from the group",
    icon: "📚",
  },
  {
    key: "general",
    name: "General",
    description: "Introductions and general discussion",
    icon: "💬",
  },
] as const;

export type CommunityChannelKey = (typeof COMMUNITY_CHANNELS)[number]["key"];

export const COMMUNITY_TAGS = ["Announcement", "Question", "Resource request", "General"] as const;

export function normalizeChannel(channel: string | null | undefined): CommunityChannelKey {
  const raw = (channel ?? "general").trim().toLowerCase();
  const match = COMMUNITY_CHANNELS.find((entry) => entry.key === raw);
  return match?.key ?? "general";
}
