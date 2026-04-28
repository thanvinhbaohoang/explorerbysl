import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquare,
  Users,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Mail,
  Facebook,
} from "lucide-react";

const LOGO_URL =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/JGXcdgVLviR51uCzxJkKuQGR2dC2/uploads/1765063011262-explorerbysl.jpg";

const features = [
  {
    icon: MessageSquare,
    title: "Unified Customer Inbox",
    description:
      "Manage Facebook Messenger and Telegram conversations in one streamlined chat view.",
  },
  {
    icon: Users,
    title: "CRM & Customer Tracking",
    description:
      "Capture identity, notes, tags, and a full activity timeline for every customer.",
  },
  {
    icon: BarChart3,
    title: "Ads Insight",
    description:
      "Track Facebook ad performance and attribute leads back to the campaigns that drove them.",
  },
  {
    icon: ShieldCheck,
    title: "Team Roles & Permissions",
    description:
      "Granular role-based access control keeps the right tools in the right hands.",
  },
];

const Home = () => {
  useEffect(() => {
    const previous = document.title;
    document.title = "ExplorerBySL — Customer Communications Platform";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="w-full border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={LOGO_URL}
              alt="ExplorerBySL logo"
              className="h-8 w-8 rounded"
            />
            <span className="font-bold text-lg">ExplorerBySL</span>
          </Link>
          <Button asChild size="sm">
            <Link to="/auth">
              Launch App
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1">
        <div className="container mx-auto px-4 md:px-8 py-20 md:py-28 text-center max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Your Journey Imagination,
            <br />
            <span className="text-primary">Our Professional Creation.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            ExplorerBySL is the internal business management platform built by
            Explorer by SL to manage customer communications across Facebook
            Messenger and Telegram — all in one place.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link to="/auth">
                Launch App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
              <Link to="/privacy-policy">Privacy Policy</Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="container mx-auto px-4 md:px-8 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-2">
                <CardHeader>
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 Explorer by SL. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <a
              href="https://www.facebook.com/explorerbysl"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </a>
            <a
              href="mailto:stevenly@explorerbysl.com"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
