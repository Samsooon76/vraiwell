import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ArrowRight, Building2, Users, Mail, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoogleAuth, GoogleUser } from "@/hooks/useGoogleAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useInvitations } from "@/hooks/useInvitations";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPendingOnboardingRedirect,
  markPendingOnboardingRedirect,
} from "@/lib/onboarding-state";
import { toast } from "sonner";

const steps = [
  { id: 1, name: "Organisation", description: "Informations sur votre entreprise" },
  { id: 2, name: "Intégrations", description: "Connectez vos outils" },
  { id: 3, name: "Équipe", description: "Invitez vos collaborateurs" },
];

interface UserToInvite extends GoogleUser {
  selectedRole: 'admin' | 'manager' | 'user';
  isInvited: boolean;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(parseInt(searchParams.get("step") || "1"));
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [inviteEmails, setInviteEmails] = useState("");
  const [emailRole, setEmailRole] = useState<'admin' | 'manager' | 'user'>('user');
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [usersToInvite, setUsersToInvite] = useState<UserToInvite[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);

  const {
    isConnecting,
    isLoadingUsers,
    googleUsers,
    connectGoogle,
    fetchGoogleUsers,
  } = useGoogleAuth();

  const { profile, completeOnboarding } = useUserProfile();
  const { createBulkInvitations, getInvitationLink, createInvitation } = useInvitations();

  // Redirect if onboarding is already completed
  useEffect(() => {
    if (profile?.onboarding_completed && !isCheckingAuth) {
      clearPendingOnboardingRedirect(profile.user_id);
      navigate("/dashboard", { replace: true });
    }

    // Pre-fill company info if already in profile
    if (profile && !companyName) {
      if (profile.company_name) setCompanyName(profile.company_name);
      if (profile.company_size) setCompanySize(profile.company_size);
    }
  }, [profile, isCheckingAuth, navigate]);

  // Sync currentStep with URL
  useEffect(() => {
    const step = parseInt(searchParams.get("step") || "1");
    if (step !== currentStep) {
      setCurrentStep(step);
    }
  }, [searchParams]);

  const updateStep = (newStep: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("step", newStep.toString());
    setSearchParams(params);
    setCurrentStep(newStep);
  };

