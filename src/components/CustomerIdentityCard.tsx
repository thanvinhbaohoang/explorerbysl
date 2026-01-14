import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IdCard, Pencil, X, Save, Loader2 } from "lucide-react";
import { countries } from "@/data/countries";

interface IdentityData {
  legal_first_name: string | null;
  legal_middle_name: string | null;
  legal_last_name: string | null;
  sex: string | null;
  passport_number: string | null;
  nationality: string | null;
  national_id: string | null;
}

interface CustomerIdentityCardProps {
  customerId: string;
  identityData: IdentityData;
  onUpdate: () => void;
}

const sexOptions = ["Male", "Female", "Other"] as const;

export const CustomerIdentityCard = ({
  customerId,
  identityData,
  onUpdate,
}: CustomerIdentityCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<IdentityData>(identityData);

  const handleInputChange = (field: keyof IdentityData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value || null,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("customer")
        .update({
          legal_first_name: formData.legal_first_name,
          legal_middle_name: formData.legal_middle_name,
          legal_last_name: formData.legal_last_name,
          sex: formData.sex,
          passport_number: formData.passport_number,
          nationality: formData.nationality,
          national_id: formData.national_id,
        })
        .eq("id", customerId);

      if (error) throw error;

      toast.success("Identity information updated");
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating identity:", error);
      toast.error("Failed to update identity information");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(identityData);
    setIsEditing(false);
  };

  const hasAnyData = Object.values(identityData).some((v) => v !== null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <IdCard className="h-5 w-5" />
          Identity Information
        </CardTitle>
        {!isEditing ? (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legal_first_name">Legal First Name</Label>
              <Input
                id="legal_first_name"
                value={formData.legal_first_name || ""}
                onChange={(e) => handleInputChange("legal_first_name", e.target.value)}
                placeholder="Enter legal first name"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_middle_name">Legal Middle Name</Label>
              <Input
                id="legal_middle_name"
                value={formData.legal_middle_name || ""}
                onChange={(e) => handleInputChange("legal_middle_name", e.target.value)}
                placeholder="Enter legal middle name"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_last_name">Legal Last Name</Label>
              <Input
                id="legal_last_name"
                value={formData.legal_last_name || ""}
                onChange={(e) => handleInputChange("legal_last_name", e.target.value)}
                placeholder="Enter legal last name"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">Sex</Label>
              <Select
                value={formData.sex || ""}
                onValueChange={(value) => handleInputChange("sex", value)}
              >
                <SelectTrigger id="sex">
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  {sexOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passport_number">Passport Number</Label>
              <Input
                id="passport_number"
                value={formData.passport_number || ""}
                onChange={(e) => handleInputChange("passport_number", e.target.value)}
                placeholder="Enter passport number"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Select
                value={formData.nationality || ""}
                onValueChange={(value) => handleInputChange("nationality", value)}
              >
                <SelectTrigger id="nationality">
                  <SelectValue placeholder="Select nationality" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="national_id">National ID</Label>
              <Input
                id="national_id"
                value={formData.national_id || ""}
                onChange={(e) => handleInputChange("national_id", e.target.value)}
                placeholder="Enter national ID number"
                maxLength={50}
              />
            </div>
          </div>
        ) : hasAnyData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoDisplay label="Legal First Name" value={identityData.legal_first_name} />
            <InfoDisplay label="Legal Middle Name" value={identityData.legal_middle_name} />
            <InfoDisplay label="Legal Last Name" value={identityData.legal_last_name} />
            <InfoDisplay label="Sex" value={identityData.sex} />
            <InfoDisplay label="Passport Number" value={identityData.passport_number} />
            <InfoDisplay label="Nationality" value={identityData.nationality} />
            <InfoDisplay label="National ID" value={identityData.national_id} className="md:col-span-2" />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No identity information recorded. Click Edit to add details.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const InfoDisplay = ({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) => (
  <div className={className}>
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="font-medium">{value || "—"}</div>
  </div>
);
