import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Plus, Trash2, Edit2, Check, X, Loader2 } from "lucide-react";

interface CustomerNote {
  id: string;
  note_text: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomerNotesSectionProps {
  customerId: string;
}

export function CustomerNotesSection({ customerId }: CustomerNotesSectionProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    fetchNotes();
  }, [customerId]);

  const fetchNotes = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('customer_notes')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    } else {
      setNotes(data || []);
    }
    setIsLoading(false);
  };

  const addNote = async () => {
    if (!newNoteText.trim()) return;
    
    setIsAdding(true);
    const { error } = await supabase
      .from('customer_notes')
      .insert({
        customer_id: customerId,
        note_text: newNoteText.trim(),
        created_by: user?.id,
        created_by_name: user?.email?.split('@')[0] || 'Unknown'
      });

    if (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } else {
      toast.success('Note added');
      setNewNoteText("");
      fetchNotes();
    }
    setIsAdding(false);
  };

  const updateNote = async (noteId: string) => {
    if (!editingText.trim()) return;
    
    const { error } = await supabase
      .from('customer_notes')
      .update({ note_text: editingText.trim() })
      .eq('id', noteId);

    if (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    } else {
      toast.success('Note updated');
      setEditingNoteId(null);
      setEditingText("");
      fetchNotes();
    }
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from('customer_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    } else {
      toast.success('Note deleted');
      fetchNotes();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <StickyNote className="h-4 w-4" />
        Customer Notes
      </h3>

      {/* Add new note */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a note about this customer..."
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          className="min-h-[60px] text-sm"
        />
        <Button 
          onClick={addNote} 
          size="sm" 
          disabled={!newNoteText.trim() || isAdding}
          className="shrink-0"
        >
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No notes yet. Add one above.
        </p>
      ) : (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} className="p-3 rounded-lg bg-muted/50 border text-sm">
              {editingNoteId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                    <Button size="sm" onClick={() => updateNote(note.id)}>
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{note.note_text}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      {note.created_by_name} • {formatDate(note.created_at)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditingText(note.note_text);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteNote(note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
