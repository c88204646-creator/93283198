import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Eye, FileText, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProposalSchema, insertProposalItemSchema, type Proposal, type ProposalItem, type Client, type Employee } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";

const statusColors = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  converted: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

type ProposalFormData = z.infer<typeof insertProposalSchema>;
type ProposalItemFormData = z.infer<typeof insertProposalItemSchema>;

export default function ProposalsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProposalItem | null>(null);
  const { toast } = useToast();

  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ["/api/proposals"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: proposalItems = [] } = useQuery<ProposalItem[]>({
    queryKey: ["/api/proposals", selectedProposal?.id, "items"],
    enabled: !!selectedProposal,
  });

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(insertProposalSchema),
    defaultValues: {
      proposalNumber: "",
      clientId: "",
      employeeId: "",
      title: "",
      description: "",
      currency: "USD",
      subtotal: "0",
      tax: "0",
      total: "0",
      status: "draft",
      validUntil: new Date() as any,
      convertedToInvoiceId: null,
    },
  });

  const itemForm = useForm<ProposalItemFormData>({
    resolver: zodResolver(insertProposalItemSchema),
    defaultValues: {
      proposalId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      amount: "0",
    },
  });

  const selectedClient = clients.find((c) => c.id === form.watch("clientId"));

  useEffect(() => {
    if (selectedClient && !form.getValues("currency")) {
      form.setValue("currency", selectedClient.currency);
    }
  }, [selectedClient, form]);

  const watchQuantity = itemForm.watch("quantity");
  const watchUnitPrice = itemForm.watch("unitPrice");

  useEffect(() => {
    const qty = parseFloat(watchQuantity || "0");
    const price = parseFloat(watchUnitPrice || "0");
    const amount = (qty * price).toFixed(2);
    itemForm.setValue("amount", amount);
  }, [watchQuantity, watchUnitPrice, itemForm]);

  const createMutation = useMutation({
    mutationFn: (data: ProposalFormData) => {
      const formattedData = {
        ...data,
        validUntil: new Date(data.validUntil),
      };
      return apiRequest("POST", "/api/proposals", formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Proposal created successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/proposals/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal deleted successfully" });
    },
  });

  const convertToInvoiceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/proposals/${id}/convert-to-invoice`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSelectedProposal(null);
      toast({ title: "Proposal converted to invoice successfully" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: ProposalItemFormData) =>
      apiRequest("POST", `/api/proposals/${selectedProposal?.id}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", selectedProposal?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setIsItemDialogOpen(false);
      itemForm.reset();
      toast({ title: "Item added successfully" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProposalItemFormData> }) =>
      apiRequest("PATCH", `/api/proposal-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", selectedProposal?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
      toast({ title: "Item updated successfully" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/proposal-items/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", selectedProposal?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Item deleted successfully" });
    },
  });

  const onSubmit = (data: ProposalFormData) => {
    createMutation.mutate(data);
  };

  const onItemSubmit = (data: ProposalItemFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate({ ...data, proposalId: selectedProposal!.id });
    }
  };

  const handleAddItem = () => {
    setEditingItem(null);
    itemForm.reset({
      proposalId: selectedProposal!.id,
      description: "",
      quantity: "1",
      unitPrice: "0",
      amount: "0",
    });
    setIsItemDialogOpen(true);
  };

  const handleEditItem = (item: ProposalItem) => {
    setEditingItem(item);
    itemForm.reset(item);
    setIsItemDialogOpen(true);
  };

  const columns = [
    {
      header: "Proposal #",
      accessor: (row: Proposal) => (
        <div>
          <div className="font-medium">{row.proposalNumber}</div>
          <div className="text-sm text-muted-foreground line-clamp-1">{row.title}</div>
        </div>
      ),
    },
    {
      header: "Client",
      accessor: (row: Proposal) => {
        const client = clients.find((c) => c.id === row.clientId);
        return client?.name || "-";
      },
    },
    {
      header: "Currency",
      accessor: (row: Proposal) => (
        <Badge variant="outline">{row.currency}</Badge>
      ),
    },
    {
      header: "Total",
      accessor: (row: Proposal) => `${row.currency} ${parseFloat(row.total).toFixed(2)}`,
    },
    {
      header: "Status",
      accessor: (row: Proposal) => (
        <Badge className={statusColors[row.status as keyof typeof statusColors]} data-testid={`status-${row.id}`}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Valid Until",
      accessor: (row: Proposal) => new Date(row.validUntil).toLocaleDateString(),
    },
    {
      header: "Actions",
      accessor: (row: Proposal) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedProposal(row)}
            data-testid={`button-view-${row.id}`}
          >
            <Eye className="w-4 h-4" />
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
          <h1 className="text-3xl font-semibold text-foreground">Proposals</h1>
          <p className="text-muted-foreground mt-1">Manage quotes and proposals for clients</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-proposal">
              <Plus className="w-4 h-4 mr-2" />
              New Proposal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Proposal</DialogTitle>
              <DialogDescription>Create a new proposal</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="proposalNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proposal Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-proposal-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client">
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name} ({client.currency})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-employee">
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.position}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Input {...field} disabled data-testid="input-currency" />
                      <p className="text-sm text-muted-foreground">Currency is automatically set from client</p>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid Until</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} data-testid="input-valid-until" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    Create
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={proposals}
        columns={columns}
        searchPlaceholder="Search proposals..."
        isLoading={isLoading}
        emptyMessage="No proposals found. Create your first proposal to get started."
      />

      <Dialog open={!!selectedProposal} onOpenChange={(open) => !open && setSelectedProposal(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Proposal #{selectedProposal?.proposalNumber}</DialogTitle>
                <DialogDescription>
                  {selectedProposal?.title} - {clients.find((c) => c.id === selectedProposal?.clientId)?.name}
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedProposal(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Subtotal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{selectedProposal.currency} {parseFloat(selectedProposal.subtotal).toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Tax</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{selectedProposal.currency} {parseFloat(selectedProposal.tax).toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{selectedProposal.currency} {parseFloat(selectedProposal.total).toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              {selectedProposal.status !== "converted" && !selectedProposal.convertedToInvoiceId && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-sm">Convert to Invoice</CardTitle>
                    <CardDescription>
                      Convert this proposal into an invoice to start billing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => convertToInvoiceMutation.mutate(selectedProposal.id)}
                      disabled={convertToInvoiceMutation.isPending}
                      data-testid="button-convert-to-invoice"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Convert to Invoice
                    </Button>
                  </CardContent>
                </Card>
              )}

              {selectedProposal.status === "converted" && (
                <Card className="border-purple-500/20 bg-purple-50 dark:bg-purple-950/20">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      This proposal has been converted to an invoice
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Items
                      </CardTitle>
                      <CardDescription>Line items for this proposal</CardDescription>
                    </div>
                    <Button size="sm" onClick={handleAddItem} data-testid="button-add-item">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {proposalItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No items added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {proposalItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-md border">
                          <div className="flex-1">
                            <div className="font-medium">{item.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {parseFloat(item.quantity).toFixed(2)} × {selectedProposal.currency} {parseFloat(item.unitPrice).toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold">{selectedProposal.currency} {parseFloat(item.amount).toFixed(2)}</div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditItem(item)}
                              data-testid={`button-edit-item-${item.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteItemMutation.mutate(item.id)}
                              data-testid={`button-delete-item-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription>Add a line item to the proposal</DialogDescription>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4">
              <FormField
                control={itemForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-item-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-item-quantity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-item-unit-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={itemForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input {...field} disabled data-testid="input-item-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending} data-testid="button-submit-item">
                  {editingItem ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
