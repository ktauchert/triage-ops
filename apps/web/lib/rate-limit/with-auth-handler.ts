import type { NextRequest } from "next/server";
import { enforceAuthRateLimit } from "./enforce";

type AuthRouteHandler = (
  request: NextRequest,
  context: unknown,
) => Response | Promise<Response>;

export function withAuthRateLimit(handler: AuthRouteHandler): AuthRouteHandler {
  return async (request, context) => {
    const limited = await enforceAuthRateLimit(request);
    if (limited) {
      return limited;
    }

    return handler(request, context);
  };
}
