import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  next: z.string().max(200).optional(),
});

export const requestLoginLink = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof requestSchema>) => requestSchema.parse(data))
  .handler(async ({ data }) => {
    const { sendLoginLink } = await import("./login-link.server");
    return sendLoginLink(data.email, data.next);
  });
