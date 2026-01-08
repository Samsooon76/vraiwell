import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, Building2, Users, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const steps = [
  { id: 1, name: "Organisation", description: "Informations sur votre entreprise" },
  { id: 2, name: "Intégrations", description: "Connectez vos outils" },
  { id: 3, name: "Équipe", description: "Invitez vos collaborateurs" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [inviteEmails, setInviteEmails] = useState("");

  const progress = (currentStep / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate("/dashboard");
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate("/dashboard");
    }
  };

  const toggleIntegration = (name: string) => {
    setConnectedIntegrations((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  const integrations = [
    {
      name: "Google Workspace",
      description: "Gmail, Drive, Calendar et plus",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
    },
    {
      name: "Microsoft 365",
      description: "Outlook, Teams, OneDrive et plus",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24">
          <path fill="#F25022" d="M1 1h10v10H1z"/>
          <path fill="#00A4EF" d="M1 13h10v10H1z"/>
          <path fill="#7FBA00" d="M13 1h10v10H13z"/>
          <path fill="#FFB900" d="M13 13h10v10H13z"/>
        </svg>
      ),
    },
    {
      name: "Slack",
      description: "Synchronisez vos canaux et notifications",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24">
          <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
          <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
          <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.272 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.163 0a2.528 2.528 0 0 1 2.521 2.522v6.312z"/>
          <path fill="#ECB22E" d="M15.163 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.163 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zm0-1.272a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.521h-6.315z"/>
        </svg>
      ),
    },
  ];

  const companySizes = [
    { value: "1-10", label: "1-10 employés" },
    { value: "11-50", label: "11-50 employés" },
    { value: "51-200", label: "51-200 employés" },
    { value: "201-500", label: "201-500 employés" },
    { value: "500+", label: "500+ employés" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - Progress */}
      <div className="hidden lg:flex lg:w-80 flex-col border-r border-border bg-muted/30 p-8">
        <div className="flex items-center gap-2 mb-12">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="font-display text-base font-semibold text-primary-foreground">W</span>
          </div>
          <span className="font-display text-lg font-semibold text-foreground">Well</span>
        </div>

        <div className="flex-1">
          <h2 className="text-sm font-medium text-muted-foreground mb-6">Configuration</h2>
          <nav className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  currentStep === step.id
                    ? "bg-accent text-accent-foreground"
                    : currentStep > step.id
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    currentStep > step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-3.5 w-3.5" /> : step.id}
                </div>
                <div>
                  <p className="text-sm font-medium">{step.name}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Besoin d'aide ? <a href="#" className="text-primary hover:underline">Contactez-nous</a>
          </p>
        </div>
      </div>

      {/* Right panel - Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile progress */}
        <div className="lg:hidden p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Étape {currentStep} sur {steps.length}</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-lg">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-accent text-accent-foreground mb-4">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <h1 className="font-display text-display-md text-foreground mb-2">
                      Parlez-nous de votre organisation
                    </h1>
                    <p className="text-body-md text-muted-foreground">
                      Ces informations nous aident à personnaliser votre expérience.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="company">Nom de l'entreprise</Label>
                      <Input
                        id="company"
                        placeholder="Acme Inc."
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Taille de l'équipe</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {companySizes.map((size) => (
                          <button
                            key={size.value}
                            onClick={() => setCompanySize(size.value)}
                            className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                              companySize === size.value
                                ? "border-primary bg-accent text-accent-foreground"
                                : "border-border hover:border-primary/50 hover:bg-accent/50"
                            }`}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-accent text-accent-foreground mb-4">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <h1 className="font-display text-display-md text-foreground mb-2">
                      Connectez vos outils
                    </h1>
                    <p className="text-body-md text-muted-foreground">
                      Synchronisez vos utilisateurs et données existantes pour démarrer rapidement.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {integrations.map((integration) => (
                      <button
                        key={integration.name}
                        onClick={() => toggleIntegration(integration.name)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                          connectedIntegrations.includes(integration.name)
                            ? "border-primary bg-accent"
                            : "border-border hover:border-primary/50 hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex-shrink-0">{integration.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{integration.name}</p>
                          <p className="text-xs text-muted-foreground">{integration.description}</p>
                        </div>
                        {connectedIntegrations.includes(integration.name) ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Connecter</span>
                        )}
                      </button>
                    ))}
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground text-center">
                    Vous pourrez ajouter d'autres intégrations plus tard dans les paramètres.
                  </p>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-accent text-accent-foreground mb-4">
                      <Users className="h-6 w-6" />
                    </div>
                    <h1 className="font-display text-display-md text-foreground mb-2">
                      Invitez votre équipe
                    </h1>
                    <p className="text-body-md text-muted-foreground">
                      Collaborez avec vos collègues dès le départ.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="emails">Adresses email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <textarea
                          id="emails"
                          placeholder="email@exemple.com, autre@exemple.com"
                          value={inviteEmails}
                          onChange={(e) => setInviteEmails(e.target.value)}
                          className="w-full min-h-[120px] pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Séparez les adresses par des virgules ou des retours à la ligne.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="mt-10 flex items-center justify-between">
              <Button variant="ghost" onClick={handleSkip}>
                {currentStep === steps.length ? "Passer" : "Passer cette étape"}
              </Button>
              <Button onClick={handleNext}>
                {currentStep === steps.length ? "Terminer" : "Continuer"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}