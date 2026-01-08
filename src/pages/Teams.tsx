import { motion } from "framer-motion";
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Plus, 
  Search, 
  MoreHorizontal,
  Mail,
  UserPlus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  memberCount: number;
  lead?: string;
}

const mockTeams: Team[] = [
  { id: "1", name: "Engineering", description: "Équipe technique et développement", color: "#2563eb", memberCount: 45, lead: "Thomas Martin" },
  { id: "2", name: "Sales", description: "Équipe commerciale", color: "#f59e0b", memberCount: 32, lead: "Marie Dupont" },
  { id: "3", name: "Marketing", description: "Équipe marketing et communication", color: "#8b5cf6", memberCount: 28, lead: "Sophie Bernard" },
  { id: "4", name: "Product", description: "Équipe produit et design", color: "#0f766e", memberCount: 22, lead: "Lucas Petit" },
  { id: "5", name: "Finance", description: "Équipe finance et comptabilité", color: "#dc2626", memberCount: 12, lead: "Emma Leroy" },
  { id: "6", name: "HR", description: "Ressources humaines", color: "#ec4899", memberCount: 8, lead: "Julie Martin" },
];

export default function Teams() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTeams = mockTeams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMembers = mockTeams.reduce((sum, team) => sum + team.memberCount, 0);

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-display-md text-foreground">Équipes</h1>
            <p className="mt-1 text-body-md text-muted-foreground">
              Gérez vos équipes et leurs accès aux outils
            </p>
          </div>
          <Button variant="hero" size="lg">
            <Plus className="h-4 w-4" />
            Nouvelle équipe
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid gap-4 sm:grid-cols-3"
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{mockTeams.length}</p>
                <p className="text-sm text-muted-foreground">Équipes</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalMembers}</p>
                <p className="text-sm text-muted-foreground">Membres total</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">3</p>
                <p className="text-sm text-muted-foreground">Invitations en attente</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une équipe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Teams grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredTeams.map((team, index) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover hover:border-primary/20"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-semibold"
                    style={{ backgroundColor: team.color }}
                  >
                    {team.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{team.name}</h3>
                    <p className="text-xs text-muted-foreground">{team.memberCount} membres</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Modifier</DropdownMenuItem>
                    <DropdownMenuItem>Gérer les membres</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Supprimer</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {team.description}
              </p>

              {team.lead && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Lead: {team.lead}
                  </Badge>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border flex gap-2">
                <Button variant="soft" size="sm" className="flex-1">
                  <Users className="h-4 w-4" />
                  Voir membres
                </Button>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
