import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Check, 
  Zap, 
  Shield, 
  BarChart3, 
  Users,
  Plug,
  Clock
} from "lucide-react";

const features = [
  {
    icon: Plug,
    title: "10+ intégrations",
    description: "Connectez vos outils SaaS en quelques clics. Google, Slack, HubSpot, Payfit et plus.",
  },
  {
    icon: Zap,
    title: "Onboarding automatisé",
    description: "Créez des workflows pour provisionner tous les accès en un clic lors d'une nouvelle arrivée.",
  },
  {
    icon: BarChart3,
    title: "Visibilité des dépenses",
    description: "Dashboard unifié pour suivre vos coûts par outil et par équipe en temps réel.",
  },
  {
    icon: Shield,
    title: "Offboarding sécurisé",
    description: "Supprimez tous les accès d'un collaborateur en un seul workflow automatisé.",
  },
  {
    icon: Users,
    title: "Gestion des équipes",
    description: "Organisez vos collaborateurs par équipe avec des droits d'accès personnalisés.",
  },
  {
    icon: Clock,
    title: "Demandes d'accès",
    description: "Catalogue d'outils avec workflow d'approbation simple et notifications temps réel.",
  },
];

const benefits = [
  "Divisez par 10 le temps d'onboarding",
  "Détectez les licences inutilisées",
  "Centralisez toutes vos dépenses SaaS",
  "Sécurisez les départs avec un offboarding complet",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <nav className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <span className="font-display text-lg font-bold text-primary-foreground">W</span>
            </div>
            <span className="font-display text-xl font-bold text-foreground">Well</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost">Connexion</Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="hero">
                Démarrer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground"
          >
            <Zap className="h-4 w-4" />
            Simplifiez la gestion de vos outils SaaS
          </motion.div>
          
          <h1 className="font-display text-display-xl md:text-6xl lg:text-7xl text-foreground mb-6">
            Un seul endroit pour{" "}
            <span className="text-gradient">gérer tous vos SaaS</span>
          </h1>
          
          <p className="text-body-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Centralisez l'onboarding, l'offboarding et la gestion des abonnements de votre stack SaaS. 
            Gagnez du temps, réduisez les coûts, sécurisez les accès.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/dashboard">
              <Button variant="hero" size="xl">
                Essayer gratuitement
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="xl">
              Voir une démo
            </Button>
          </motion.div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          >
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-success" />
                {benefit}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="font-display text-display-lg text-foreground mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-body-md text-muted-foreground">
              Une plateforme complète pour gérer le cycle de vie de vos outils SaaS
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * index }}
                className="group rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:shadow-card-hover hover:border-primary/20"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 md:p-16 text-center"
          >
            <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1)_0%,_transparent_70%)]" />
            <div className="relative">
              <h2 className="font-display text-display-lg md:text-display-xl text-primary-foreground mb-4">
                Prêt à simplifier votre gestion SaaS ?
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
                Rejoignez les équipes qui économisent des heures chaque semaine avec Well.
              </p>
              <Link to="/dashboard">
                <Button 
                  size="xl" 
                  className="bg-white text-primary hover:bg-white/90 shadow-xl"
                >
                  Commencer gratuitement
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-primary">
              <span className="font-display text-xs font-bold text-primary-foreground">W</span>
            </div>
            <span className="text-sm text-muted-foreground">
              © 2026 Well. Tous droits réservés.
            </span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-foreground transition-colors">Conditions</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
