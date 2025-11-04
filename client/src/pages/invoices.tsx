import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Eye, DollarSign, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { insertInvoiceSchema, insertInvoiceItemSchema, insertPaymentSchema, type Invoice, type InvoiceItem, type Payment, type Client, type Employee } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";

const statusColors = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

type InvoiceFormData = z.infer<typeof insertInvoiceSchema>;
type InvoiceItemFormData = z.infer<typeof insertInvoiceItemSchema>;
type PaymentFormData = z.infer<typeof insertPaymentSchema>;

export default function InvoicesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const { toast } = useToast();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/invoices", selectedInvoice?.id, "items"],
    enabled: !!selectedInvoice,
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/invoices", selectedInvoice?.id, "payments"],
    enabled: !!selectedInvoice,
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(insertInvoiceSchema),
    defaultValues: {
      invoiceNumber: "",
      operationId: null,
      employeeId: "",
      clientId: "",
      currency: "USD",
      subtotal: "0",
      tax: "0",
      total: "0",
      status: "draft",
      dueDate: new Date() as any,
      paidDate: null,
      notes: "",
    },
  });

  const itemForm = useForm<InvoiceItemFormData>({
    resolver: zodResolver(insertInvoiceItemSchema),
    defaultValues: {
      invoiceId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      amount: "0",
    },
  });

  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(insertPaymentSchema),
    defaultValues: {
      invoiceId: "",
      amount: "0",
      paymentDate: new Date() as any,
      paymentMethod: "transfer",
      reference: "",
      notes: "",
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
    mutationFn: (data: InvoiceFormData) => {
      const formattedData = {
        ...data,
        dueDate: new Date(data.dueDate),
        paidDate: data.paidDate ? new Date(data.paidDate) : null,
      };
      return apiRequest("POST", "/api/invoices", formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Invoice created successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/invoices/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted successfully" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: InvoiceItemFormData) =>
      apiRequest("POST", `/api/invoices/${selectedInvoice?.id}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", selectedInvoice?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsItemDialogOpen(false);
      itemForm.reset();
      toast({ title: "Item added successfully" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InvoiceItemFormData> }) =>
      apiRequest("PATCH", `/api/invoice-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", selectedInvoice?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
      toast({ title: "Item updated successfully" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/invoice-items/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", selectedInvoice?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Item deleted successfully" });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) => {
      const formattedData = {
        ...data,
        paymentDate: new Date(data.paymentDate),
      };
      return apiRequest("POST", `/api/invoices/${selectedInvoice?.id}/payments`, formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", selectedInvoice?.id, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsPaymentDialogOpen(false);
      paymentForm.reset();
      toast({ title: "Payment added successfully" });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/payments/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", selectedInvoice?.id, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment deleted successfully" });
    },
  });

  const onSubmit = (data: InvoiceFormData) => {
    createMutation.mutate(data);
  };

  const onItemSubmit = (data: InvoiceItemFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate({ ...data, invoiceId: selectedInvoice!.id });
    }
  };

  const onPaymentSubmit = (data: PaymentFormData) => {
    createPaymentMutation.mutate({ ...data, invoiceId: selectedInvoice!.id });
  };

  const handleAddItem = () => {
    setEditingItem(null);
    itemForm.reset({
      invoiceId: selectedInvoice!.id,
      description: "",
      quantity: "1",
      unitPrice: "0",
      amount: "0",
    });
    setIsItemDialogOpen(true);
  };

  const handleEditItem = (item: InvoiceItem) => {
    setEditingItem(item);
    itemForm.reset(item);
    setIsItemDialogOpen(true);
  };

  const handleAddPayment = () => {
    setEditingPayment(null);
    paymentForm.reset({
      invoiceId: selectedInvoice!.id,
      amount: "0",
      paymentDate: new Date() as any,
      paymentMethod: "transfer",
      reference: "",
      notes: "",
    });
    setIsPaymentDialogOpen(true);
  };

  const columns = [
    {
      header: "Invoice #",
      accessor: (row: Invoice) => (
        <div className="font-medium">{row.invoiceNumber}</div>
      ),
    },
    {
      header: "Client",
      accessor: (row: Invoice) => {
        const client = clients.find((c) => c.id === row.clientId);
        return client?.name || "-";
      },
    },
    {
      header: "Currency",
      accessor: (row: Invoice) => (
        <Badge variant="outline">{row.currency}</Badge>
      ),
    },
    {
      header: "Total",
      accessor: (row: Invoice) => `${row.currency} ${parseFloat(row.total).toFixed(2)}`,
    },
    {
      header: "Status",
      accessor: (row: Invoice) => (
        <Badge className={statusColors[row.status as keyof typeof statusColors]} data-testid={`status-${row.id}`}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Due Date",
      accessor: (row: Invoice) => new Date(row.dueDate).toLocaleDateString(),
    },
    {
      header: "Actions",
      accessor: (row: Invoice) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedInvoice(row)}
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
          <h1 className="text-3xl font-semibold text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage invoices and billing</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-invoice">
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
              <DialogDescription>Create a new invoice</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-invoice-number" />
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
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} data-testid="input-due-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
        data={invoices}
        columns={columns}
        searchPlaceholder="Search invoices..."
        isLoading={isLoading}
        emptyMessage="No invoices found. Create your first invoice to get started."
      />

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Invoice #{selectedInvoice?.invoiceNumber}</DialogTitle>
                <DialogDescription>
                  Client: {clients.find((c) => c.id === selectedInvoice?.clientId)?.name}
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Subtotal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{selectedInvoice.currency} {parseFloat(selectedInvoice.subtotal).toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Tax</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{selectedInvoice.currency} {parseFloat(selectedInvoice.tax).toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{selectedInvoice.currency} {parseFloat(selectedInvoice.total).toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Items
                      </CardTitle>
                      <CardDescription>Line items for this invoice</CardDescription>
                    </div>
                    <Button size="sm" onClick={handleAddItem} data-testid="button-add-item">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {invoiceItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No items added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {invoiceItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-md border">
                          <div className="flex-1">
                            <div className="font-medium">{item.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {parseFloat(item.quantity).toFixed(2)} × {selectedInvoice.currency} {parseFloat(item.unitPrice).toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold">{selectedInvoice.currency} {parseFloat(item.amount).toFixed(2)}</div>
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

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Payments
                      </CardTitle>
                      <CardDescription>Payment history for this invoice</CardDescription>
                    </div>
                    <Button size="sm" onClick={handleAddPayment} data-testid="button-add-payment">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Payment
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet</p>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 rounded-md border">
                          <div className="flex-1">
                            <div className="font-medium">{payment.paymentMethod.toUpperCase()}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(payment.paymentDate).toLocaleDateString()} {payment.reference && `- Ref: ${payment.reference}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold">{selectedInvoice.currency} {parseFloat(payment.amount).toFixed(2)}</div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePaymentMutation.mutate(payment.id)}
                              data-testid={`button-delete-payment-${payment.id}`}
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
            <DialogDescription>Add a line item to the invoice</DialogDescription>
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>Record a payment for this invoice</DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-payment-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={paymentForm.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} data-testid="input-payment-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-method">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={paymentForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-payment-reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} data-testid="input-payment-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPaymentMutation.isPending} data-testid="button-submit-payment">
                  Add Payment
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
