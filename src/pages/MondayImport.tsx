import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RefreshCw, LayoutGrid, List } from "lucide-react";

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

const MondayImport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

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
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error('No boards found');
      }
    } catch (error: any) {
      console.error('Error fetching boards:', error);
      toast.error(error.message || 'Failed to fetch boards. Make sure your Monday API token is configured.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch columns and items for selected board
  const fetchBoardData = async (boardId: string, loadMore = false) => {
    if (!boardId) return;

    setLoadingItems(true);
    try {
      // Fetch columns first (only on initial load)
      if (!loadMore) {
        const { data: columnsData, error: columnsError } = await supabase.functions.invoke('monday-import', {
          body: { action: 'get_board_columns', boardId }
        });

        if (columnsError) throw columnsError;
        
        if (columnsData?.data?.boards?.[0]?.columns) {
          setColumns(columnsData.data.boards[0].columns);
        }
      }

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase.functions.invoke('monday-import', {
        body: { 
          action: 'get_board_items', 
          boardId,
          cursor: loadMore ? cursor : null
        }
      });

      if (itemsError) throw itemsError;
      
      if (itemsData?.data?.boards?.[0]?.items_page) {
        const newItems = itemsData.data.boards[0].items_page.items;
        const newCursor = itemsData.data.boards[0].items_page.cursor;
        
        if (loadMore) {
          setItems(prev => [...prev, ...newItems]);
        } else {
          setItems(newItems);
        }
        
        setCursor(newCursor);
        setHasMore(!!newCursor);
        
        if (!loadMore) {
          toast.success(`Loaded ${newItems.length} items`);
        }
      }
    } catch (error: any) {
      console.error('Error fetching board data:', error);
      toast.error(error.message || 'Failed to fetch board data');
    } finally {
      setLoadingItems(false);
    }
  };

  // Handle board selection
  const handleBoardSelect = (boardId: string) => {
    setSelectedBoard(boardId);
    setItems([]);
    setColumns([]);
    setCursor(null);
    setHasMore(false);
    fetchBoardData(boardId);
  };

  // Get column value for display
  const getColumnValue = (item: Item, columnId: string): string => {
    const columnValue = item.column_values.find(cv => cv.id === columnId);
    return columnValue?.text || '-';
  };

  // Get selected board info
  const selectedBoardInfo = boards.find(b => b.id === selectedBoard);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Monday.com Data</h1>
        <p className="text-muted-foreground mt-2">
          View and browse your Monday.com boards and items
        </p>
      </div>

      {/* Board Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Select Board
          </CardTitle>
          <CardDescription>
            Connect to Monday.com and select a board to view its data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button onClick={fetchBoards} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {boards.length > 0 ? 'Refresh Boards' : 'Fetch Boards'}
            </Button>

            {boards.length > 0 && (
              <Select value={selectedBoard} onValueChange={handleBoardSelect}>
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
            )}
          </div>

          {selectedBoardInfo && (
            <div className="flex items-center gap-4 pt-2">
              <Badge variant="outline">{selectedBoardInfo.items_count || 0} items</Badge>
              {selectedBoardInfo.description && (
                <span className="text-sm text-muted-foreground">{selectedBoardInfo.description}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Display */}
      {selectedBoard && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Board Items
            </CardTitle>
            <CardDescription>
              Showing {items.length} items from {selectedBoardInfo?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingItems && items.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No items found in this board
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">Item Name</TableHead>
                        {columns.slice(0, 8).map((column) => (
                          <TableHead key={column.id}>
                            <div className="flex flex-col gap-1">
                              <span>{column.title}</span>
                              <Badge variant="outline" className="text-xs w-fit">
                                {column.type}
                              </Badge>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium sticky left-0 bg-background">
                            {item.name}
                          </TableCell>
                          {columns.slice(0, 8).map((column) => (
                            <TableCell key={column.id} className="max-w-[200px] truncate">
                              {getColumnValue(item, column.id)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {columns.length > 8 && (
                  <p className="text-sm text-muted-foreground">
                    Showing first 8 of {columns.length} columns
                  </p>
                )}

                {hasMore && (
                  <Button 
                    variant="outline" 
                    onClick={() => fetchBoardData(selectedBoard, true)}
                    disabled={loadingItems}
                    className="w-full"
                  >
                    {loadingItems ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Load More Items
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MondayImport;
