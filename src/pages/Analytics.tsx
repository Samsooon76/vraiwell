import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { 
  CreditCard, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Empty initial state - data will come from database
const spendData: { month: string; spend: number }[] = [];
const toolSpendData: { name: string; spend: number; color: string }[] = [];
const teamSpendData: { team: string; spend: number; seats: number }[] = [];

const COLORS = ["#0f766e", "#2563eb", "#f59e0b", "#8b5cf6"];

export default function Analytics() {
  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-display-md text-foreground">Analytics</h1>
          <p className="mt-1 text-body-md text-muted-foreground">
            Suivez vos dépenses SaaS et l'utilisation des licences
          </p>
        </motion.div>

        {/* Top stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatsCard
            title="Dépenses totales"
            value="€0"
            subtitle="ce mois"
            icon={CreditCard}
            variant="primary"
          />
          <StatsCard
            title="Économies potentielles"
            value="€0"
            subtitle="licences inutilisées"
            icon={TrendingUp}
            variant="warning"
          />
          <StatsCard
            title="Taux d'utilisation"
            value="0%"
            subtitle="aucune donnée"
            icon={Users}
            variant="success"
          />
          <StatsCard
            title="Alertes"
            value="0"
            subtitle="licences à optimiser"
            icon={AlertTriangle}
          />
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Spend trend chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Évolution des dépenses
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendData}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `€${v}`} />
                  <Tooltip 
                    formatter={(value: number) => [`€${value}`, "Dépenses"]}
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="spend" 
                    stroke="#0f766e" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorSpend)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Spend by tool */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Dépenses par outil
            </h3>
            <div className="flex items-center gap-8">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={toolSpendData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="spend"
                    >
                      {toolSpendData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {toolSpendData.map((tool) => (
                  <div key={tool.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: tool.color }}
                      />
                      <span className="text-sm font-medium text-foreground">{tool.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">€{tool.spend}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Spend by team */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Dépenses par équipe
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamSpendData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" stroke="#6b7280" fontSize={12} tickFormatter={(v) => `€${v}`} />
                  <YAxis type="category" dataKey="team" stroke="#6b7280" fontSize={12} width={100} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === "spend" ? `€${value}` : value,
                      name === "spend" ? "Dépenses" : "Licences"
                    ]}
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}
                  />
                  <Bar dataKey="spend" fill="#0f766e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
