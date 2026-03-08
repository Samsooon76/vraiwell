import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToolLogo } from "@/components/tools/ToolLogo";
import {
  Plus,
  Check,
  Settings,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Loader2
} from "lucide-react";
import { AddIntegrationModal } from "@/components/modals/AddIntegrationModal";
import { GoogleWorkspaceModal } from "@/components/modals/GoogleWorkspaceModal";
import { MicrosoftWorkspaceModal } from "@/components/modals/MicrosoftWorkspaceModal";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { useSlackAuth } from "@/hooks/useSlackAuth";
import { SlackWorkspaceModal } from "@/components/modals/SlackWorkspaceModal";
import { useNotionAuth } from "@/hooks/useNotionAuth";
import { NotionWorkspaceModal } from "@/components/modals/NotionWorkspaceModal";
import { useHubSpotAuth } from "@/hooks/useHubSpotAuth";
import { HubSpotWorkspaceModal } from "@/components/modals/HubSpotWorkspaceModal";
import { toast } from "sonner";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "connected" | "available" | "error";
  lastSync?: string;
  actions?: number;
}

const defaultIntegrations: Integration[] = [
  { id: "1", name: "Google Workspace", description: "Suite bureautique cloud", category: "Productivité", status: "available" },
  { id: "2", name: "Slack", description: "Communication d'équipe", category: "Communication", status: "available" },
  { id: "3", name: "HubSpot", description: "CRM et marketing", category: "CRM", status: "available" },
  { id: "4", name: "Notion", description: "Documentation collaborative", category: "Productivité", status: "available" },
  { id: "5", name: "Payfit", description: "Gestion de la paie", category: "RH", status: "available" },
  { id: "6", name: "GitHub", description: "Hébergement de code", category: "Développement", status: "available" },
  { id: "7", name: "Figma", description: "Design collaboratif", category: "Design", status: "available" },
  { id: "8", name: "Salesforce", description: "CRM enterprise", category: "CRM", status: "available" },
  { id: "9", name: "Microsoft 365", description: "Suite Microsoft", category: "Productivité", status: "available" },
  { id: "10", name: "Deel", description: "Paie internationale", category: "RH", status: "available" },
  { id: "11", name: "Asana", description: "Gestion de projet", category: "Productivité", status: "available" },
  { id: "12", name: "Trello", description: "Tableaux Kanban", category: "Productivité", status: "available" },
];

type FilterStatus = "all" | "connected" | "available";

