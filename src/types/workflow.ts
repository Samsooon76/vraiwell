// Workflow Types for scalable workflow system

export interface WorkflowAction {
    id: string;
    integration_id: string;
    action_key: string;
    name: string;
    description: string | null;
    icon: string | null;
    category: string | null;
    input_schema: JSONSchemaType;
    edge_function: string | null;
    is_active: boolean;
}

export interface WorkflowStep {
    id: string;
    workflow_id: string;
    action_id: string;
    step_order: number;
    config: Record<string, unknown>;
    action?: WorkflowAction;
}

export interface WorkflowVariable {
    id: string;
    workflow_id: string;
    name: string;
    label: string;
    type: 'string' | 'email' | 'select';
    required: boolean;
    options: string[] | null;
}

export interface Workflow {
    id: string;
    name: string;
    description: string | null;
    type: 'onboarding' | 'offboarding' | 'custom';
    is_active: boolean;
    created_at: string;
    updated_at: string;
    steps?: WorkflowStep[];
    variables?: WorkflowVariable[];
}

export interface WorkflowLog {
    id: string;
    workflow_id: string;
    step_id: string | null;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    input_data: Record<string, unknown> | null;
    output_data: Record<string, unknown> | null;
    error_message: string | null;
    executed_by: string;
    started_at: string;
    completed_at: string | null;
}

// JSON Schema types for input_schema field
export interface JSONSchemaProperty {
    type: 'string' | 'boolean' | 'number' | 'array' | 'object';
    title?: string;
    description?: string;
    format?: 'email' | 'uri' | 'date';
    default?: unknown;
    items?: JSONSchemaProperty;
    enum?: string[];
}

export interface JSONSchemaType {
    type: 'object';
    required?: string[];
    properties: Record<string, JSONSchemaProperty>;
}

// Integration status for action filtering
export interface IntegrationStatus {
    id: string;
    connected: boolean;
    providerToken?: string;
}

// Workflow execution context
export interface WorkflowExecutionContext {
    workflowId: string;
    variables: Record<string, string>;
    executedBy: string;
}
