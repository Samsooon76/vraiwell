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

export interface CreateOnOffMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  role?: "ROLE_USER" | "ROLE_ADMIN";
  departmentIdRefs?: string[];
}

export interface AssignOnOffNumberInput {
  phoneNumber: string;
  memberIdRef: string;
  numberId?: string;
  number?: OnOffNumber;
}

async function getCurrentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

function clearLegacyStoredApiKey() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ONOFF_API_KEY_STORAGE_KEY);
}

async function getStoredApiKey() {
  clearLegacyStoredApiKey();

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

function getNestedErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const directMessage = typeof record.message === "string" && record.message.trim()
    ? record.message.trim()
    : null;

  if (directMessage) {
    return directMessage;
  }

  const nestedError = record.error;
  if (nestedError && typeof nestedError === "object") {
    const errorRecord = nestedError as Record<string, unknown>;
    if (typeof errorRecord.message === "string" && errorRecord.message.trim()) {
      return errorRecord.message.trim();
    }
  }

  return null;
}

function getNestedErrorMetadata(value: unknown) {
  if (!value || typeof value !== "object") {
    return { code: null, sequenceNumber: null };
  }

  const record = value as Record<string, unknown>;
  const nestedError = record.error && typeof record.error === "object"
    ? record.error as Record<string, unknown>
    : null;

  return {
    code: typeof nestedError?.code === "string" && nestedError.code.trim()
      ? nestedError.code.trim()
      : null,
    sequenceNumber: typeof nestedError?.sequenceNumber === "string" && nestedError.sequenceNumber.trim()
      ? nestedError.sequenceNumber.trim()
      : null,
  };
}

function formatAttemptedQueries(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const meta = record.meta && typeof record.meta === "object"
    ? record.meta as Record<string, unknown>
    : null;
  const attemptedQueries = Array.isArray(meta?.attemptedQueries)
    ? meta.attemptedQueries
    : null;

  if (!attemptedQueries || attemptedQueries.length === 0) {
    return null;
  }

  const formattedQueries = attemptedQueries
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const query = entry as Record<string, unknown>;
      const countryCode = typeof query.countryCode === "string" && query.countryCode.trim()
        ? query.countryCode.trim()
        : "sans countryCode";
      const flags = [
        query.includeLimit === false ? "sans limit" : null,
        query.includeOffset === false ? "sans offset" : null,
      ].filter(Boolean).join(", ");

      return flags ? `${countryCode} (${flags})` : countryCode;
    })
    .filter((entry): entry is string => !!entry);

  return formattedQueries.length > 0
    ? formattedQueries.join(" -> ")
    : null;
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
          const detailsMessage = parsedBody && typeof parsedBody === "object" && "details" in parsedBody
            ? getNestedErrorMessage((parsedBody as Record<string, unknown>).details)
            : null;
          const detailsMetadata = parsedBody && typeof parsedBody === "object" && "details" in parsedBody
            ? getNestedErrorMetadata((parsedBody as Record<string, unknown>).details)
            : { code: null, sequenceNumber: null };
          const attemptedQueries = formatAttemptedQueries(parsedBody);
          const suffixParts = [
            detailsMetadata.code ? `code: ${detailsMetadata.code}` : null,
            detailsMetadata.sequenceNumber ? `trace: ${detailsMetadata.sequenceNumber}` : null,
            attemptedQueries ? `queries: ${attemptedQueries}` : null,
          ].filter(Boolean);

          if (detailsMessage && detailsMessage !== parsedMessage) {
            return suffixParts.length > 0
              ? `${parsedMessage} (${detailsMessage}; ${suffixParts.join(" | ")})`
              : `${parsedMessage} (${detailsMessage})`;
          }

          return suffixParts.length > 0
            ? `${parsedMessage} (${suffixParts.join(" | ")})`
            : parsedMessage;
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

