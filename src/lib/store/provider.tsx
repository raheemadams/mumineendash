"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppState, Member, PaymentMethod, Role } from "./types";
import { loadAppState } from "@/lib/actions/bootstrap";
import { addMemberAction, updateMemberAction } from "@/lib/actions/members";
import { recordDonationAction } from "@/lib/actions/donations";
import { recordDuesPaymentAction } from "@/lib/actions/dues";
import { commitImportAction } from "@/lib/actions/import";
import { addDepositAction, reconcileDepositAction } from "@/lib/actions/deposits";
import { addPastoralNoteAction } from "@/lib/actions/pastoral";
import { setTransactionCategoryAction, setTransactionDescriptionAction } from "@/lib/actions/transactions";
import {
  createCategoryAction,
  renameCategoryAction,
  setCategoryKindAction,
  deleteCategoryAction,
} from "@/lib/actions/categories";
import type { NewMember, NewDonation, NewDeposit, NewPastoralNote } from "./action-types";
import type { NormalizedTxn } from "@/lib/engine/types";

export type { NewMember, NewDonation, NewDeposit, NewPastoralNote } from "./action-types";

export interface CurrentUser {
  fullName: string;
  email: string;
  officeLabel: string;
}

function emptyState(role: Role): AppState {
  return {
    currentRole: role,
    readNotificationIds: [],
    members: [],
    families: [],
    accounts: [],
    categories: [],
    ledgerCategories: [],
    donations: [],
    campaigns: [],
    events: [],
    duesPlans: [],
    duesPayments: [],
    ledger: [],
    deposits: [],
    pastoralNotes: [],
    audit: [],
  };
}

