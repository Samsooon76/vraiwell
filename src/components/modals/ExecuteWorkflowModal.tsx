import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkflowVariable } from "@/types/workflow";
import { useWorkflows } from "@/hooks/useWorkflows";
import { toast } from "sonner";

interface ExecuteWorkflowModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workflowId: string;
}

export function ExecuteWorkflowModal({
    open,
    onOpenChange,
    workflowId,
}: ExecuteWorkflowModalProps) {
    const [variables, setVariables] = useState<WorkflowVariable[]>([]);
    const [values, setValues] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isExecuting, setIsExecuting] = useState(false);
    const { executeWorkflow } = useWorkflows();

    // Fetch workflow variables
    useEffect(() => {
        if (!open || !workflowId) return;

        const fetchVariables = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await (supabase as any)
                    .from('workflow_variables')
                    .select('*')
                    .eq('workflow_id', workflowId)
                    .order('name', { ascending: true });

                if (error) throw error;

                setVariables(data || []);

                // Initialize values
                const initialValues: Record<string, string> = {};
                (data || []).forEach((v: any) => {
                    initialValues[v.name] = '';
                });
                setValues(initialValues);
            } catch (err) {
                console.error('Error fetching variables:', err);
                toast.error('Erreur lors du chargement des variables');
            } finally {
                setIsLoading(false);
            }
        };

        fetchVariables();
    }, [open, workflowId]);

    const handleValueChange = (name: string, value: string) => {
        setValues(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleExecute = async () => {
        // Validate required fields
        const missingRequired = variables
            .filter(v => v.required && !values[v.name]?.trim())
            .map(v => v.label);

        if (missingRequired.length > 0) {
            toast.error(`Champs requis manquants: ${missingRequired.join(', ')}`);
            return;
        }

        setIsExecuting(true);
        try {
            const success = await executeWorkflow(workflowId, values);
            if (success) {
                onOpenChange(false);
            }
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl flex items-center gap-2">
                        <Play className="h-5 w-5 text-primary" />
                        Exécuter le workflow
                    </DialogTitle>
                    <DialogDescription>
                        Remplissez les informations nécessaires pour lancer ce workflow.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : variables.length === 0 ? (
                    <div className="py-6">
                        <div className="rounded-lg border bg-muted/30 p-4 text-center">
                            <Info className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Ce workflow ne nécessite aucune variable. Il est prêt à être exécuté.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground">
                                <Info className="h-3 w-3 inline mr-1" />
                                Ces informations seront utilisées pour remplir les champs du workflow automatiquement.
                            </p>
                        </div>

                        {variables.map(variable => (
                            <div key={variable.id} className="space-y-2">
                                <Label htmlFor={variable.name} className="flex items-center gap-2">
                                    {variable.label}
                                    {variable.required && <span className="text-destructive">*</span>}
                                </Label>
                                <Input
                                    id={variable.name}
                                    type={variable.type === 'email' ? 'email' : 'text'}
                                    placeholder={`Entrez ${variable.label.toLowerCase()}`}
                                    value={values[variable.name] || ''}
                                    onChange={(e) => handleValueChange(variable.name, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExecuting}>
                        Annuler
                    </Button>
                    <Button onClick={handleExecute} disabled={isLoading || isExecuting}>
                        {isExecuting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Exécution...
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4 mr-2" />
                                Exécuter
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
