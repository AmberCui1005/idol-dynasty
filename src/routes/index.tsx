import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/components/idol/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <App />;
}