interface Store {
  state: AppState;
  hydrated: boolean;
  currentUser: CurrentUser;
  addMember: (data: NewMember) => Promise<Member>;
  updateMember: (id: string, patch: Partial<Member>) => Promise<void>;
  recordDonation: (data: NewDonation) => Promise<void>;
  recordDuesPayment: (planId: string, periodStart: string, method?: PaymentMethod) => Promise<void>;
  commitImport: (
    accountId: string,
    rows: { txn: NormalizedTxn; isDuplicate: boolean }[],
  ) => Promise<{ inserted: number; blocked: number }>;
  reconcileDeposit: (depositId: string, txnId: string) => Promise<void>;
  setTransactionCategory: (txnId: string, category: string | null) => Promise<void>;
  setTransactionDescription: (txnId: string, description: string) => Promise<void>;
  createCategory: (name: string, kind: string) => Promise<void>;
  renameCategory: (id: string, name: string) => Promise<void>;
  setCategoryKind: (id: string, kind: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addDeposit: (data: NewDeposit) => Promise<void>;
  addPastoralNote: (data: NewPastoralNote) => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (ids: string[]) => void;
  refresh: () => Promise<void>;
}

const StoreCtx = createContext<Store | null>(null);

/**
 * `initialRole`/`currentUser` come from the signed-in office account's real
 * role (resolved server-side in `(app)/layout.tsx` via getCurrentUser()) —
 * there's no client-side role switcher anymore. Each office logs in as
 * itself and sees its own dashboard.
 */
export function StoreProvider({
  children,
  initialRole,
  currentUser,
}: {
  children: React.ReactNode;
  initialRole: Role;
  currentUser: CurrentUser;
}) {
  const [state, setState] = useState<AppState>(() => emptyState(initialRole));
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const fresh = await loadAppState();
    setState((s) => ({ ...s, ...fresh }));
  }, []);

  useEffect(() => {
    refresh().finally(() => setHydrated(true));
  }, [refresh]);

  const addMember = useCallback<Store["addMember"]>(
    async (data) => {
      const member = await addMemberAction(data);
      await refresh();
      return member;
    },
    [refresh],
  );

  const updateMember = useCallback<Store["updateMember"]>(
    async (id, patch) => {
      await updateMemberAction(id, patch);
      await refresh();
    },
    [refresh],
  );

  const recordDonation = useCallback<Store["recordDonation"]>(
    async (data) => {
      await recordDonationAction(data);
      await refresh();
    },
    [refresh],
  );

  const recordDuesPayment = useCallback<Store["recordDuesPayment"]>(
    async (planId, periodStart, method = "CASH") => {
      await recordDuesPaymentAction(planId, periodStart, method);
      await refresh();
    },
    [refresh],
  );

  const commitImport = useCallback<Store["commitImport"]>(
    async (accountId, rows) => {
      const result = await commitImportAction(accountId, rows);
      await refresh();
      return result;
    },
    [refresh],
  );

  const reconcileDeposit = useCallback<Store["reconcileDeposit"]>(
    async (depositId, txnId) => {
      await reconcileDepositAction(depositId, txnId);
      await refresh();
    },
    [refresh],
  );

  const setTransactionCategory = useCallback<Store["setTransactionCategory"]>(
    async (txnId, category) => {
      // Optimistic: reflect the pick immediately, then persist.
      setState((s) => ({
        ...s,
        ledger: s.ledger.map((t) => (t.id === txnId ? { ...t, category } : t)),
      }));
      await setTransactionCategoryAction(txnId, category);
      await refresh();
    },
    [refresh],
  );

  const setTransactionDescription = useCallback<Store["setTransactionDescription"]>(
    async (txnId, description) => {
      setState((s) => ({
        ...s,
        ledger: s.ledger.map((t) => (t.id === txnId ? { ...t, description } : t)),
      }));
      await setTransactionDescriptionAction(txnId, description);
      await refresh();
    },
    [refresh],
  );

  const createCategory = useCallback<Store["createCategory"]>(
    async (name, kind) => {
      await createCategoryAction(name, kind);
      await refresh();
    },
    [refresh],
  );

  const renameCategory = useCallback<Store["renameCategory"]>(
    async (id, name) => {
      await renameCategoryAction(id, name);
      await refresh();
    },
    [refresh],
  );

  const setCategoryKind = useCallback<Store["setCategoryKind"]>(
    async (id, kind) => {
      await setCategoryKindAction(id, kind);
      await refresh();
    },
    [refresh],
  );

  const deleteCategory = useCallback<Store["deleteCategory"]>(
    async (id) => {
      await deleteCategoryAction(id);
      await refresh();
    },
    [refresh],
  );

  const addDeposit = useCallback<Store["addDeposit"]>(
    async (data) => {
      await addDepositAction(data);
      await refresh();
    },
    [refresh],
  );

  const addPastoralNote = useCallback<Store["addPastoralNote"]>(
    async (data) => {
      await addPastoralNoteAction(data);
      await refresh();
    },
    [refresh],
  );

  const markNotificationRead = useCallback<Store["markNotificationRead"]>((id) => {
    setState((s) => ({
      ...s,
      readNotificationIds: s.readNotificationIds.includes(id)
        ? s.readNotificationIds
        : [...s.readNotificationIds, id],
    }));
  }, []);

  const markAllNotificationsRead = useCallback<Store["markAllNotificationsRead"]>((ids) => {
    setState((s) => ({
      ...s,
      readNotificationIds: [...new Set([...s.readNotificationIds, ...ids])],
    }));
  }, []);

  const value = useMemo<Store>(
    () => ({
      state,
      hydrated,
      currentUser,
      addMember,
      updateMember,
      recordDonation,
      recordDuesPayment,
      commitImport,
      reconcileDeposit,
      setTransactionCategory,
      setTransactionDescription,
      createCategory,
      renameCategory,
      setCategoryKind,
      deleteCategory,
      addDeposit,
      addPastoralNote,
      markNotificationRead,
      markAllNotificationsRead,
      refresh,
    }),
    [
      state,
      hydrated,
      currentUser,
      addMember,
      updateMember,
      recordDonation,
      recordDuesPayment,
      commitImport,
      reconcileDeposit,
      setTransactionCategory,
      setTransactionDescription,
      createCategory,
      renameCategory,
      setCategoryKind,
      deleteCategory,
      addDeposit,
      addPastoralNote,
      markNotificationRead,
      markAllNotificationsRead,
      refresh,
    ],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