  // Check if user signed up with Google and extract company info
  useEffect(() => {
    const checkAuthAndSetup = async () => {
      setIsCheckingAuth(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const googleIdentity = user.identities?.find(
          (identity) => identity.provider === "google"
        );

        if (googleIdentity) {
          setIsGoogleUser(true);
          setConnectedIntegrations(["Google Workspace"]);

          // Extract company name from email domain
          const email = user.email || "";
          const domain = email.split("@")[1];
          if (domain && !domain.includes("gmail.com") && !domain.includes("googlemail.com")) {
            const companyFromDomain = domain.split(".")[0];
            const formattedCompany = companyFromDomain.charAt(0).toUpperCase() + companyFromDomain.slice(1);
            setCompanyName(formattedCompany);
          }

          // Fetch Google users
          fetchGoogleUsers();

          // If redirected from Google connect, move to step 3
          if (searchParams.get("connected") === "google") {
            updateStep(3);
          }
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuthAndSetup();
  }, []);

  // Convert Google users to invitable users
  useEffect(() => {
    if (googleUsers.length > 0) {
      setUsersToInvite(
        googleUsers
          .filter(u => !u.isCurrentUser) // Exclude current user
          .map(u => ({
            ...u,
            selectedRole: 'user' as const,
            isInvited: false,
          }))
      );
    }
  }, [googleUsers]);

  const progress = (currentStep / steps.length) * 100;

  const finishOnboarding = async (showSuccessToast: boolean) => {
    if (isCompletingOnboarding) {
      return;
    }

    setIsCompletingOnboarding(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await completeOnboarding(companyName, companySize);
    if (error) {
      toast.error("Erreur lors de la finalisation : " + error);
      setIsCompletingOnboarding(false);
      return;
    }

    if (user?.id) {
      markPendingOnboardingRedirect(user.id);
    }

    if (showSuccessToast) {
      toast.success("Onboarding terminé !");
    }

    navigate("/dashboard", { replace: true });
  };

  const handleNext = async () => {
    if (currentStep < steps.length) {
      // Save data periodically
      if (currentStep === 1 && companyName) {
        setIsSaving(true);
        await supabase
          .from("profiles")
          .update({
            company_name: companyName,
            company_size: companySize
          })
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id);
        setIsSaving(false);
      }

      // If Google user, skip step 2 (integrations) since already connected
      if (currentStep === 1 && isGoogleUser) {
        updateStep(3);
      } else {
        updateStep(currentStep + 1);
      }
    } else {
      await finishOnboarding(true);
    }
  };

  const handleSkip = async () => {
    if (currentStep < steps.length) {
      if (currentStep === 1 && isGoogleUser) {
        updateStep(3);
      } else {
        updateStep(currentStep + 1);
      }
    } else {
      await finishOnboarding(false);
    }
  };

  const handleIntegrationClick = async (name: string) => {
    if (name === "Google Workspace") {
      if (connectedIntegrations.includes(name)) {
        fetchGoogleUsers();
      } else {
        await connectGoogle("/onboarding?step=2&connected=google");
      }
    } else if (name === "Microsoft 365") {
      toast.info("L'intégration Microsoft 365 sera bientôt disponible.");
    } else if (name === "Slack") {
      toast.info("L'intégration Slack sera bientôt disponible.");
    }
  };

  const handleRoleChange = (userId: string, role: 'admin' | 'manager' | 'user') => {
    setUsersToInvite(prev =>
      prev.map(u => u.id === userId ? { ...u, selectedRole: role } : u)
    );
  };

  const handleInviteUser = async (user: UserToInvite) => {
    setIsInviting(true);
    const { invitation, error } = await createInvitation({
      email: user.email,
      role: user.selectedRole,
    });

    if (error) {
      toast.error(`Erreur: ${error}`);
    } else if (invitation) {
      setUsersToInvite(prev =>
        prev.map(u => u.id === user.id ? { ...u, isInvited: true } : u)
      );
      toast.success(`Invitation envoyée à ${user.email}`);
    }
    setIsInviting(false);
  };

  const handleCopyLink = async (user: UserToInvite) => {
    // First create invitation if not already invited
    if (!user.isInvited) {
      const { invitation, error } = await createInvitation({
        email: user.email,
        role: user.selectedRole,
      });

      if (error) {
        toast.error(`Erreur: ${error}`);
        return;
      }

      if (invitation) {
        setUsersToInvite(prev =>
          prev.map(u => u.id === user.id ? { ...u, isInvited: true } : u)
        );

        const link = getInvitationLink(invitation.token);
        await navigator.clipboard.writeText(link);
        setCopiedToken(user.id);
        toast.success("Lien copié !");
        setTimeout(() => setCopiedToken(null), 2000);
      }
    }
  };

  const handleInviteFromEmails = async () => {
    const emails = inviteEmails
      .split(/[,\n]/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes("@"));

    if (emails.length === 0) {
      toast.error("Veuillez entrer au moins une adresse email valide.");
      return;
    }

    setIsInviting(true);
    const payloads = emails.map(email => ({ email, role: emailRole }));
    const result = await createBulkInvitations(payloads);

    if (result.success > 0) {
      toast.success(`${result.success} invitation(s) envoyée(s)`);
      setInviteEmails("");
    }
    if (result.errors.length > 0) {
      result.errors.forEach(err => toast.error(err));
    }
    setIsInviting(false);
  };

  const integrations = [
    {
      name: "Google Workspace",
      description: "Gmail, Drive, Calendar et plus",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      ),
    },
    {
      name: "Microsoft 365",
      description: "Outlook, Teams, OneDrive et plus",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24">
          <path fill="#F25022" d="M1 1h10v10H1z" />
          <path fill="#00A4EF" d="M1 13h10v10H1z" />
          <path fill="#7FBA00" d="M13 1h10v10H13z" />
          <path fill="#FFB900" d="M13 13h10v10H13z" />
        </svg>
      ),
    },
    {
      name: "Slack",
      description: "Synchronisez vos canaux et notifications",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24">
          <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
          <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
          <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.272 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.163 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" />
          <path fill="#ECB22E" d="M15.163 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.163 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zm0-1.272a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.521h-6.315z" />
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

  const roleLabels = {
    admin: "Admin",
    manager: "Manager",
    user: "Utilisateur",
  };

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
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentStep === step.id
                  ? "bg-accent text-accent-foreground"
                  : currentStep > step.id
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
                  }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${currentStep > step.id
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
                        autoComplete="organization"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Taille de l'équipe</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {companySizes.map((size) => (
                          <button
                            key={size.value}
                            onClick={() => setCompanySize(size.value)}
                            className={`p-3 rounded-lg border text-sm text-left transition-colors ${companySize === size.value
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
                    {integrations.map((integration) => {
                      const isConnected = connectedIntegrations.includes(integration.name);
                      const isGoogle = integration.name === "Google Workspace";
                      const isLoading = isGoogle && (isConnecting || isLoadingUsers);

                      return (
                        <button
                          key={integration.name}
                          onClick={() => handleIntegrationClick(integration.name)}
                          disabled={isLoading}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all disabled:opacity-50 ${isConnected
                            ? "border-primary bg-accent"
                            : "border-border hover:border-primary/50 hover:bg-accent/50"
                            }`}
                        >
                          <div className="flex-shrink-0">{integration.icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{integration.name}</p>
                            <p className="text-xs text-muted-foreground">{integration.description}</p>
                          </div>
                          {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : isConnected ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Connecter</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Show connected Google users */}
                  {googleUsers.length > 0 && (
                    <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
                      <p className="text-sm font-medium text-foreground mb-3">
                        Utilisateurs Google détectés
                      </p>
                      <div className="space-y-2">
                        {googleUsers.map((user) => (
                          <div key={user.id} className="flex items-center gap-3">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {user.name.charAt(0)}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {user.name}
                                {user.isCurrentUser && (
                                  <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                      {isGoogleUser
                        ? "Sélectionnez les membres à inviter et leur rôle."
                        : "Invitez vos collaborateurs par email."}
                    </p>
                  </div>

                  {isGoogleUser ? (
                    <div className="space-y-4">
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">Chargement des utilisateurs...</span>
                        </div>
                      ) : usersToInvite.length > 0 ? (
                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                          {usersToInvite.map((user) => (
                            <div
                              key={user.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${user.isInvited
                                ? "border-primary/50 bg-primary/5"
                                : "border-border bg-background hover:bg-accent/50"
                                }`}
                            >
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  className="h-10 w-10 rounded-full"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-sm font-medium text-primary">
                                    {user.name.charAt(0)}
                                  </span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {user.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              </div>

                              {user.isInvited ? (
                                <div className="flex items-center gap-2 text-primary">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-xs font-medium">Invité</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={user.selectedRole}
                                    onValueChange={(val) => handleRoleChange(user.id, val as 'admin' | 'manager' | 'user')}
                                  >
                                    <SelectTrigger className="w-[110px] h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="user">Utilisateur</SelectItem>
                                      <SelectItem value="manager">Manager</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => handleCopyLink(user)}
                                    disabled={isInviting}
                                  >
                                    {copiedToken === user.id ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>

                                  <Button
                                    size="sm"
                                    className="h-8"
                                    onClick={() => handleInviteUser(user)}
                                    disabled={isInviting}
                                  >
                                    Inviter
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Aucun autre utilisateur dans votre organisation</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground text-center mt-4">
                        {usersToInvite.filter(u => u.isInvited).length} invitation(s) envoyée(s)
                      </p>
                    </div>
                  ) : (
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

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor="role">Rôle par défaut</Label>
                          <Select value={emailRole} onValueChange={(val) => setEmailRole(val as 'admin' | 'manager' | 'user')}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Utilisateur</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleInviteFromEmails}
                          disabled={isInviting || !inviteEmails.trim()}
                          className="mt-6"
                        >
                          {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer"}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="mt-10 flex items-center justify-between">
              <Button variant="ghost" onClick={handleSkip} disabled={isCompletingOnboarding}>
                {currentStep === steps.length ? "Passer" : "Passer cette étape"}
              </Button>
              <Button onClick={handleNext} disabled={isSaving || isCompletingOnboarding}>
                {isSaving || isCompletingOnboarding ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  currentStep === steps.length ? "Terminer" : "Continuer"
                )}
                {!isSaving && !isCompletingOnboarding && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
