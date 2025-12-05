import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Facebook, Send, Search, Link, User } from "lucide-react";

interface Customer {
  id: string;
  telegram_id: number | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  messenger_id: string | null;
  messenger_name: string | null;
  messenger_profile_pic: string | null;
  linked_customer_id: string | null;
}

interface LinkCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCustomer: Customer;
  onLinked: () => void;
}

export const LinkCustomerDialog = ({
  open,
  onOpenChange,
  currentCustomer,
  onLinked,
}: LinkCustomerDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const currentPlatform = currentCustomer.messenger_id ? "messenger" : "telegram";

  useEffect(() => {
    if (open) {
      fetchCustomers();
    }
  }, [open, searchQuery]);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("customer")
        .select("id, telegram_id, first_name, last_name, username, messenger_id, messenger_name, messenger_profile_pic, linked_customer_id")
        .neq("id", currentCustomer.id)
        .is("linked_customer_id", null);

      // Filter by opposite platform to avoid linking same platform accounts
      if (currentPlatform === "messenger") {
        query = query.not("telegram_id", "is", null);
      } else {
        query = query.not("messenger_id", "is", null);
      }

      // Search by name
      if (searchQuery.trim()) {
        query = query.or(
          `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,messenger_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`
        );
      }

      query = query.limit(20);

      const { data, error } = await query;
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to search customers");
    } finally {
      setIsLoading(false);
    }
  };

  const linkCustomer = async (targetCustomer: Customer) => {
    setIsLinking(true);
    try {
      // Determine which customer should be the primary (older one)
      const currentCreatedAt = new Date(currentCustomer.id).getTime(); // UUIDs are time-based
      const targetCreatedAt = new Date(targetCustomer.id).getTime();
      
      let primaryId: string;
      let secondaryId: string;
      
      // Simply use current as primary for simplicity
      primaryId = currentCustomer.id;
      secondaryId = targetCustomer.id;

      // Update the secondary customer to point to the primary
      const { error } = await supabase
        .from("customer")
        .update({ linked_customer_id: primaryId })
        .eq("id", secondaryId);

      if (error) throw error;

      toast.success("Customers linked successfully!");
      onLinked();
      onOpenChange(false);
    } catch (error) {
      console.error("Error linking customers:", error);
      toast.error("Failed to link customers");
    } finally {
      setIsLinking(false);
    }
  };

  const getCustomerName = (customer: Customer) => {
    return customer.messenger_name || 
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || 
      customer.username ||
      "Unknown";
  };

  const getPlatform = (customer: Customer) => {
    return customer.messenger_id ? "messenger" : "telegram";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link Customer Account
          </DialogTitle>
          <DialogDescription>
            Search for another customer account on a different platform to link with this one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                Searching...
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No matching customers found on {currentPlatform === "messenger" ? "Telegram" : "Messenger"}
              </div>
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {customer.messenger_profile_pic ? (
                      <img
                        src={customer.messenger_profile_pic}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{getCustomerName(customer)}</div>
                      <Badge variant="secondary" className="text-xs">
                        {getPlatform(customer) === "messenger" ? (
                          <><Facebook className="h-3 w-3 mr-1" /> Messenger</>
                        ) : (
                          <><Send className="h-3 w-3 mr-1" /> Telegram</>
                        )}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => linkCustomer(customer)}
                    disabled={isLinking}
                  >
                    <Link className="h-4 w-4 mr-1" />
                    Link
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
