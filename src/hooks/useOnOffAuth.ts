import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  emitIntegrationConnectionChanged,
  subscribeIntegrationConnectionChanges,
} from "@/lib/integration-events";

const ONOFF_API_KEY_STORAGE_KEY = "onoff_api_key";

export interface OnOffMember {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string | null;
  role?: string | null;
  departmentIdRefs: string[];
  numberIdRefs: string[];
  isActive: boolean;
}

export interface OnOffWorkspaceInfo {
  name: string;
  totalMembers: number;
  nextOffset?: string | null;
}

export interface OnOffNumber {
  id: string;
  phoneNumber: string;
  countryCode?: string | null;
  memberIdRef?: string | null;
  expirationDate?: string | null;
  createdAt?: string | null;
  isLandline?: boolean | null;
}

async function getCurrentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

async function getStoredApiKey() {
  if (typeof window !== "undefined") {
    const localKey = window.localStorage.getItem(ONOFF_API_KEY_STORAGE_KEY);
    if (localKey) {
      return localKey;
    }
  }

  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("onoff_api_key")
    .eq("user_id", userId)
    .single();

  if (error) {
    return null;
  }

  return data?.onoff_api_key ?? null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (
    error
    && typeof error === "object"
    && "name" in error
    && error.name === "FunctionsHttpError"
    && "context" in error
    && error.context instanceof Response
  ) {
    const response = error.context;
    const body = await response.clone().text();

    if (body) {
      try {
        const parsedBody = JSON.parse(body);
        const parsedMessage = getErrorMessage(
          parsedBody && typeof parsedBody === "object" && "error" in parsedBody
            ? new Error(String(parsedBody.error))
            : parsedBody,
          fallback,
        );

        if (parsedMessage !== fallback) {
          return parsedMessage;
        }
      } catch {
        if (body.trim()) {
          return body;
        }
      }
    }

    if (response.status === 409) {
      return "OnOff refuse la suppression de ce membre tant qu'un numéro lui est encore rattaché.";
    }

    return `${fallback} (${response.status})`;
  }

  return getErrorMessage(error, fallback);
}

function persistApiKeyLocally(apiKey: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (apiKey) {
    window.localStorage.setItem(ONOFF_API_KEY_STORAGE_KEY, apiKey);
  } else {
    window.localStorage.removeItem(ONOFF_API_KEY_STORAGE_KEY);
  }
}

