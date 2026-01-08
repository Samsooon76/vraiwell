import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { 
  User, 
  Building, 
  Bell, 
  Shield, 
  CreditCard,
  Mail,
  Globe,
  Palette
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  const sections = [
    {
      id: "profile",
      title: "Profil",
      icon: User,
      description: "Gérez vos informations personnelles",
    },
    {
      id: "organization",
      title: "Organisation",
      icon: Building,
      description: "Paramètres de votre entreprise",
    },
    {
      id: "notifications",
      title: "Notifications",
      icon: Bell,
      description: "Gérez vos préférences de notifications",
    },
    {
      id: "security",
      title: "Sécurité",
      icon: Shield,
      description: "Mot de passe et authentification",
    },
    {
      id: "billing",
      title: "Facturation",
      icon: CreditCard,
      description: "Gérez votre abonnement et vos factures",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-display-md text-foreground">Paramètres</h1>
          <p className="mt-1 text-body-md text-muted-foreground">
            Gérez les paramètres de votre compte et de votre organisation
          </p>
        </motion.div>

        <div className="space-y-8">
          {/* Profile Section */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">Profil</h2>
                <p className="text-sm text-muted-foreground">Informations personnelles</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input id="fullName" defaultValue={user?.user_metadata?.full_name || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle</Label>
                <Input id="role" defaultValue="Admin" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Fuseau horaire</Label>
                <Input id="timezone" defaultValue="Europe/Paris" />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="default">Enregistrer</Button>
            </div>
          </motion.section>

          {/* Organization Section */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">Organisation</h2>
                <p className="text-sm text-muted-foreground">Paramètres de votre entreprise</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nom de l'entreprise</Label>
                <Input id="companyName" defaultValue="Ma Startup" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Site web</Label>
                <Input id="website" defaultValue="https://mastartup.com" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" defaultValue="123 Rue de la Startup, 75001 Paris" />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="default">Enregistrer</Button>
            </div>
          </motion.section>

          {/* Notifications Section */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">Notifications</h2>
                <p className="text-sm text-muted-foreground">Préférences de notifications</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Notifications par email</p>
                    <p className="text-sm text-muted-foreground">Recevez des emails pour les demandes d'accès</p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Notifications push</p>
                    <p className="text-sm text-muted-foreground">Notifications dans le navigateur</p>
                  </div>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Résumé hebdomadaire</p>
                    <p className="text-sm text-muted-foreground">Rapport des activités de la semaine</p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </motion.section>

          {/* Appearance Section */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">Apparence</h2>
                <p className="text-sm text-muted-foreground">Personnalisez l'interface</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-foreground">Mode sombre</p>
                <p className="text-sm text-muted-foreground">Activer le thème sombre</p>
              </div>
              <Switch />
            </div>
          </motion.section>

          {/* Danger Zone */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-destructive/20 bg-destructive/5 p-6"
          >
            <h2 className="font-display text-lg font-semibold text-destructive mb-2">Zone dangereuse</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Ces actions sont irréversibles. Soyez prudent.
            </p>
            <Button variant="destructive">Supprimer mon compte</Button>
          </motion.section>
        </div>
      </div>
    </DashboardLayout>
  );
}
