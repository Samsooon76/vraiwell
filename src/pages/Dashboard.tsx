import { motion } from "framer-motion";
import { Search, Filter, Plus, LayoutGrid, Plug, CreditCard, Users } from "lucide-react";
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ToolCard, Tool } from "@/components/tools/ToolCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestToolModal } from "@/components/modals/RequestToolModal";
import { ToolDetailsModal } from "@/components/modals/ToolDetailsModal";
import { AccessRequestModal } from "@/components/modals/AccessRequestModal";

// Mock data
const mockTools: Tool[] = [
  {
    id: "1",
    name: "HubSpot",
    description: "CRM et marketing automation pour gérer vos prospects et clients.",
    icon: "🟠",
    category: "CRM",
    status: "active",
    seats: 50,
    usedSeats: 42,
    monthlySpend: 890,
  },
  {
    id: "2",
    name: "Slack",
    description: "Communication d'équipe et messagerie instantanée.",
    icon: "💬",
    category: "Communication",
    status: "active",
    seats: 100,
    usedSeats: 95,
    monthlySpend: 1250,
  },
  {
    id: "3",
    name: "Notion",
    description: "Documentation et gestion de projet collaborative.",
    icon: "📝",
    category: "Productivité",
    status: "active",
    seats: 80,
    usedSeats: 72,
    monthlySpend: 640,
  },
  {
    id: "4",
    name: "GitHub",
    description: "Hébergement de code source et collaboration développeur.",
    icon: "🐙",
    category: "Développement",
    status: "available",
  },
  {
    id: "5",
    name: "Figma",
    description: "Design collaboratif et prototypage.",
    icon: "🎨",
    category: "Design",
    status: "pending",
  },
  {
    id: "6",
    name: "Salesforce",
    description: "CRM enterprise pour grandes équipes commerciales.",
    icon: "☁️",
    category: "CRM",
    status: "available",
  },
  {
    id: "7",
    name: "Payfit",
    description: "Gestion de la paie et des RH simplifiée.",
    icon: "💰",
    category: "RH",
    status: "active",
    seats: 300,
    usedSeats: 285,
    monthlySpend: 2100,
  },
  {
    id: "8",
    name: "Asana",
    description: "Gestion de projet et suivi des tâches d'équipe.",
    icon: "🎯",
    category: "Productivité",
    status: "available",
  },
];

const categories = ["Tous", "CRM", "Communication", "Productivité", "Développement", "Design", "RH"];

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [requestToolOpen, setRequestToolOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [accessRequestOpen, setAccessRequestOpen] = useState(false);

  const filteredTools = mockTools.filter((tool) => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Tous" || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const activeTools = mockTools.filter(t => t.status === "active");
  const totalSpend = activeTools.reduce((sum, t) => sum + (t.monthlySpend || 0), 0);
  const totalSeats = activeTools.reduce((sum, t) => sum + (t.seats || 0), 0);
  const usedSeats = activeTools.reduce((sum, t) => sum + (t.usedSeats || 0), 0);

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-display-md text-foreground">Bibliothèque</h1>
          <p className="mt-1 text-body-md text-muted-foreground">
            Gérez vos outils SaaS et demandez de nouveaux accès
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatsCard
            title="Outils actifs"
            value={activeTools.length}
            subtitle={`sur ${mockTools.length} disponibles`}
            icon={Plug}
            variant="primary"
          />
          <StatsCard
            title="Dépenses mensuelles"
            value={`€${totalSpend.toLocaleString()}`}
            icon={CreditCard}
            trend={{ value: 12, isPositive: false }}
          />
          <StatsCard
            title="Licences utilisées"
            value={`${usedSeats}/${totalSeats}`}
            subtitle={`${Math.round((usedSeats / totalSeats) * 100)}% d'utilisation`}
            icon={Users}
            variant="success"
          />
          <StatsCard
            title="Intégrations"
            value={12}
            subtitle="connectées"
            icon={LayoutGrid}
          />
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-1 gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un outil..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="default">
              <Filter className="h-4 w-4" />
              Filtres
            </Button>
          </div>
          <Button variant="hero" size="lg" onClick={() => setRequestToolOpen(true)}>
            <Plus className="h-4 w-4" />
            Demander un outil
          </Button>
        </motion.div>

        {/* Category tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6 flex gap-2 overflow-x-auto pb-2"
        >
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="shrink-0"
            >
              {category}
            </Button>
          ))}
        </motion.div>

        {/* Tools grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filteredTools.map((tool, index) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <ToolCard
                tool={tool}
                onRequestAccess={(id) => {
                  const t = mockTools.find(t => t.id === id);
                  if (t) {
                    setSelectedTool(t);
                    setAccessRequestOpen(true);
                  }
                }}
                onOpenTool={(id) => {
                  const t = mockTools.find(t => t.id === id);
                  if (t) {
                    setSelectedTool(t);
                    setDetailsOpen(true);
                  }
                }}
              />
            </motion.div>
          ))}
        </motion.div>

        {filteredTools.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Aucun outil trouvé
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Essayez de modifier vos critères de recherche
            </p>
          </motion.div>
        )}
      </div>
      
      <RequestToolModal open={requestToolOpen} onOpenChange={setRequestToolOpen} />
      <ToolDetailsModal 
        tool={selectedTool} 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen}
        onRequestAccess={(id) => {
          setDetailsOpen(false);
          const t = mockTools.find(t => t.id === id);
          if (t) {
            setSelectedTool(t);
            setAccessRequestOpen(true);
          }
        }}
      />
      <AccessRequestModal 
        tool={selectedTool} 
        open={accessRequestOpen} 
        onOpenChange={setAccessRequestOpen} 
      />
    </DashboardLayout>
  );
}
