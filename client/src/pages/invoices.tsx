import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Eye, X, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
type PaymentFormData = z.infer<typeof insertPaymentSchema>;

interface InvoiceLineItem {
  tempId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export default function InvoicesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { tempId: '1', description: '', quantity: '1', unitPrice: '0', amount: '0' }
  ]);
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
    if (selectedClient) {
      form.setValue("currency", selectedClient.currency);
    }
  }, [selectedClient, form]);

  // Recalcular totales automáticamente cuando cambian los items
  useEffect(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const amount = parseFloat(item.amount || "0");
      return sum + amount;
    }, 0);

    const tax = subtotal * 0.16; // 16% IVA
    const total = subtotal + tax;

    form.setValue("subtotal", subtotal.toFixed(2));
    form.setValue("tax", tax.toFixed(2));
    form.setValue("total", total.toFixed(2));
  }, [lineItems, form]);

  const addLineItem = () => {
    setLineItems([...lineItems, {
      tempId: Date.now().toString(),
      description: '',
      quantity: '1',
      unitPrice: '0',
      amount: '0'
    }]);
  };

  const removeLineItem = (tempId: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.tempId !== tempId));
    }
  };

  const updateLineItem = (tempId: string, field: keyof InvoiceLineItem, value: string) => {
    setLineItems(lineItems.map(item => {
      if (item.tempId === tempId) {
        const updated = { ...item, [field]: value };
        
        // Recalcular amount si cambia quantity o unitPrice
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = parseFloat(field === 'quantity' ? value : updated.quantity) || 0;
          const price = parseFloat(field === 'unitPrice' ? value : updated.unitPrice) || 0;
          updated.amount = (qty * price).toFixed(2);
        }
        
        return updated;
      }
      return item;
    }));
  };

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const formattedData = {
        ...data,
        dueDate: new Date(data.dueDate),
        paidDate: data.paidDate ? new Date(data.paidDate) : null,
      };
      
      // Crear la factura primero
      const invoice = await apiRequest("POST", "/api/invoices", formattedData) as Invoice;
      
      // Luego crear todos los items
      for (const item of lineItems) {
        if (item.description.trim()) {
          await apiRequest("POST", `/api/invoices/${invoice.id}/items`, {
            invoiceId: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          });
        }
      }
      
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsCreateOpen(false);
      form.reset();
      setLineItems([{ tempId: '1', description: '', quantity: '1', unitPrice: '0', amount: '0' }]);
      toast({ title: "Factura creada exitosamente" });
    },
    onError: (error: any) => {
      console.error("Error creating invoice:", error);
      toast({ 
        title: "Error al crear factura", 
        description: error?.message || "Por favor intenta de nuevo",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/invoices/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Factura eliminada exitosamente" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/invoice-items/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", selectedInvoice?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Item eliminado exitosamente" });
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
      toast({ title: "Pago agregado exitosamente" });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/payments/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", selectedInvoice?.id, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Pago eliminado exitosamente" });
    },
  });

  const onSubmit = (data: InvoiceFormData) => {
    // Validar que haya al menos un item con descripción
    const hasValidItems = lineItems.some(item => item.description.trim());
    if (!hasValidItems) {
      toast({ 
        title: "Error", 
        description: "Agrega al menos un item a la factura",
        variant: "destructive"
      });
      return;
    }
    
    createMutation.mutate(data);
  };

  const onPaymentSubmit = (data: PaymentFormData) => {
    createPaymentMutation.mutate({ ...data, invoiceId: selectedInvoice!.id });
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
      header: "Factura #",
      accessor: (row: Invoice) => (
        <div className="font-medium">{row.invoiceNumber}</div>
      ),
    },
    {
      header: "Cliente",
      accessor: (row: Invoice) => {
        const client = clients.find((c) => c.id === row.clientId);
        return client?.name || "-";
      },
    },
    {
      header: "Moneda",
      accessor: (row: Invoice) => (
        <Badge variant="outline">{row.currency}</Badge>
      ),
    },
    {
      header: "Total",
      accessor: (row: Invoice) => `${row.currency} ${parseFloat(row.total).toFixed(2)}`,
    },
    {
      header: "Estado",
      accessor: (row: Invoice) => (
        <Badge className={statusColors[row.status as keyof typeof statusColors]} data-testid={`status-${row.id}`}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Vencimiento",
      accessor: (row: Invoice) => new Date(row.dueDate).toLocaleDateString('es-MX'),
    },
    {
      header: "Acciones",
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
          <h1 className="text-3xl font-semibold text-foreground">Facturas</h1>
          <p className="text-muted-foreground mt-1">Gestión de facturas y facturación</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-invoice">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Factura
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Factura</DialogTitle>
              <DialogDescription>Crea una factura completa con todos sus items</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Información básica */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Factura*</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="INV-001" data-testid="input-invoice-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client">
                              <SelectValue placeholder="Seleccionar cliente" />
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
                        <FormLabel>Empleado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-employee">
                              <SelectValue placeholder="Seleccionar empleado" />
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

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moneda</FormLabel>
                        <Input {...field} disabled data-testid="input-currency" />
                        <p className="text-xs text-muted-foreground">Definida por el cliente</p>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Borrador</SelectItem>
                            <SelectItem value="sent">Enviada</SelectItem>
                            <SelectItem value="paid">Pagada</SelectItem>
                            <SelectItem value="overdue">Vencida</SelectItem>
                            <SelectItem value="cancelled">Cancelada</SelectItem>
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
                        <FormLabel>Fecha de Vencimiento</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} 
                            data-testid="input-due-date" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Tabla de Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Items de la Factura</h3>
                    <Button type="button" size="sm" onClick={addLineItem} data-testid="button-add-item">
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar Item
                    </Button>
                  </div>

                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 font-medium text-sm">Descripción</th>
                          <th className="text-right p-3 font-medium text-sm w-24">Cantidad</th>
                          <th className="text-right p-3 font-medium text-sm w-32">Precio Unit.</th>
                          <th className="text-right p-3 font-medium text-sm w-32">Importe</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, index) => (
                          <tr key={item.tempId} className="border-t">
                            <td className="p-2">
                              <Input
                                placeholder="Descripción del servicio o producto"
                                value={item.description}
                                onChange={(e) => updateLineItem(item.tempId, 'description', e.target.value)}
                                data-testid={`input-item-description-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="text-right"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(item.tempId, 'quantity', e.target.value)}
                                data-testid={`input-item-quantity-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="text-right"
                                value={item.unitPrice}
                                onChange={(e) => updateLineItem(item.tempId, 'unitPrice', e.target.value)}
                                data-testid={`input-item-price-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={parseFloat(item.amount || "0").toFixed(2)}
                                disabled
                                className="text-right bg-muted"
                                data-testid={`input-item-amount-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLineItem(item.tempId)}
                                disabled={lineItems.length === 1}
                                data-testid={`button-remove-item-${index}`}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totales */}
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-semibold">{form.watch("currency")} {parseFloat(form.watch("subtotal") || "0").toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">IVA (16%):</span>
                      <span className="font-semibold">{form.watch("currency")} {parseFloat(form.watch("tax") || "0").toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-bold">Total:</span>
                      <span className="font-bold text-primary">{form.watch("currency")} {parseFloat(form.watch("total") || "0").toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} rows={3} placeholder="Notas adicionales..." data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? "Creando..." : "Crear Factura"}
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
        searchPlaceholder="Buscar facturas..."
        isLoading={isLoading}
        emptyMessage="No hay facturas. Crea tu primera factura para comenzar."
      />

      {/* Dialog de Vista de Factura (existente, simplificado) */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Factura #{selectedInvoice?.invoiceNumber}</DialogTitle>
                <DialogDescription>
                  Cliente: {clients.find((c) => c.id === selectedInvoice?.clientId)?.name}
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
                    <CardTitle className="text-sm font-medium">IVA</CardTitle>
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
                    <div className="text-2xl font-semibold text-primary">{selectedInvoice.currency} {parseFloat(selectedInvoice.total).toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Items</h3>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium text-sm">Descripción</th>
                        <th className="text-right p-3 font-medium text-sm">Cantidad</th>
                        <th className="text-right p-3 font-medium text-sm">Precio Unit.</th>
                        <th className="text-right p-3 font-medium text-sm">Importe</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">{item.description}</td>
                          <td className="p-3 text-right">{parseFloat(item.quantity).toFixed(2)}</td>
                          <td className="p-3 text-right">{selectedInvoice.currency} {parseFloat(item.unitPrice).toFixed(2)}</td>
                          <td className="p-3 text-right font-medium">{selectedInvoice.currency} {parseFloat(item.amount).toFixed(2)}</td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteItemMutation.mutate(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Pagos</h3>
                  <Button size="sm" onClick={handleAddPayment}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar Pago
                  </Button>
                </div>
                {payments.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 font-medium text-sm">Fecha</th>
                          <th className="text-left p-3 font-medium text-sm">Método</th>
                          <th className="text-right p-3 font-medium text-sm">Monto</th>
                          <th className="text-left p-3 font-medium text-sm">Referencia</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-t">
                            <td className="p-3">{new Date(payment.paymentDate).toLocaleDateString('es-MX')}</td>
                            <td className="p-3">{payment.paymentMethod}</td>
                            <td className="p-3 text-right font-medium">{selectedInvoice.currency} {parseFloat(payment.amount).toFixed(2)}</td>
                            <td className="p-3">{payment.reference || "-"}</td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deletePaymentMutation.mutate(payment.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8 border rounded-md">No hay pagos registrados</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para agregar pago */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Pago</DialogTitle>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Pago</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} 
                      />
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
                    <FormLabel>Método de Pago</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                        <SelectItem value="card">Tarjeta</SelectItem>
                        <SelectItem value="check">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referencia</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createPaymentMutation.isPending}>
                  Agregar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
