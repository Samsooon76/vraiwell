import { motion } from "framer-motion";
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RequestItem, AccessRequest } from "@/components/requests/RequestItem";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, Filter } from "lucide-react";

const mockRequests: AccessRequest[] = [
  {
    id: "1",
    userName: "Marie Dupont",
    userEmail: "marie.dupont@example.com",
    toolName: "Figma",
    toolIcon: "🎨",
    status: "pending",
    requestedAt: "Il y a 2h",
    team: "Design",
  },
  {
    id: "2",
    userName: "Thomas Martin",
    userEmail: "thomas.martin@example.com",
    toolName: "GitHub",
    toolIcon: "🐙",
    status: "pending",
    requestedAt: "Il y a 4h",
    team: "Engineering",
  },
  {
    id: "3",
    userName: "Sophie Bernard",
    userEmail: "sophie.bernard@example.com",
    toolName: "Salesforce",
    toolIcon: "☁️",
    status: "pending",
    requestedAt: "Hier",
    team: "Sales",
  },
  {
    id: "4",
    userName: "Lucas Petit",
    userEmail: "lucas.petit@example.com",
    toolName: "Notion",
    toolIcon: "📝",
    status: "approved",
    requestedAt: "Il y a 2j",
    team: "Product",
  },
  {
    id: "5",
    userName: "Emma Leroy",
    userEmail: "emma.leroy@example.com",
    toolName: "Slack",
    toolIcon: "💬",
    status: "rejected",
    requestedAt: "Il y a 3j",
    team: "Marketing",
  },
];

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function Requests() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [requests, setRequests] = useState(mockRequests);

  const filteredRequests = requests.filter((r) => 
    filter === "all" ? true : r.status === filter
  );

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const approvedCount = requests.filter(r => r.status === "approved").length;
  const rejectedCount = requests.filter(r => r.status === "rejected").length;

  const handleApprove = (requestId: string) => {
    setRequests(prev => 
      prev.map(r => r.id === requestId ? { ...r, status: "approved" as const } : r)
    );
  };

  const handleReject = (requestId: string) => {
    setRequests(prev => 
      prev.map(r => r.id === requestId ? { ...r, status: "rejected" as const } : r)
    );
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-display-md text-foreground">Demandes d'accès</h1>
          <p className="mt-1 text-body-md text-muted-foreground">
            Gérez les demandes d'accès aux outils de votre équipe
          </p>
        </motion.div>

        {/* Stats pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex flex-wrap gap-3"
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
              {requests.length}
            </span>
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === "pending" 
                ? "bg-warning text-warning-foreground" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Clock className="h-4 w-4" />
            En attente
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">
              {pendingCount}
            </span>
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === "approved" 
                ? "bg-success text-success-foreground" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            Approuvées
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">
              {approvedCount}
            </span>
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === "rejected" 
                ? "bg-destructive text-destructive-foreground" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <XCircle className="h-4 w-4" />
            Refusées
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">
              {rejectedCount}
            </span>
          </button>
        </motion.div>

        {/* Request list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {filteredRequests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * index }}
            >
              <RequestItem
                request={request}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </motion.div>
          ))}
        </motion.div>

        {filteredRequests.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Filter className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Aucune demande
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Il n'y a pas de demandes correspondant à ce filtre
            </p>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
