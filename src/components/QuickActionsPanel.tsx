import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, Plus, Loader2 } from "lucide-react";

interface ActionItem {
  id: string;
  action_text: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by_name: string | null;
  created_at: string;
}

interface QuickActionsPanelProps {
  customerId: string;
  aiActionItems: string[];
}

export function QuickActionsPanel({ customerId, aiActionItems }: QuickActionsPanelProps) {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchActions();
  }, [customerId]);

  const fetchActions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('customer_action_items')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching actions:', error);
    } else {
      setActions(data || []);
    }
    setIsLoading(false);
  };

  const syncAIActions = async () => {
    if (aiActionItems.length === 0) return;
    
    setIsSyncing(true);
    
    // Get existing action texts
    const existingTexts = actions.map(a => a.action_text.toLowerCase().trim());
    
    // Filter new actions that don't exist yet
    const newActions = aiActionItems.filter(
      item => !existingTexts.includes(item.toLowerCase().trim())
    );

    if (newActions.length === 0) {
      toast.info('All action items already tracked');
      setIsSyncing(false);
      return;
    }

    const { error } = await supabase
      .from('customer_action_items')
      .insert(newActions.map(text => ({
        customer_id: customerId,
        action_text: text
      })));

    if (error) {
      console.error('Error syncing actions:', error);
      toast.error('Failed to add action items');
    } else {
      toast.success(`Added ${newActions.length} action item(s)`);
      fetchActions();
    }
    setIsSyncing(false);
  };

  const toggleAction = async (actionId: string, currentState: boolean) => {
    const { error } = await supabase
      .from('customer_action_items')
      .update({
        is_completed: !currentState,
        completed_at: !currentState ? new Date().toISOString() : null,
        completed_by: !currentState ? user?.id : null,
        completed_by_name: !currentState ? (user?.email?.split('@')[0] || 'Unknown') : null
      })
      .eq('id', actionId);

    if (error) {
      console.error('Error toggling action:', error);
      toast.error('Failed to update action');
    } else {
      fetchActions();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const pendingCount = actions.filter(a => !a.is_completed).length;
  const completedCount = actions.filter(a => a.is_completed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Zap className="h-4 w-4" />
          Quick Actions
          {pendingCount > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </h3>
        {aiActionItems.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={syncAIActions}
            disabled={isSyncing}
            className="h-7 text-xs gap-1"
          >
            {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add AI Items
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : actions.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-2">
            No action items tracked yet.
          </p>
          {aiActionItems.length > 0 && (
            <Button size="sm" variant="outline" onClick={syncAIActions} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              Add {aiActionItems.length} AI-detected item(s)
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {actions.map((action) => (
            <div
              key={action.id}
              className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                action.is_completed 
                  ? 'bg-muted/30 border-muted' 
                  : 'bg-background border-border'
              }`}
            >
              <Checkbox
                checked={action.is_completed}
                onCheckedChange={() => toggleAction(action.id, action.is_completed)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={action.is_completed ? 'line-through text-muted-foreground' : ''}>
                  {action.action_text}
                </p>
                {action.is_completed && action.completed_by_name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Completed by {action.completed_by_name} • {formatDate(action.completed_at!)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {completedCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {completedCount} of {actions.length} completed
        </p>
      )}
    </div>
  );
}
