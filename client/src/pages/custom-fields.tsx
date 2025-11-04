import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCustomFieldSchema, type CustomField } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";

type CustomFieldFormData = z.infer<typeof insertCustomFieldSchema>;

export default function CustomFieldsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState("");
  const { toast } = useToast();

  const { data: customFields = [], isLoading } = useQuery<CustomField[]>({
    queryKey: ["/api/custom-fields"],
  });

  const form = useForm<CustomFieldFormData>({
    resolver: zodResolver(insertCustomFieldSchema),
    defaultValues: {
      moduleName: "operations",
      fieldName: "",
      fieldLabel: "",
      fieldType: "text",
      fieldOptions: null,
      required: false,
      defaultValue: "",
    },
  });

  const fieldType = form.watch("fieldType");

  const createMutation = useMutation({
    mutationFn: (data: CustomFieldFormData) => {
      let options = null;
      if (data.fieldType === "dropdown" && dropdownOptions) {
        options = dropdownOptions.split(',').map(opt => opt.trim()).filter(Boolean);
      }
      return apiRequest("POST", "/api/custom-fields", { ...data, fieldOptions: options });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      setIsCreateOpen(false);
      setDropdownOptions("");
      form.reset();
      toast({ title: "Custom field created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomFieldFormData }) => {
      let options = null;
      if (data.fieldType === "dropdown" && dropdownOptions) {
        options = dropdownOptions.split(',').map(opt => opt.trim()).filter(Boolean);
      }
      return apiRequest("PATCH", `/api/custom-fields/${id}`, { ...data, fieldOptions: options });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      setEditingField(null);
      setDropdownOptions("");
      form.reset();
      toast({ title: "Custom field updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/custom-fields/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Custom field deleted successfully" });
    },
  });

  const onSubmit = (data: CustomFieldFormData) => {
    if (editingField) {
      updateMutation.mutate({ id: editingField.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (field: CustomField) => {
    setEditingField(field);
    if (field.fieldType === "dropdown" && field.fieldOptions) {
      setDropdownOptions(Array.isArray(field.fieldOptions) ? field.fieldOptions.join(', ') : '');
    }
    form.reset(field);
  };

  const columns = [
    {
      header: "Field Name",
      accessor: (row: CustomField) => (
        <div>
          <div className="font-medium">{row.fieldLabel}</div>
          <div className="text-sm text-muted-foreground">{row.fieldName}</div>
        </div>
      ),
    },
    {
      header: "Module",
      accessor: (row: CustomField) => (
        <Badge className="capitalize bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {row.moduleName}
        </Badge>
      ),
    },
    {
      header: "Field Type",
      accessor: (row: CustomField) => (
        <span className="capitalize">{row.fieldType}</span>
      ),
    },
    {
      header: "Required",
      accessor: (row: CustomField) => (
        row.required ? (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Yes</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">No</Badge>
        )
      ),
    },
    {
      header: "Default Value",
      accessor: (row: CustomField) => row.defaultValue || "-",
    },
    {
      header: "Actions",
      accessor: (row: CustomField) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row)}
            data-testid={`button-edit-${row.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate(row.id)}
            data-testid={`button-delete-${row.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Custom Fields</h1>
          <p className="text-muted-foreground mt-1">Create dynamic fields to extend any module</p>
        </div>
        <Dialog open={isCreateOpen || !!editingField} onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingField(null);
            setDropdownOptions("");
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-custom-field">
              <Plus className="w-4 h-4 mr-2" />
              New Custom Field
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingField ? "Edit Custom Field" : "Create Custom Field"}</DialogTitle>
              <DialogDescription>
                Add a custom field to extend module functionality
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="moduleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-module">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="operations">Operations</SelectItem>
                          <SelectItem value="clients">Clients</SelectItem>
                          <SelectItem value="employees">Employees</SelectItem>
                          <SelectItem value="invoices">Invoices</SelectItem>
                          <SelectItem value="proposals">Proposals</SelectItem>
                          <SelectItem value="expenses">Expenses</SelectItem>
                          <SelectItem value="leads">Leads</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select which module this field will be added to
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fieldName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Field Name (Internal)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., custom_priority" data-testid="input-field-name" />
                        </FormControl>
                        <FormDescription>
                          Used in database (no spaces, lowercase)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fieldLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Field Label (Display)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Priority Level" data-testid="input-field-label" />
                        </FormControl>
                        <FormDescription>
                          Shown to users in forms
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="fieldType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-field-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="dropdown">Dropdown</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {fieldType === "dropdown" && (
                  <div className="space-y-2">
                    <FormLabel>Dropdown Options</FormLabel>
                    <Input
                      value={dropdownOptions}
                      onChange={(e) => setDropdownOptions(e.target.value)}
                      placeholder="Option 1, Option 2, Option 3"
                      data-testid="input-dropdown-options"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter options separated by commas
                    </p>
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="defaultValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Value (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-default-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="required"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-required"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Required Field
                        </FormLabel>
                        <FormDescription>
                          User must fill this field when creating/editing records
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingField(null);
                      setDropdownOptions("");
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                    {editingField ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={customFields}
        columns={columns}
        searchPlaceholder="Search custom fields..."
        isLoading={isLoading}
        emptyMessage="No custom fields found. Create your first custom field to extend modules."
      />
    </div>
  );
}
