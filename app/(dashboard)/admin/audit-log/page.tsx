import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActivityLogs, getActivityLogFilterOptions } from "@/app/actions/audit-log";
import { AuditLogClient } from "./audit-log-client";

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const [logsRes, optionsRes] = await Promise.all([
    getActivityLogs({ page: 1 }),
    getActivityLogFilterOptions(),
  ]);

  const initial = logsRes.success && logsRes.data
    ? logsRes.data
    : { logs: [], total: 0, page: 1, pageSize: 50, timezone: "Asia/Jakarta" };
  const options = optionsRes.success && optionsRes.data
    ? optionsRes.data
    : { users: [], entityTypes: [], actions: [] };

  return <AuditLogClient initial={initial} options={options} />;
}
