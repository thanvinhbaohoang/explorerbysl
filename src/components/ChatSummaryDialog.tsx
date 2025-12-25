import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, User, Plane, Briefcase, MessageSquare, Paperclip, RefreshCw, Loader2 } from "lucide-react";

interface ChatSummary {
  personalInfo: {
    fullName: string | null;
    nationality: string | null;
    passportPhotoDetected: boolean;
    contactDetails: string | null;
  };
  travelDetails: {
    destinations: string[];
    travelDates: string | null;
    numberOfTravelers: string | null;
    purposeOfTravel: string | null;
  };
  serviceRequirements: {
    visaType: string | null;
    servicesRequested: string[];
    specialRequirements: string[];
    budgetIndication: string | null;
  };
  conversationStatus: {
    keyQuestions: string[];
    unansweredQuestions: string[];
    actionItems: string[];
    sentiment: 'positive' | 'neutral' | 'concerned';
  };
  attachments: {
    photoCount: number;
    voiceMessageCount: number;
    videoCount: number;
  };
  summary: string;
}

interface ChatSummaryDialogProps {
  customerId: string;
  linkedCustomerIds: string[];
  customerName: string;
}

export function ChatSummaryDialog({ customerId, linkedCustomerIds, customerName }: ChatSummaryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('summarize-chat', {
        body: { 
          customerId,
          linkedCustomerIds: linkedCustomerIds.length > 0 ? linkedCustomerIds : [customerId]
        }
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary);
    } catch (err: any) {
      console.error('Error fetching summary:', err);
      const message = err.message || 'Failed to generate summary';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && !summary) {
      fetchSummary();
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'concerned': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI Summary</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Chat Summary - {customerName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing conversation...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchSummary} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Overall Summary */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-sm">{summary.summary}</p>
            </div>

            {/* Sentiment Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Customer sentiment:</span>
              <Badge className={getSentimentColor(summary.conversationStatus.sentiment)}>
                {summary.conversationStatus.sentiment.charAt(0).toUpperCase() + summary.conversationStatus.sentiment.slice(1)}
              </Badge>
            </div>

            {/* Personal Info */}
            <Section 
              icon={<User className="h-4 w-4" />} 
              title="Personal Information"
            >
              <InfoGrid>
                <InfoItem label="Full Name" value={summary.personalInfo.fullName} />
                <InfoItem label="Nationality" value={summary.personalInfo.nationality} />
                <InfoItem label="Contact" value={summary.personalInfo.contactDetails} />
                <InfoItem 
                  label="Passport Photo" 
                  value={summary.personalInfo.passportPhotoDetected ? "Detected" : "Not detected"}
                  highlight={summary.personalInfo.passportPhotoDetected}
                />
              </InfoGrid>
            </Section>

            {/* Travel Details */}
            <Section 
              icon={<Plane className="h-4 w-4" />} 
              title="Travel Details"
            >
              <InfoGrid>
                <InfoItem 
                  label="Destinations" 
                  value={summary.travelDetails.destinations.length > 0 ? summary.travelDetails.destinations.join(', ') : null} 
                />
                <InfoItem label="Travel Dates" value={summary.travelDetails.travelDates} />
                <InfoItem label="Travelers" value={summary.travelDetails.numberOfTravelers} />
                <InfoItem label="Purpose" value={summary.travelDetails.purposeOfTravel} />
              </InfoGrid>
            </Section>

            {/* Service Requirements */}
            <Section 
              icon={<Briefcase className="h-4 w-4" />} 
              title="Service Requirements"
            >
              <InfoGrid>
                <InfoItem label="Visa Type" value={summary.serviceRequirements.visaType} />
                <InfoItem label="Budget" value={summary.serviceRequirements.budgetIndication} />
                <InfoItem 
                  label="Services" 
                  value={summary.serviceRequirements.servicesRequested.length > 0 ? summary.serviceRequirements.servicesRequested.join(', ') : null}
                  fullWidth 
                />
                <InfoItem 
                  label="Special Requirements" 
                  value={summary.serviceRequirements.specialRequirements.length > 0 ? summary.serviceRequirements.specialRequirements.join(', ') : null}
                  fullWidth 
                />
              </InfoGrid>
            </Section>

            {/* Conversation Status */}
            <Section 
              icon={<MessageSquare className="h-4 w-4" />} 
              title="Conversation Status"
            >
              <div className="space-y-3">
                {summary.conversationStatus.keyQuestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Key Questions</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {summary.conversationStatus.keyQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.conversationStatus.unansweredQuestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-destructive mb-1">Unanswered Questions</p>
                    <ul className="list-disc list-inside text-sm space-y-1 text-destructive">
                      {summary.conversationStatus.unansweredQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.conversationStatus.actionItems.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-primary mb-1">Action Items</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {summary.conversationStatus.actionItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.conversationStatus.keyQuestions.length === 0 && 
                 summary.conversationStatus.unansweredQuestions.length === 0 && 
                 summary.conversationStatus.actionItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No specific action items identified.</p>
                )}
              </div>
            </Section>

            {/* Attachments */}
            <Section 
              icon={<Paperclip className="h-4 w-4" />} 
              title="Attachments"
            >
              <div className="flex gap-4 text-sm">
                <span>{summary.attachments.photoCount} photos</span>
                <span>{summary.attachments.voiceMessageCount} voice messages</span>
                <span>{summary.attachments.videoCount} videos</span>
              </div>
            </Section>

            {/* Refresh button */}
            <div className="pt-2 border-t">
              <Button onClick={fetchSummary} variant="ghost" size="sm" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Summary
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <div className="pl-6">
        {children}
      </div>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>;
}

function InfoItem({ label, value, fullWidth, highlight }: { label: string; value: string | null; fullWidth?: boolean; highlight?: boolean }) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${highlight ? 'text-green-600 font-medium' : value ? '' : 'text-muted-foreground italic'}`}>
        {value || 'Not mentioned'}
      </p>
    </div>
  );
}
