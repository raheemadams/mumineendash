"use client";

import { useStore } from "@/lib/store/provider";
import { TreasurerDashboard } from "@/components/dashboards/treasurer-dashboard";
import { PresidentDashboard } from "@/components/dashboards/president-dashboard";
import { AdministratorDashboard } from "@/components/dashboards/administrator-dashboard";
import { ImamDashboard } from "@/components/dashboards/imam-dashboard";

export default function DashboardPage() {
  const { state } = useStore();

  switch (state.currentRole) {
    case "PRESIDENT":
      return <PresidentDashboard />;
    case "ADMINISTRATOR":
      return <AdministratorDashboard />;
    case "IMAM":
      return <ImamDashboard />;
    default:
      return <TreasurerDashboard />;
  }
}
