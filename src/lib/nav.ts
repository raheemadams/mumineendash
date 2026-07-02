import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  Receipt,
  Landmark,
  Upload,
  BookOpenCheck,
  Banknote,
  ScrollText,
  FileBarChart,
  ShieldCheck,
  Tags,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: string;
  badge?: string;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },

  { href: "/members", label: "Members", icon: Users, group: "Community" },
  { href: "/donations", label: "Donations", icon: HeartHandshake, group: "Community" },
  { href: "/dues", label: "Membership Dues", icon: Receipt, group: "Community" },

  { href: "/accounts", label: "Accounts", icon: Landmark, group: "Finance" },
  { href: "/import", label: "Import Statements", icon: Upload, group: "Finance" },
  { href: "/transactions", label: "Ledger", icon: ScrollText, group: "Finance" },
  { href: "/deposits", label: "Cash Deposits", icon: Banknote, group: "Finance" },
  { href: "/reconciliation", label: "Reconciliation", icon: BookOpenCheck, group: "Finance" },

  { href: "/reports", label: "Reports", icon: FileBarChart, group: "Governance" },
  { href: "/categories", label: "Categories", icon: Tags, group: "Governance" },
  { href: "/audit", label: "Audit Log", icon: ShieldCheck, group: "Governance" },
];

export const navGroups = ["Overview", "Community", "Finance", "Governance"];
