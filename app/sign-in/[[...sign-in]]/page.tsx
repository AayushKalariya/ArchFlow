import { SignIn } from "@clerk/nextjs";
import { BrainCircuit, Share2, FileText } from "lucide-react";

const features = [
  {
    icon: BrainCircuit,
    title: "AI Architecture Generation",
    description: "Describe your system, AI maps it to nodes and edges on a live canvas.",
  },
  {
    icon: Share2,
    title: "Real-time Collaboration",
    description: "Live cursors, presence indicators, and shared node editing across your team.",
  },
  {
    icon: FileText,
    title: "Instant Spec Generation",
    description: "Export a complete Markdown technical spec directly from the canvas graph.",
  },
];

export default function SignInPage() {
  return (
    <div className="min-h-screen flex bg-bg-base">
      <div className="hidden lg:flex lg:flex-1 flex-col px-16 py-10 border-r border-border-default">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-accent-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-bg-base">T</span>
          </div>
          <span className="text-base font-semibold text-text-primary tracking-tight">Thread</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-md">
          <h1 className="text-4xl font-bold text-text-primary leading-tight mb-5">
            Design systems at the speed of thought.
          </h1>
          <p className="text-text-secondary text-base leading-relaxed mb-10">
            Describe your architecture in plain English. Ghost AI maps it to a shared canvas your whole team can refine in real time.
          </p>

          <div className="space-y-7">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="size-9 rounded-xl bg-accent-primary-dim flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="size-4 text-accent-primary" />
                </div>
                <div>
                  <p className="text-text-primary text-sm font-semibold mb-1">{title}</p>
                  <p className="text-text-muted text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <SignIn />
      </div>
    </div>
  );
}
