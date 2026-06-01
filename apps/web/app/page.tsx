import { redirect } from "next/navigation";

export default function Home() {
  // Redirect root to chat interface
  redirect("/chat");
}
