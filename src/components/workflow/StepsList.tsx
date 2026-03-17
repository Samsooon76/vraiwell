import { WorkflowAction } from "@/types/workflow";
import { ToolLogo } from "@/components/tools/ToolLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowUp,
    ArrowDown,
    Trash2,
    Settings,
    GripVertical,
    ArrowRight
} from "lucide-react";
import { getIntegrationLabel } from "@/config/workflowActions";

interface StepsListProps {
    steps: Array<{
        id: string;
        action: WorkflowAction;
        config: Record<string, unknown>;
    }>;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    onRemove: (index: number) => void;
    onEdit: (index: number) => void;
}

export function StepsList({
    steps,
    onMoveUp,
    onMoveDown,
    onRemove,
    onEdit,
}: StepsListProps) {
    if (steps.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                <p className="text-sm">Aucune action ajoutée</p>
                <p className="text-xs mt-1">Ajoutez des actions pour construire votre workflow</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                    {/* Step card */}
                    <div className="flex-1 flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <GripVertical className="h-4 w-4 cursor-grab" />
                            <span className="text-xs font-medium w-5">{index + 1}</span>
                        </div>

                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                            <ToolLogo
                                name={getIntegrationLabel(step.action.integration_id)}
                                size="sm"
                                className="h-4 w-4"
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                                {step.action.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {getIntegrationLabel(step.action.integration_id)}
                            </p>
                        </div>

                        {!step.action.is_active && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                Action indisponible
                            </Badge>
                        )}

                        {/* Config preview */}
                        {Object.keys(step.config).length > 0 && (
                            <div className="hidden sm:flex gap-1">
                                {Object.entries(step.config).slice(0, 2).map(([key, value]) => (
                                    <Badge key={key} variant="secondary" className="text-xs max-w-[100px] truncate">
                                        {String(value).startsWith('{{') ? String(value) : `${key}: ${value}`}
                                    </Badge>
                                ))}
                                {Object.keys(step.config).length > 2 && (
                                    <Badge variant="secondary" className="text-xs">
                                        +{Object.keys(step.config).length - 2}
                                    </Badge>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(index)}
                                className="h-8 w-8 p-0"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onMoveUp(index)}
                                disabled={index === 0}
                                className="h-8 w-8 p-0"
                            >
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onMoveDown(index)}
                                disabled={index === steps.length - 1}
                                className="h-8 w-8 p-0"
                            >
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemove(index)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Connector arrow */}
                    {index < steps.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 sm:hidden" />
                    )}
                </div>
            ))}

            {/* Visual flow for desktop */}
            <div className="hidden sm:flex items-center justify-center gap-2 pt-2 text-muted-foreground">
                {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {index + 1}
                        </div>
                        {index < steps.length - 1 && (
                            <ArrowRight className="h-4 w-4" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
