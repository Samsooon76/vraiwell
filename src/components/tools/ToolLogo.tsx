import { cn } from "@/lib/utils";

interface ToolLogoProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const toolLogos: Record<string, { bg: string; text: string; icon?: string }> = {
  hubspot: { bg: "#ff7a59", text: "white", icon: "H" },
  slack: { bg: "#4A154B", text: "white", icon: "S" },
  notion: { bg: "#000000", text: "white", icon: "N" },
  github: { bg: "#24292f", text: "white", icon: "G" },
  figma: { bg: "#f24e1e", text: "white", icon: "F" },
  salesforce: { bg: "#00a1e0", text: "white", icon: "S" },
  payfit: { bg: "#0066ff", text: "white", icon: "P" },
  asana: { bg: "#f06a6a", text: "white", icon: "A" },
  "google workspace": { bg: "#4285f4", text: "white", icon: "G" },
  google: { bg: "#4285f4", text: "white", icon: "G" },
  "microsoft 365": { bg: "#0078d4", text: "white", icon: "M" },
  microsoft: { bg: "#0078d4", text: "white", icon: "M" },
  trello: { bg: "#0079bf", text: "white", icon: "T" },
  deel: { bg: "#15357a", text: "white", icon: "D" },
  linear: { bg: "#5e6ad2", text: "white", icon: "L" },
  jira: { bg: "#0052cc", text: "white", icon: "J" },
  confluence: { bg: "#0052cc", text: "white", icon: "C" },
  zoom: { bg: "#2d8cff", text: "white", icon: "Z" },
  intercom: { bg: "#1f8ded", text: "white", icon: "I" },
  zendesk: { bg: "#03363d", text: "white", icon: "Z" },
  stripe: { bg: "#635bff", text: "white", icon: "S" },
  dropbox: { bg: "#0061ff", text: "white", icon: "D" },
  airtable: { bg: "#fcb400", text: "black", icon: "A" },
  monday: { bg: "#ff3d57", text: "white", icon: "M" },
  clickup: { bg: "#7b68ee", text: "white", icon: "C" },
  miro: { bg: "#ffd02f", text: "black", icon: "M" },
  loom: { bg: "#625df5", text: "white", icon: "L" },
  calendly: { bg: "#006bff", text: "white", icon: "C" },
  lucca: { bg: "#ff6b35", text: "white", icon: "L" },
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function ToolLogo({ name, size = "md", className }: ToolLogoProps) {
  const normalizedName = name.toLowerCase();
  const config = toolLogos[normalizedName] || {
    bg: "#6b7280",
    text: "white",
    icon: name.charAt(0).toUpperCase(),
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl font-semibold",
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      {config.icon || name.charAt(0).toUpperCase()}
    </div>
  );
}
