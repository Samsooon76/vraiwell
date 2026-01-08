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
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
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
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  
  const { connectGoogle, isConnecting, checkGoogleConnection } = useGoogleAuth();

  // Check Google connection status on mount
  useEffect(() => {
    const checkConnections = async () => {
      const isGoogleConnected = await checkGoogleConnection();
      if (isGoogleConnected) {
        setIntegrations(prev => prev.map(int => 
          int.name === "Google Workspace" 
            ? { ...int, status: "connected" as const, lastSync: "Connecté", actions: 8 }
            : int
        ));
      }
    };
    checkConnections();
  }, []);

  const handleConnectGoogle = async () => {
    try {
      await connectGoogle();
    } catch (error) {
      toast.error("Erreur de connexion Google");
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
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === "all"
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
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === "connected"
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
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === "available"
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
                    <Button variant="soft" size="sm" className="flex-1">
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
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {isConnecting ? "Connexion..." : "Connecter"}
                    </Button>
                  ) : (
                    <Button variant="default" size="sm" className="flex-1" onClick={() => setAddIntegrationOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Connecter
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
    </DashboardLayout>
  );
}