export function useOnOffAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [members, setMembers] = useState<OnOffMember[]>([]);
  const [numbersByMember, setNumbersByMember] = useState<Record<string, OnOffNumber[]>>({});
  const [workspaceInfo, setWorkspaceInfo] = useState<OnOffWorkspaceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMemberIds, setLoadingMemberIds] = useState<string[]>([]);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const refreshOnOffConnection = useCallback(async () => {
    const apiKey = await getStoredApiKey();
    const nextHasToken = !!apiKey;
    setHasToken(nextHasToken);
    return nextHasToken;
  }, []);

  useEffect(() => {
    void refreshOnOffConnection();

    const unsubscribeConnectionChanges = subscribeIntegrationConnectionChanges("onoff", () => {
      void refreshOnOffConnection();
    });

    return () => {
      unsubscribeConnectionChanges();
    };
  }, [refreshOnOffConnection]);

  const fetchOnOffMembers = useCallback(async (apiKeyOverride?: string) => {
    const apiKey = apiKeyOverride ?? await getStoredApiKey();
    if (!apiKey) {
      setHasToken(false);
      return { success: false, error: "Clé API OnOff manquante" };
    }

    setIsLoadingMembers(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("list-onoff-members", {
        body: { api_key: apiKey, limit: 100 },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Impossible de récupérer les membres OnOff");
      }

      const fetchedMembers = (data.members || []) as OnOffMember[];
      setMembers(fetchedMembers);
      setNumbersByMember((current) => {
        const next: Record<string, OnOffNumber[]> = {};
        fetchedMembers.forEach((member) => {
          if (current[member.id]) {
            next[member.id] = current[member.id];
          }
        });
        return next;
      });
      setWorkspaceInfo({
        name: "Onoff Business",
        totalMembers: data.meta?.total ?? fetchedMembers.length,
        nextOffset: data.meta?.nextOffset ?? null,
      });
      setHasToken(true);

      return { success: true, members: fetchedMembers };
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Impossible de récupérer les membres OnOff");
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  const setApiKey = useCallback(async (apiKey: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await fetchOnOffMembers(apiKey.trim());
      if (!result.success) {
        throw new Error(result.error);
      }

      const userId = await getCurrentUserId();
      persistApiKeyLocally(apiKey.trim());

      if (userId) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ onoff_api_key: apiKey.trim() })
          .eq("user_id", userId);

        if (updateError) {
          console.warn("Unable to persist OnOff API key in profile, using local storage fallback", updateError);
        }
      }

      setHasToken(true);
      emitIntegrationConnectionChanged("onoff");
      return { success: true };
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Impossible de vérifier la clé API OnOff");
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsConnecting(false);
    }
  }, [fetchOnOffMembers]);

  const fetchOnOffNumbers = useCallback(async (memberId: string, apiKeyOverride?: string) => {
    const apiKey = apiKeyOverride ?? await getStoredApiKey();
    if (!apiKey) {
      setHasToken(false);
      return { success: false, error: "Clé API OnOff manquante" };
    }

    setLoadingMemberIds((current) => current.includes(memberId) ? current : [...current, memberId]);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-onoff-member", {
        body: {
          action: "list_numbers",
          api_key: apiKey,
          memberId,
          status: "used",
          limit: 100,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Impossible de récupérer les numéros OnOff");
      }

      const fetchedNumbers = (data.numbers || []) as OnOffNumber[];
      setNumbersByMember((current) => ({
        ...current,
        [memberId]: fetchedNumbers,
      }));

      return { success: true, numbers: fetchedNumbers };
    } catch (err: unknown) {
      const message = await getFunctionErrorMessage(err, "Impossible de récupérer les numéros OnOff");
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoadingMemberIds((current) => current.filter((id) => id !== memberId));
    }
  }, []);

  const deleteOnOffMember = useCallback(async (memberId: string) => {
    const apiKey = await getStoredApiKey();
    if (!apiKey) {
      setHasToken(false);
      return { success: false, error: "Clé API OnOff manquante" };
    }

    setDeletingMemberId(memberId);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-onoff-member", {
        body: {
          action: "delete_member",
          api_key: apiKey,
          memberId,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Impossible de supprimer le membre OnOff");
      }

      setMembers((current) => current.filter((member) => member.id !== memberId));
      setNumbersByMember((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });
      setWorkspaceInfo((current) => current
        ? { ...current, totalMembers: Math.max(0, current.totalMembers - 1) }
        : current,
      );

      return { success: true };
    } catch (err: unknown) {
      const message = await getFunctionErrorMessage(err, "Impossible de supprimer le membre OnOff");
      setError(message);
      return { success: false, error: message };
    } finally {
      setDeletingMemberId(null);
    }
  }, []);

  const disconnectOnOff = useCallback(async () => {
    setIsDisconnecting(true);

    try {
      const userId = await getCurrentUserId();
      persistApiKeyLocally(null);

      if (userId) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ onoff_api_key: null })
          .eq("user_id", userId);

        if (updateError) {
          console.warn("Unable to remove OnOff API key from profile, local storage cleared", updateError);
        }
      }

      setHasToken(false);
      setMembers([]);
      setNumbersByMember({});
      setWorkspaceInfo(null);
      setError(null);
      emitIntegrationConnectionChanged("onoff");

      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err, "Impossible de déconnecter OnOff"),
      };
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  const checkOnOffConnection = useCallback(async () => {
    const apiKey = await getStoredApiKey();
    if (!apiKey) {
      setHasToken(false);
      return false;
    }

    const result = await fetchOnOffMembers(apiKey);
    return result.success;
  }, [fetchOnOffMembers]);

  return {
    isConnecting,
    isLoadingMembers,
    isDisconnecting,
    hasToken,
    members,
    numbersByMember,
    workspaceInfo,
    error,
    loadingMemberIds,
    deletingMemberId,
    setApiKey,
    fetchOnOffMembers,
    fetchOnOffNumbers,
    deleteOnOffMember,
    disconnectOnOff,
    checkOnOffConnection,
  };
}
