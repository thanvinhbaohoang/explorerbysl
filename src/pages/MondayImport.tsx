import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Download, Loader2, RefreshCw } from "lucide-react";

interface Board {
  id: string;
  name: string;
  description?: string;
  items_count?: number;
}

interface Column {
  id: string;
  title: string;
  type: string;
}

interface ColumnValue {
  id: string;
  text: string;
  value: string;
  type: string;
}

interface Item {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  column_values: ColumnValue[];
}

// Customer table fields that can be mapped
const customerFields = [
  { id: 'skip', label: '(Skip this column)', required: false },
  { id: 'first_name', label: 'First Name', required: false },
  { id: 'last_name', label: 'Last Name', required: false },
  { id: 'username', label: 'Username', required: false },
  { id: 'telegram_id', label: 'Telegram ID', required: false },
  { id: 'messenger_id', label: 'Messenger ID', required: false },
  { id: 'messenger_name', label: 'Messenger Name', required: false },
  { id: 'language_code', label: 'Language Code', required: false },
  { id: 'locale', label: 'Locale', required: false },
];

const MondayImport = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update'>('skip');

  // Fetch boards from Monday.com
  const fetchBoards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('monday-import', {
        body: { action: 'get_boards' }
      });

      if (error) throw error;
      
      if (data?.data?.boards) {
        setBoards(data.data.boards);
        toast.success(`Found ${data.data.boards.length} boards`);
      } else {
        toast.error('No boards found');
      }
    } catch (error: any) {
      console.error('Error fetching boards:', error);
      toast.error(error.message || 'Failed to fetch boards');
    } finally {
      setLoading(false);
    }
  };

  // Fetch columns for selected board
  const fetchColumns = async () => {
    if (!selectedBoard) {
      toast.error('Please select a board first');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('monday-import', {
        body: { action: 'get_board_columns', boardId: selectedBoard }
      });

      if (error) throw error;
      
      if (data?.data?.boards?.[0]?.columns) {
        const boardColumns = data.data.boards[0].columns;
        setColumns(boardColumns);
        
        // Initialize mappings with 'skip' for all columns
        const initialMappings: Record<string, string> = {};
        boardColumns.forEach((col: Column) => {
          initialMappings[col.id] = 'skip';
        });
        setColumnMappings(initialMappings);
        
        setStep(2);
        toast.success(`Found ${boardColumns.length} columns`);
      }
    } catch (error: any) {
      console.error('Error fetching columns:', error);
      toast.error(error.message || 'Failed to fetch columns');
    } finally {
      setLoading(false);
    }
  };

  // Fetch items for preview
  const fetchItems = async () => {
    if (!selectedBoard) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('monday-import', {
        body: { action: 'get_board_items', boardId: selectedBoard }
      });

      if (error) throw error;
      
      if (data?.data?.boards?.[0]?.items_page?.items) {
        setItems(data.data.boards[0].items_page.items);
        setStep(3);
        toast.success(`Loaded ${data.data.boards[0].items_page.items.length} items for preview`);
      }
    } catch (error: any) {
      console.error('Error fetching items:', error);
      toast.error(error.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  // Map an item to customer format based on mappings
  const mapItemToCustomer = (item: Item) => {
    const customer: Record<string, any> = {};
    
    // The item name is often the primary identifier in Monday
    // Check if any mapping uses "name" which refers to the item name
    
    columns.forEach((column) => {
      const mapping = columnMappings[column.id];
      if (mapping && mapping !== 'skip') {
        const columnValue = item.column_values.find(cv => cv.id === column.id);
        if (columnValue?.text) {
          if (mapping === 'telegram_id') {
            const parsed = parseInt(columnValue.text, 10);
            if (!isNaN(parsed)) {
              customer[mapping] = parsed;
            }
          } else {
            customer[mapping] = columnValue.text;
          }
        }
      }
    });

    return customer;
  };

  // Import items to customer table
  const importItems = async () => {
    setImporting(true);
    setImportProgress(0);
    
    const results = { imported: 0, skipped: 0, failed: 0 };

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const customerData = mapItemToCustomer(item);
        
        // Skip if no data was mapped
        if (Object.keys(customerData).length === 0) {
          results.skipped++;
          continue;
        }

        try {
          // Check for existing customer by username or telegram_id
          let existingCustomer = null;
          
          if (customerData.username) {
            const { data } = await supabase
              .from('customer')
              .select('id')
              .eq('username', customerData.username)
              .maybeSingle();
            existingCustomer = data;
          } else if (customerData.telegram_id) {
            const { data } = await supabase
              .from('customer')
              .select('id')
              .eq('telegram_id', customerData.telegram_id)
              .maybeSingle();
            existingCustomer = data;
          }

          if (existingCustomer) {
            if (duplicateHandling === 'update') {
              const { error } = await supabase
                .from('customer')
                .update(customerData)
                .eq('id', existingCustomer.id);
              
              if (error) throw error;
              results.imported++;
            } else {
              results.skipped++;
            }
          } else {
            const { error } = await supabase
              .from('customer')
              .insert(customerData);
            
            if (error) throw error;
            results.imported++;
          }
        } catch (err) {
          console.error('Error importing item:', item.id, err);
          results.failed++;
        }

        setImportProgress(Math.round(((i + 1) / items.length) * 100));
      }

      setImportResults(results);
      toast.success(`Import complete: ${results.imported} imported, ${results.skipped} skipped, ${results.failed} failed`);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // Get preview data for an item
  const getPreviewValue = (item: Item, fieldId: string): string => {
    const columnId = Object.entries(columnMappings).find(([_, value]) => value === fieldId)?.[0];
    if (!columnId) return '-';
    
    const columnValue = item.column_values.find(cv => cv.id === columnId);
    return columnValue?.text || '-';
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/customers')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>
        <h1 className="text-3xl font-bold">Import from Monday.com</h1>
        <p className="text-muted-foreground mt-2">
          Import your customer data from Monday.com with flexible column mapping
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8 gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {step > s ? <Check className="h-5 w-5" /> : s}
            </div>
            {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Board */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Connect & Select Board</CardTitle>
            <CardDescription>
              Fetch your Monday.com boards and select the one containing customer data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={fetchBoards} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Fetch Boards
              </Button>
            </div>

            {boards.length > 0 && (
              <div className="space-y-4">
                <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select a board" />
                  </SelectTrigger>
                  <SelectContent>
                    {boards.map((board) => (
                      <SelectItem key={board.id} value={board.id}>
                        {board.name} {board.items_count ? `(${board.items_count} items)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={fetchColumns} disabled={!selectedBoard || loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  Continue to Column Mapping
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
            <CardDescription>
              Map Monday.com columns to customer fields. Unmapped columns will be skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monday.com Column</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Maps To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((column) => (
                  <TableRow key={column.id}>
                    <TableCell className="font-medium">{column.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{column.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={columnMappings[column.id] || 'skip'} 
                        onValueChange={(value) => setColumnMappings(prev => ({ ...prev, [column.id]: value }))}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {customerFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={fetchItems} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Preview Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview & Import */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Preview & Import</CardTitle>
            <CardDescription>
              Review the mapped data before importing. Showing first {Math.min(items.length, 10)} of {items.length} items.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Duplicate Handling */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Duplicate handling:</span>
              <Select value={duplicateHandling} onValueChange={(v: 'skip' | 'update') => setDuplicateHandling(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip existing</SelectItem>
                  <SelectItem value="update">Update existing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview Table */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {customerFields.filter(f => f.id !== 'skip' && Object.values(columnMappings).includes(f.id)).map((field) => (
                      <TableHead key={field.id}>{field.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, 10).map((item) => (
                    <TableRow key={item.id}>
                      {customerFields.filter(f => f.id !== 'skip' && Object.values(columnMappings).includes(f.id)).map((field) => (
                        <TableCell key={field.id}>
                          {getPreviewValue(item, field.id)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Import Progress */}
            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importing...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
            )}

            {/* Import Results */}
            {importResults && (
              <div className="flex gap-4">
                <Badge variant="default">{importResults.imported} Imported</Badge>
                <Badge variant="secondary">{importResults.skipped} Skipped</Badge>
                {importResults.failed > 0 && <Badge variant="destructive">{importResults.failed} Failed</Badge>}
              </div>
            )}

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)} disabled={importing}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={importItems} disabled={importing || importResults !== null}>
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Import {items.length} Items
              </Button>
              {importResults && (
                <Button variant="outline" onClick={() => navigate('/customers')}>
                  View Customers
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MondayImport;
