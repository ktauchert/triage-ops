import { handlers } from "@/auth";
import { withAuthRateLimit } from "@/lib/rate-limit/with-auth-handler";

export const GET = withAuthRateLimit(handlers.GET);
export const POST = withAuthRateLimit(handlers.POST);
