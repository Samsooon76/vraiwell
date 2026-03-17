import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TeamMember {
    id: string;
    user_id: string;
    role: "lead" | "member";
    created_at: string;
    profile?: {
        id: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
    };
}

export interface Team {
    id: string;
    name: string;
    description: string | null;
    color: string;
    created_at: string;
    updated_at: string;
    members?: TeamMember[];
    memberCount?: number;
    lead?: string | null;
}

export function useTeams() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();

    const fetchTeams = useCallback(async () => {
        if (!user) return;

        setIsLoading(true);
        setError(null);

        try {
            // Fetch teams
            const { data: teamsData, error: teamsError } = await supabase
                .from("teams")
                .select("*")
                .order("created_at", { ascending: false });

            if (teamsError) throw teamsError;

            // Fetch all team members (without profile join since FK is to auth.users, not profiles)
            const { data: membersData, error: membersError } = await supabase
                .from("team_members")
                .select("id, team_id, user_id, role, created_at");

            if (membersError) throw membersError;

            // Get unique user IDs from members
            const userIds = [...new Set((membersData || []).map(m => m.user_id))];

            // Fetch profiles for these users
            let profilesMap: Record<string, { id: string; full_name: string | null; avatar_url: string | null }> = {};
            if (userIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from("profiles")
                    .select("id, full_name, avatar_url")
                    .in("id", userIds);

                if (profilesData) {
                    profilesMap = profilesData.reduce((acc, p) => {
                        acc[p.id] = p;
                        return acc;
                    }, {} as typeof profilesMap);
                }
            }

            // Map members to teams
            const teamsWithMembers = (teamsData || []).map((team) => {
                const teamMembers = (membersData || [])
                    .filter((m) => m.team_id === team.id)
                    .map((m) => ({
                        id: m.id,
                        user_id: m.user_id,
                        role: m.role as "lead" | "member",
                        created_at: m.created_at,
                        profile: profilesMap[m.user_id] ? {
                            id: profilesMap[m.user_id].id,
                            full_name: profilesMap[m.user_id].full_name,
                            email: null,
                            avatar_url: profilesMap[m.user_id].avatar_url,
                        } : undefined,
                    }));

                const lead = teamMembers.find((m) => m.role === "lead");

                return {
                    ...team,
                    members: teamMembers,
                    memberCount: teamMembers.length,
                    lead: lead?.profile?.full_name || null,
                };
            });

            setTeams(teamsWithMembers);
        } catch (err: any) {
            console.error("Error fetching teams:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    const createTeam = async (
        name: string,
        description: string,
        color: string
    ): Promise<{ success: boolean; team?: Team; error?: string }> => {
        if (!user) return { success: false, error: "Not authenticated" };

        try {
            // Avoid `insert().select()` here: the teams SELECT policy only allows
            // reading teams once the user is already a member.
            const teamId = crypto.randomUUID();
            const now = new Date().toISOString();

            const { error: teamError } = await supabase
                .from("teams")
                .insert({ id: teamId, name, description, color });

            if (teamError) throw teamError;

            // Add the creator as the team lead
            const { error: memberError } = await supabase
                .from("team_members")
                .insert({
                    team_id: teamId,
                    user_id: user.id,
                    role: "lead",
                });

            if (memberError) throw memberError;

            // Refresh teams list
            await fetchTeams();

            return {
                success: true,
                team: {
                    id: teamId,
                    name,
                    description,
                    color,
                    created_at: now,
                    updated_at: now,
                },
            };
        } catch (err: any) {
            console.error("Error creating team:", err);
            return { success: false, error: err.message };
        }
    };

    const updateTeam = async (
        id: string,
        updates: Partial<Pick<Team, "name" | "description" | "color">>
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase
                .from("teams")
                .update(updates)
                .eq("id", id);

            if (error) throw error;

            await fetchTeams();
            return { success: true };
        } catch (err: any) {
            console.error("Error updating team:", err);
            return { success: false, error: err.message };
        }
    };

    const deleteTeam = async (id: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase
                .from("teams")
                .delete()
                .eq("id", id);

            if (error) throw error;

            setTeams((prev) => prev.filter((t) => t.id !== id));
            return { success: true };
        } catch (err: any) {
            console.error("Error deleting team:", err);
            return { success: false, error: err.message };
        }
    };

    const addMember = async (
        teamId: string,
        userId: string,
        role: "lead" | "member" = "member"
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase
                .from("team_members")
                .insert({
                    team_id: teamId,
                    user_id: userId,
                    role,
                });

            if (error) throw error;

            await fetchTeams();
            return { success: true };
        } catch (err: any) {
            console.error("Error adding member:", err);
            return { success: false, error: err.message };
        }
    };

    const removeMember = async (
        teamId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase
                .from("team_members")
                .delete()
                .eq("team_id", teamId)
                .eq("user_id", userId);

            if (error) throw error;

            await fetchTeams();
            return { success: true };
        } catch (err: any) {
            console.error("Error removing member:", err);
            return { success: false, error: err.message };
        }
    };

    const updateMemberRole = async (
        teamId: string,
        userId: string,
        role: "lead" | "member"
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase
                .from("team_members")
                .update({ role })
                .eq("team_id", teamId)
                .eq("user_id", userId);

            if (error) throw error;

            await fetchTeams();
            return { success: true };
        } catch (err: any) {
            console.error("Error updating member role:", err);
            return { success: false, error: err.message };
        }
    };

    const getTeamById = (id: string): Team | undefined => {
        return teams.find((t) => t.id === id);
    };

    return {
        teams,
        isLoading,
        error,
        fetchTeams,
        createTeam,
        updateTeam,
        deleteTeam,
        addMember,
        removeMember,
        updateMemberRole,
        getTeamById,
    };
}
