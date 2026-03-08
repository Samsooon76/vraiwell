import { WorkflowAction } from "@/types/workflow";
import { ToolLogo } from "@/components/tools/ToolLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Search, Lock } from "lucide-react";
import { useState, useMemo } from "react";

interface ActionSelectorProps {
    actions: WorkflowAction[];
    connectedIntegrations: Record<string, boolean>;
    selectedAction: WorkflowAction | null;
    onSelect: (action: WorkflowAction) => void;
}

const integrationLabels: Record<string, string> = {
    google: "Google Workspace",
    microsoft: "Microsoft 365",
    slack: "Slack",
    notion: "Notion",
    hubspot: "HubSpot",
};

const categoryLabels: Record<string, string> = {
    user_management: "Gestion utilisateurs",
    communication: "Communication",
    documentation: "Documentation",
    crm: "CRM",
};

export function ActionSelector({
    actions,
    connectedIntegrations,
    selectedAction,
    onSelect,
}: ActionSelectorProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

    // Get unique integrations from actions
    const integrations = useMemo(() => {
        const uniqueIntegrations = [...new Set(actions.map(a => a.integration_id))];
        return uniqueIntegrations.map(id => ({
            id,
            label: integrationLabels[id] || id,
            connected: connectedIntegrations[id] || false,
            actionsCount: actions.filter(a => a.integration_id === id).length,
        }));
    }, [actions, connectedIntegrations]);

    // Filter actions based on search and selected integration
    const filteredActions = useMemo(() => {
        let filtered = actions;

        if (selectedIntegration) {
            filtered = filtered.filter(a => a.integration_id === selectedIntegration);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                a =>
                    a.name.toLowerCase().includes(query) ||
                    a.description?.toLowerCase().includes(query) ||
                    integrationLabels[a.integration_id]?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [actions, selectedIntegration, searchQuery]);

    // Group filtered actions by integration
    const groupedActions = useMemo(() => {
        const groups: Record<string, WorkflowAction[]> = {};
        filteredActions.forEach(action => {
            if (!groups[action.integration_id]) {
                groups[action.integration_id] = [];
            }
            groups[action.integration_id].push(action);
        });
        return groups;
    }, [filteredActions]);

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Rechercher une action..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Integration filters */}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant={selectedIntegration === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedIntegration(null)}
                >
                    Toutes
                </Button>
                {integrations.map(integration => (
                    <Button
                        key={integration.id}
                        variant={selectedIntegration === integration.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedIntegration(integration.id)}
                        className="gap-2"
                    >
                        <ToolLogo name={integration.label} size="sm" className="h-4 w-4" />
                        {integration.label}
                        {!integration.connected && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                    </Button>
                ))}
            </div>

            {/* Actions list */}
            <div className="max-h-[400px] overflow-y-auto space-y-4">
                {Object.entries(groupedActions).map(([integrationId, integrationActions]) => {
                    const isConnected = connectedIntegrations[integrationId];

                    return (
                        <div key={integrationId} className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <ToolLogo name={integrationLabels[integrationId]} size="sm" className="h-4 w-4" />
                                {integrationLabels[integrationId]}
                                {!isConnected && (
                                    <Badge variant="outline" className="text-xs">Non connecté</Badge>
                                )}
                            </div>

                            <div className="grid gap-2">
                                {integrationActions.map(action => {
                                    const isSelected = selectedAction?.id === action.id;
                                    const isDisabled = !isConnected;

                                    return (
                                        <button
                                            key={action.id}
                                            onClick={() => !isDisabled && onSelect(action)}
                                            disabled={isDisabled}
                                            className={`
                        flex items-center gap-3 rounded-lg border p-3 text-left transition-all
                        ${isSelected
                                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                    : isDisabled
                                                        ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                                                        : "border-border hover:border-primary/50 hover:bg-accent"
                                                }
                      `}
                                        >
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                                                <ToolLogo name={integrationLabels[integrationId]} size="sm" className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-foreground truncate">
                                                    {action.name}
                                                </p>
                                                {action.description && (
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {action.description}
                                                    </p>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <Check className="h-4 w-4 text-primary shrink-0" />
                                            )}
                                            {isDisabled && (
                                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {filteredActions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>Aucune action trouvée</p>
                        {searchQuery && (
                            <p className="text-sm mt-1">Essayez une autre recherche</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
