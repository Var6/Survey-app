import { redirect } from "next/navigation";

// The proxy normally redirects "/" already; this is a fallback.
export default function Home() {
  redirect("/login");
}