export default function Integrations() {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [addIntegrationOpen, setAddIntegrationOpen] = useState(false);
  const [googleConfigOpen, setGoogleConfigOpen] = useState(false);
  const [microsoftConfigOpen, setMicrosoftConfigOpen] = useState(false);
  const [slackConfigOpen, setSlackConfigOpen] = useState(false);
  const [notionConfigOpen, setNotionConfigOpen] = useState(false);
  const [hubspotConfigOpen, setHubspotConfigOpen] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);

  const { connectGoogle, isConnecting: isConnectingGoogle, checkGoogleConnection } = useGoogleAuth();
  const { connectMicrosoft, isConnecting: isConnectingMicrosoft, checkMicrosoftConnection } = useMicrosoftAuth();
  const { hasToken: isSlackConnected } = useSlackAuth();
  const { hasToken: isNotionConnected } = useNotionAuth();
  const { hasToken: isHubSpotConnected } = useHubSpotAuth();

  // Check connection status on mount
  useEffect(() => {
    const checkConnections = async () => {
      // Get action counts from centralized registry (no DB call needed)
      const { getActionCountByIntegration } = await import('@/config/workflowActions');
      const actionCounts = getActionCountByIntegration();

      const isGoogleConnected = await checkGoogleConnection();
      if (isGoogleConnected) {
        setIntegrations(prev => prev.map(int =>
          int.name === "Google Workspace"
            ? { ...int, status: "connected" as const, lastSync: "Connecté", actions: actionCounts.google }
            : int
        ));
      }

      const isMicrosoftConnected = await checkMicrosoftConnection();
      if (isMicrosoftConnected) {
        setIntegrations(prev => prev.map(int =>
          int.name === "Microsoft 365"
            ? { ...int, status: "connected" as const, lastSync: "Connecté", actions: actionCounts.microsoft }
            : int
        ));
      }

      if (isSlackConnected) {
        setIntegrations(prev => prev.map(int =>
          int.name === "Slack"
            ? { ...int, status: "connected" as const, lastSync: "Connecté", actions: actionCounts.slack }
            : int
        ));
      }

      if (isNotionConnected) {
        setIntegrations(prev => prev.map(int =>
          int.name === "Notion"
            ? { ...int, status: "connected" as const, lastSync: "Connecté", actions: actionCounts.notion }
            : int
        ));
      }

      if (isHubSpotConnected) {
        setIntegrations(prev => prev.map(int =>
          int.name === "HubSpot"
            ? { ...int, status: "connected" as const, lastSync: "Connecté", actions: actionCounts.hubspot }
            : int
        ));
      }
    };
    checkConnections();
  }, [isSlackConnected, isNotionConnected, isHubSpotConnected]);

  const handleConnectGoogle = async () => {
    try {
      // Redirect back to integrations page after OAuth
      await connectGoogle("/dashboard/integrations");
    } catch (error) {
      toast.error("Erreur de connexion Google");
    }
  };

  const handleConnectMicrosoft = async () => {
    try {
      await connectMicrosoft("/dashboard/integrations");
    } catch (error) {
      toast.error("Erreur de connexion Microsoft");
    }
  };

  const filteredIntegrations = integrations.filter((integration) =>
    filter === "all" ? true :
      filter === "connected" ? integration.status === "connected" || integration.status === "error" :
        integration.status === "available"
  );

  const connectedCount = integrations.filter(i => i.status === "connected").length;
  const errorCount = integrations.filter(i => i.status === "error").length;

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-display-md text-foreground">Intégrations</h1>
          <p className="mt-1 text-body-md text-muted-foreground">
            Connectez vos outils SaaS pour automatiser vos workflows
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 flex flex-wrap gap-3"
        >
          <button
            onClick={() => setFilter("all")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${filter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
          >
            Toutes
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">
              {integrations.length}
            </span>
          </button>
          <button
            onClick={() => setFilter("connected")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${filter === "connected"
              ? "bg-success text-success-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
          >
            <Check className="h-4 w-4" />
            Connectées
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">
              {connectedCount}
            </span>
          </button>
          <button
            onClick={() => setFilter("available")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${filter === "available"
              ? "bg-secondary text-secondary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
          >
            <Plus className="h-4 w-4" />
            Disponibles
          </button>
          {errorCount > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
              <AlertCircle className="h-3 w-3" />
              {errorCount} erreur{errorCount > 1 ? 's' : ''}
            </Badge>
          )}
        </motion.div>

        {/* Integrations grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredIntegrations.map((integration, index) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
              className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover hover:border-primary/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <ToolLogo name={integration.name} size="lg" />
                  <div>
                    <h3 className="font-display font-semibold text-foreground">
                      {integration.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{integration.category}</p>
                  </div>
                </div>
                {integration.status === "connected" && (
                  <Badge className="bg-success/10 text-success border-0 gap-1">
                    <Check className="h-3 w-3" />
                    Connectée
                  </Badge>
                )}
                {integration.status === "error" && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Erreur
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                {integration.description}
              </p>

              {integration.status === "connected" && (
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 pb-4 border-b border-border">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    {integration.lastSync}
                  </span>
                  <span>{integration.actions} actions disponibles</span>
                </div>
              )}

              <div className="flex gap-2">
                {integration.status === "connected" && (
                  <>
                    <Button
                      variant="soft"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        if (integration.name === "Google Workspace") {
                          setGoogleConfigOpen(true);
                        } else if (integration.name === "Microsoft 365") {
                          setMicrosoftConfigOpen(true);
                        } else if (integration.name === "Slack") {
                          setSlackConfigOpen(true);
                        } else if (integration.name === "Notion") {
                          setNotionConfigOpen(true);
                        } else if (integration.name === "HubSpot") {
                          setHubspotConfigOpen(true);
                        }
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Configurer
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {integration.status === "available" && (
                  integration.name === "Google Workspace" ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={handleConnectGoogle}
                      disabled={isConnectingGoogle}
                    >
                      {isConnectingGoogle ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {isConnectingGoogle ? "Connexion..." : "Connecter"}
                    </Button>
                  ) : integration.name === "Microsoft 365" ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={handleConnectMicrosoft}
                      disabled={isConnectingMicrosoft}
                    >
                      {isConnectingMicrosoft ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {isConnectingMicrosoft ? "Connexion..." : "Connecter"}
                    </Button>
                  ) : integration.name === "Slack" ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSlackConfigOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Connecter
                    </Button>
                  ) : integration.name === "Notion" ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => setNotionConfigOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Connecter
                    </Button>
                  ) : integration.name === "HubSpot" ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => setHubspotConfigOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Connecter
                    </Button>
                  ) : (
                    <Button variant="outline" disabled size="sm" className="flex-1 opacity-50">
                      Bientôt
                    </Button>
                  )
                )}
                {integration.status === "error" && (
                  <Button variant="destructive" size="sm" className="flex-1">
                    <RefreshCw className="h-4 w-4" />
                    Reconnecter
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Request integration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center"
        >
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            Vous ne trouvez pas votre outil ?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Demandez une intégration personnalisée et nous la développerons pour vous.
          </p>
          <Button variant="outline" onClick={() => setAddIntegrationOpen(true)}>
            <Plus className="h-4 w-4" />
            Demander une intégration
          </Button>
        </motion.div>
      </div>

      <AddIntegrationModal open={addIntegrationOpen} onOpenChange={setAddIntegrationOpen} />
      <GoogleWorkspaceModal
        open={googleConfigOpen}
        onOpenChange={setGoogleConfigOpen}
        onDisconnect={() => {
          setIntegrations(prev => prev.map(int =>
            int.name === "Google Workspace"
              ? { ...int, status: "available" as const, lastSync: undefined, actions: undefined }
              : int
          ));
          toast.success("Google Workspace déconnecté");
        }}
      />
      <MicrosoftWorkspaceModal
        open={microsoftConfigOpen}
        onOpenChange={setMicrosoftConfigOpen}
        onDisconnect={() => {
          setIntegrations(prev => prev.map(int =>
            int.name === "Microsoft 365"
              ? { ...int, status: "available" as const, lastSync: undefined, actions: undefined }
              : int
          ));
          toast.success("Microsoft 365 déconnecté");
        }}
      />
      <SlackWorkspaceModal
        open={slackConfigOpen}
        onOpenChange={setSlackConfigOpen}
        onDisconnect={() => {
          setIntegrations(prev => prev.map(int =>
            int.name === "Slack"
              ? { ...int, status: "available" as const, lastSync: undefined, actions: undefined }
              : int
          ));
          toast.success("Slack déconnecté");
        }}
      />
      <NotionWorkspaceModal
        open={notionConfigOpen}
        onOpenChange={setNotionConfigOpen}
        onDisconnect={() => {
          setIntegrations(prev => prev.map(int =>
            int.name === "Notion"
              ? { ...int, status: "available" as const, lastSync: undefined, actions: undefined }
              : int
          ));
          toast.success("Notion déconnecté");
        }}
      />
      <HubSpotWorkspaceModal
        open={hubspotConfigOpen}
        onOpenChange={setHubspotConfigOpen}
        onDisconnect={() => {
          setIntegrations(prev => prev.map(int =>
            int.name === "HubSpot"
              ? { ...int, status: "available" as const, lastSync: undefined, actions: undefined }
              : int
          ));
          toast.success("HubSpot déconnecté");
        }}
      />
    </DashboardLayout>
  );
}
