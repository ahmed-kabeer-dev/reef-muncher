// Reef Muncher: entry point. Logged-in users (or guests) go to the menu, others to login.

import { redirect } from "next/navigation";
import { getCurrentSession } from "../lib/server/auth.js";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getCurrentSession();
  redirect(session ? "/menu" : "/login");
}