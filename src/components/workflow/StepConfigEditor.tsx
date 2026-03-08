import { WorkflowAction, JSONSchemaProperty } from "@/types/workflow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface StepConfigEditorProps {
    action: WorkflowAction;
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
    useVariables?: boolean;
    availableVariables?: string[];
}

export function StepConfigEditor({
    action,
    config,
    onChange,
    useVariables = true,
    availableVariables = ["firstName", "lastName", "personalEmail", "email"],
}: StepConfigEditorProps) {
    const schema = action.input_schema;

    if (!schema || !schema.properties) {
        return (
            <div className="text-center py-4 text-muted-foreground">
                <Info className="h-5 w-5 mx-auto mb-2" />
                <p className="text-sm">Cette action n'a pas de configuration</p>
            </div>
        );
    }

    const handleChange = (key: string, value: unknown) => {
        onChange({
            ...config,
            [key]: value,
        });
    };

    const renderVariableHint = (key: string) => {
        if (!useVariables) return null;

        // Check if this field matches a common variable
        const matchingVar = availableVariables.find(v =>
            v.toLowerCase() === key.toLowerCase() ||
            key.toLowerCase().includes(v.toLowerCase())
        );

        if (matchingVar) {
            return (
                <button
                    type="button"
                    onClick={() => handleChange(key, `{{${matchingVar}}}`)}
                    className="text-xs text-primary hover:underline"
                >
                    Utiliser {`{{${matchingVar}}}`}
                </button>
            );
        }
        return null;
    };

    const renderField = (key: string, property: JSONSchemaProperty) => {
        const value = config[key];
        const isRequired = schema.required?.includes(key);
        const isVariable = typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}');

        return (
            <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor={key} className="flex items-center gap-2">
                        {property.title || key}
                        {isRequired && <span className="text-destructive">*</span>}
                    </Label>
                    {isVariable && (
                        <Badge variant="secondary" className="text-xs">Variable</Badge>
                    )}
                </div>

                {property.type === "boolean" ? (
                    <Switch
                        id={key}
                        checked={Boolean(value)}
                        onCheckedChange={(checked) => handleChange(key, checked)}
                    />
                ) : property.enum ? (
                    <Select
                        value={String(value || "")}
                        onValueChange={(v) => handleChange(key, v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={`Sélectionner ${property.title || key}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {property.enum.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="space-y-1">
                        <Input
                            id={key}
                            type={property.format === "email" ? "email" : "text"}
                            placeholder={property.description || `Entrez ${property.title || key}`}
                            value={String(value || "")}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className={isVariable ? "font-mono text-primary" : ""}
                        />
                        {renderVariableHint(key)}
                    </div>
                )}

                {property.description && (
                    <p className="text-xs text-muted-foreground">{property.description}</p>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {useVariables && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                        <Info className="h-3 w-3 inline mr-1" />
                        Utilisez des variables comme <code className="bg-muted px-1 rounded">{"{{firstName}}"}</code> pour remplir automatiquement les champs lors de l'exécution.
                    </p>
                </div>
            )}

            {Object.entries(schema.properties).map(([key, property]) =>
                renderField(key, property as JSONSchemaProperty)
            )}
        </div>
    );
}
