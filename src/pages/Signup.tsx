import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password.length < 6) {
      toast({
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fullName);

    if (error) {
      toast({
        title: "Erreur d'inscription",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Compte créé !",
        description: "Bienvenue sur Well, votre compte est prêt.",
      });
      navigate("/dashboard");
    }

    setIsLoading(false);
  };

  const features = [
    "10+ intégrations SaaS",
    "Onboarding automatisé",
    "Analytics en temps réel",
    "Support prioritaire",
  ];

  return (
    <div className="min-h-screen bg-gradient-hero flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
                <span className="font-display text-xl font-bold text-primary-foreground">W</span>
              </div>
              <span className="font-display text-2xl font-bold text-foreground">Well</span>
            </Link>
          </div>

          {/* Card */}
          <div className="bg-card rounded-2xl border border-border p-8 shadow-card">
            <div className="text-center mb-6">
              <h1 className="font-display text-display-sm text-foreground">Créer un compte</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Commencez à gérer vos outils SaaS en quelques minutes
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Jean Dupont"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email professionnel</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@entreprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer mon compte"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Déjà un compte ?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Se connecter
              </Link>
            </div>
          </div>

          {/* Features list - mobile */}
          <div className="mt-8 lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-success shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right side - Features */}
      <div className="hidden lg:flex flex-1 bg-gradient-primary items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-md text-primary-foreground"
        >
          <h2 className="font-display text-display-md mb-6">
            Gérez tous vos SaaS depuis un seul endroit
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Rejoignez les équipes qui économisent des heures chaque semaine avec Well.
          </p>
          <div className="space-y-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/20">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-lg">{feature}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
