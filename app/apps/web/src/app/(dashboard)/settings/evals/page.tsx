import { adminOnlyOrRedirect } from "@/lib/admin-only";
import EvalsClient from "./evals-client";

export default async function EvalsPage() {
  await adminOnlyOrRedirect();
  return <EvalsClient />;
}
