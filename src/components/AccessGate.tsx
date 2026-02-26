import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const AccessGate = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          EDON Governance Console
        </p>
        <h1 className="text-2xl font-semibold mb-3">Access key required</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Sign in at edoncore.com to open this console with your access key automatically
          passed through — or enter your key manually below.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a href="https://edoncore.com/login">
            <Button className="w-full">Sign in on edoncore.com</Button>
          </a>
          <Link to="/settings" className="w-full">
            <Button variant="outline" className="w-full">
              Enter access key manually
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