export function useOnOffAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [isAssigningNumber, setIsAssigningNumber] = useState(false);
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
    clearLegacyStoredApiKey();
    void refreshOnOffConnection();

    const unsubscribeConnectionChanges = subscribeIntegrationConnectionChanges("onoff", () => {
      void refreshOnOffConnection();
    });

    return () => {
      unsubscribeConnectionChanges();
    };
  }, [refreshOnOffConnection]);

  useEffect(() => {
    let currentUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (nextUserId === currentUserId) {
        return;
      }

      currentUserId = nextUserId;
      setMembers([]);
      setNumbersByMember({});
      setWorkspaceInfo(null);
      setError(null);
      void refreshOnOffConnection();
    });

    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        currentUserId = user?.id ?? null;
      })
      .catch(() => {
        currentUserId = null;
      });

    return () => {
      subscription.unsubscribe();
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
      if (!userId) {
        throw new Error("Utilisateur non authentifié");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ onoff_api_key: apiKey.trim() })
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
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

  const fetchAvailableOnOffNumbers = useCallback(async (countryCode: string, apiKeyOverride?: string) => {
    const normalizedCountryCode = countryCode.trim().toLowerCase();
    const apiCountryCode = normalizedCountryCode.toUpperCase();
    const apiKey = apiKeyOverride ?? await getStoredApiKey();

    if (!apiKey) {
      setHasToken(false);
      return { success: false, error: "Clé API OnOff manquante" };
    }

    if (!normalizedCountryCode) {
      return { success: false, error: "Code pays OnOff manquant" };
    }

    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-onoff-member", {
        body: {
          action: "list_numbers",
          api_key: apiKey,
          status: "available",
          countryCode: apiCountryCode,
          limit: 100,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Impossible de récupérer les numéros disponibles OnOff");
      }

      const fetchedNumbers = ((data.numbers || []) as OnOffNumber[]).filter((number) => {
        const identifier = number.id?.trim() || number.phoneNumber?.trim();
        return !!identifier;
      }).map((number) => ({
        ...number,
        id: number.id?.trim() || number.phoneNumber.trim(),
      }));

      return {
        success: true,
        numbers: fetchedNumbers,
        meta: data.meta ?? null,
      };
    } catch (err: unknown) {
      const message = await getFunctionErrorMessage(err, "Impossible de récupérer les numéros disponibles OnOff");
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const createOnOffMember = useCallback(async ({
    firstName,
    lastName,
    email,
    role = "ROLE_USER",
    departmentIdRefs = [],
  }: CreateOnOffMemberInput) => {
    const apiKey = await getStoredApiKey();

    if (!apiKey) {
      setHasToken(false);
      return { success: false, error: "Clé API OnOff manquante" };
    }

    setIsCreatingMember(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-onoff-member", {
        body: {
          action: "create_member",
          api_key: apiKey,
          firstName,
          lastName,
          email,
          role,
          departmentIdRefs,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data?.success || !data?.member) {
        throw new Error(data?.error || "Impossible de créer le membre OnOff");
      }

      const createdMember = data.member as OnOffMember;

      setMembers((current) => {
        const withoutExistingMember = current.filter((member) => member.id !== createdMember.id);
        return [createdMember, ...withoutExistingMember];
      });
      setWorkspaceInfo((current) => current
        ? { ...current, totalMembers: current.totalMembers + 1 }
        : { name: "Onoff Business", totalMembers: 1, nextOffset: null },
      );

      return { success: true, member: createdMember };
    } catch (err: unknown) {
      const message = await getFunctionErrorMessage(err, "Impossible de créer le membre OnOff");
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsCreatingMember(false);
    }
  }, []);

  const assignOnOffNumber = useCallback(async ({
    phoneNumber,
    memberIdRef,
    numberId,
    number,
  }: AssignOnOffNumberInput) => {
    const apiKey = await getStoredApiKey();

    if (!apiKey) {
      setHasToken(false);
      return { success: false, error: "Clé API OnOff manquante" };
    }

    setIsAssigningNumber(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-onoff-member", {
        body: {
          action: "assign_number",
          api_key: apiKey,
          phoneNumber,
          memberIdRef,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Impossible d'attribuer le numéro OnOff");
      }

      const nextNumberId = numberId ?? number?.id ?? phoneNumber;

      setMembers((current) => current.map((member) => {
        if (member.id !== memberIdRef) {
          return member;
        }

        if (member.numberIdRefs.includes(nextNumberId)) {
          return member;
        }

        return {
          ...member,
          numberIdRefs: [...member.numberIdRefs, nextNumberId],
        };
      }));

      if (number) {
        setNumbersByMember((current) => {
          const memberNumbers = current[memberIdRef] || [];
          const filteredNumbers = memberNumbers.filter((item) => item.id !== number.id);

          return {
            ...current,
            [memberIdRef]: [
              ...filteredNumbers,
              { ...number, memberIdRef },
            ],
          };
        });
      }

      return { success: true };
    } catch (err: unknown) {
      const message = await getFunctionErrorMessage(err, "Impossible d'attribuer le numéro OnOff");
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsAssigningNumber(false);
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
      clearLegacyStoredApiKey();

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
    isCreatingMember,
    isAssigningNumber,
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
    fetchAvailableOnOffNumbers,
    createOnOffMember,
    assignOnOffNumber,
    deleteOnOffMember,
    disconnectOnOff,
    checkOnOffConnection,
  };
}
