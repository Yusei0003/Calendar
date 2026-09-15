import { redirect } from "next/navigation";

import { getActorId, isSignedIn } from "@/lib/auth";

export default async function Home() {
  redirect((await isSignedIn()) && (await getActorId()) ? "/calendar" : "/login");
}
