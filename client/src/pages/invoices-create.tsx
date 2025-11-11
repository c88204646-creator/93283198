import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Minus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { insertInvoiceSchema, type Client, type Operation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";
import { 
  SAT_PRODUCT_CODES_COMMON,
  SAT_UNIT_CODES,
  SAT_TAX_OBJECTS,
  SAT_CFDI_USE,
  SAT_PAYMENT_METHODS,
  SAT_PAYMENT_FORMS,
  SAT_TAX_REGIMES,
  SAT_EXPORT_TYPES,
} from "@shared/sat-catalogs";
import { SATCombobox } from "@/components/ui/sat-combobox";

type InvoiceFormData = z.infer<typeof insertInvoiceSchema>;

interface InvoiceLineItem {
  tempId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  satProductCode: string;
  satUnitCode: string;
  satTaxObject: string;
  identification: string;
  applyTax: boolean;
  taxRate: string;
  taxAmount: string;
}

export default function InvoicesCreatePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { 
      tempId: '1', 
      description: '', 
      quantity: '1', 
      unitPrice: '0', 
      amount: '0',
      satProductCode: '01010101',
      satUnitCode: 'E48',
      satTaxObject: '02',
      identification: '',
      applyTax: false,
      taxRate: '0.16',
      taxAmount: '0'
    }
  ]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: operations = [] } = useQuery<Operation[]>({
    queryKey: ["/api/operations"],
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(insertInvoiceSchema),
    defaultValues: {
      folio: "",
      issuerRFC: "",
      issuerName: "",
      recipientRFC: "",
      recipientName: "",
      recipientRegimenFiscal: "",
      recipientCodigoPostal: "",
      lugarExpedicion: "",
      metodoPago: "PPD",
      formaPago: "99",
      ordenCompra: "",
      tipoComprobante: "I",
      usoCFDI: "G03",
      exportacion: "01",
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData & { items: any[] }) => {
      return apiRequest("POST", "/api/invoices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Factura creada exitosamente" });
      navigate("/invoices");
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear factura",
        description: error.message || "Ocurrió un error al crear la factura",
        variant: "destructive",
      });
    },
  });

  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      form.setValue("clientId", clientId);
      if (client.rfc) form.setValue("recipientRFC", client.rfc);
      if (client.razonSocial) form.setValue("recipientName", client.razonSocial);
      if (client.regimenFiscal) form.setValue("recipientRegimenFiscal", client.regimenFiscal);
      if (client.codigoPostal) form.setValue("recipientCodigoPostal", client.codigoPostal);
      if (client.usoCFDI) form.setValue("usoCFDI", client.usoCFDI);
    }
  };

  const addLineItem = () => {
    const newId = (Math.max(...lineItems.map(i => parseInt(i.tempId)), 0) + 1).toString();
    setLineItems([...lineItems, {
      tempId: newId,
      description: '',
      quantity: '1',
      unitPrice: '0',
      amount: '0',
      satProductCode: '01010101',
      satUnitCode: 'E48',
      satTaxObject: '02',
      identification: '',
      applyTax: false,
      taxRate: '0.16',
      taxAmount: '0'
    }]);
  };

  const removeLineItem = (tempId: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.tempId !== tempId));
    }
  };

  const updateLineItem = (tempId: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems(items => items.map(item => {
      if (item.tempId === tempId) {
        const updated = { ...item, [field]: value };
        
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = parseFloat(field === 'quantity' ? value : updated.quantity) || 0;
          const price = parseFloat(field === 'unitPrice' ? value : updated.unitPrice) || 0;
          updated.amount = (qty * price).toFixed(2);
          
          if (updated.applyTax) {
            const taxRate = parseFloat(updated.taxRate) || 0;
            updated.taxAmount = (qty * price * taxRate).toFixed(2);
          }
        }
        
        if (field === 'applyTax') {
          if (value) {
            const qty = parseFloat(updated.quantity) || 0;
            const price = parseFloat(updated.unitPrice) || 0;
            const taxRate = parseFloat(updated.taxRate) || 0;
            updated.taxAmount = (qty * price * taxRate).toFixed(2);
          } else {
            updated.taxAmount = '0';
          }
        }
        
        if (field === 'taxRate' && updated.applyTax) {
          const qty = parseFloat(updated.quantity) || 0;
          const price = parseFloat(updated.unitPrice) || 0;
          const taxRate = parseFloat(value) || 0;
          updated.taxAmount = (qty * price * taxRate).toFixed(2);
        }
        
        return updated;
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalTax = lineItems.reduce((sum, item) => sum + (parseFloat(item.taxAmount) || 0), 0);
    const total = subtotal + totalTax;
    return { subtotal, totalTax, total };
  };

  const onSubmit = async (data: InvoiceFormData) => {
    const { subtotal, totalTax, total } = calculateTotals();
    
    const invoiceData = {
      ...data,
      subtotal: subtotal.toString(),
      tax: totalTax.toString(),
      total: total.toString(),
      status: 'draft',
      items: lineItems.map(item => ({
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        amount: parseFloat(item.amount),
        satProductCode: item.satProductCode,
        satUnitCode: item.satUnitCode,
        satTaxObject: item.satTaxObject,
        identification: item.identification || null,
        applyTax: item.applyTax,
        taxRate: item.applyTax ? parseFloat(item.taxRate) : 0,
        taxAmount: item.applyTax ? parseFloat(item.taxAmount) : 0,
      }))
    };

    createInvoiceMutation.mutate(invoiceData);
  };

  const { subtotal, totalTax, total } = calculateTotals();

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/invoices")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nueva Factura</h1>
          <p className="text-sm text-muted-foreground">Crear nueva factura CFDI 4.0</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Selector de Cliente y Operación */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={handleClientSelect} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-client">
                            <SelectValue placeholder="Seleccionar cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name} {client.rfc && `(${client.rfc})`}
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
                  name="operationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operación (Opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-operation">
                            <SelectValue placeholder="Seleccionar operación" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {operations.map(op => (
                            <SelectItem key={op.id} value={op.id}>
                              {op.name}
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
                  name="folio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Folio</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Auto" data-testid="input-folio" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Datos del Emisor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos del Emisor</CardTitle>
              <CardDescription className="text-xs">Información fiscal de quien emite la factura</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="issuerRFC"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">RFC Emisor*</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-8 text-sm" placeholder="RFC" data-testid="input-issuer-rfc" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="issuerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Nombre/Razón Social*</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-8 text-sm" placeholder="Nombre fiscal" data-testid="input-issuer-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="issuerRegimenFiscal"
                  render={({ field }) => (
                    <FormItem>
                      <SATCombobox
                        catalog={SAT_TAX_REGIMES}
                        value={field.value || "601"}
                        onChange={field.onChange}
                        label="Régimen Fiscal*"
                        placeholder="Seleccionar"
                        allowCustom={false}
                        required={true}
                        catalogName="regimen-fiscal"
                        compact={true}
                      />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lugarExpedicion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Lugar Expedición*</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-8 text-sm" placeholder="CP" data-testid="input-lugar-expedicion" />
                      </FormControl>
                      <FormDescription className="text-xs">CP</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Datos del Receptor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos del Receptor</CardTitle>
              <CardDescription className="text-xs">Información fiscal del cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="recipientRFC"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">RFC Receptor*</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-8 text-sm" placeholder="RFC" data-testid="input-recipient-rfc" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="recipientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Nombre/Razón Social*</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-8 text-sm" placeholder="Nombre fiscal" data-testid="input-recipient-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="recipientRegimenFiscal"
                  render={({ field }) => (
                    <FormItem>
                      <SATCombobox
                        catalog={SAT_TAX_REGIMES}
                        value={field.value || ""}
                        onChange={field.onChange}
                        label="Régimen Fiscal"
                        placeholder="Seleccionar"
                        allowCustom={false}
                        catalogName="recipient-regimen-fiscal"
                        compact={true}
                      />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipientCodigoPostal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Código Postal</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} className="h-8 text-sm" placeholder="CP" data-testid="input-recipient-cp" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="usoCFDI"
                  render={({ field }) => (
                    <FormItem>
                      <SATCombobox
                        catalog={SAT_CFDI_USE}
                        value={field.value || "G03"}
                        onChange={field.onChange}
                        label="Uso del CFDI*"
                        placeholder="Seleccionar"
                        allowCustom={false}
                        required={true}
                        catalogName="uso-cfdi"
                        compact={true}
                      />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="metodoPago"
                  render={({ field }) => (
                    <FormItem>
                      <SATCombobox
                        catalog={SAT_PAYMENT_METHODS}
                        value={field.value || "PPD"}
                        onChange={field.onChange}
                        label="Método de Pago*"
                        placeholder="Seleccionar"
                        allowCustom={false}
                        required={true}
                        catalogName="metodo-pago"
                        compact={true}
                      />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="formaPago"
                  render={({ field }) => (
                    <FormItem>
                      <SATCombobox
                        catalog={SAT_PAYMENT_FORMS}
                        value={field.value || "99"}
                        onChange={field.onChange}
                        label="Forma de Pago*"
                        placeholder="Seleccionar"
                        allowCustom={false}
                        required={true}
                        catalogName="forma-pago"
                        compact={true}
                      />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="exportacion"
                  render={({ field }) => (
                    <FormItem>
                      <SATCombobox
                        catalog={SAT_EXPORT_TYPES}
                        value={field.value || "01"}
                        onChange={field.onChange}
                        label="Exportación*"
                        placeholder="Seleccionar"
                        allowCustom={false}
                        required={true}
                        catalogName="exportacion"
                        compact={true}
                      />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Conceptos / Items */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Conceptos</CardTitle>
                  <CardDescription className="text-xs">Items de la factura</CardDescription>
                </div>
                <Button type="button" size="sm" onClick={addLineItem} data-testid="button-add-item">
                  <Plus className="w-3 h-3 mr-1" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Descripción</th>
                      <th className="text-left p-2 font-medium w-24">Cód. SAT</th>
                      <th className="text-left p-2 font-medium w-20">Unidad</th>
                      <th className="text-right p-2 font-medium w-16">Cant.</th>
                      <th className="text-right p-2 font-medium w-24">P. Unit.</th>
                      <th className="text-right p-2 font-medium w-24">Importe</th>
                      <th className="text-left p-2 font-medium w-24">Obj. Imp.</th>
                      <th className="text-center p-2 font-medium w-14">IVA</th>
                      <th className="text-right p-2 font-medium w-16">Tasa</th>
                      <th className="text-right p-2 font-medium w-24">Imp. IVA</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr key={item.tempId} className="border-t">
                        <td className="p-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(item.tempId, 'description', e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Descripción del servicio"
                            data-testid={`input-description-${index}`}
                          />
                        </td>
                        <td className="p-2">
                          <SATCombobox
                            catalog={SAT_PRODUCT_CODES_COMMON}
                            value={item.satProductCode}
                            onChange={(val) => updateLineItem(item.tempId, 'satProductCode', val)}
                            placeholder="Código"
                            allowCustom={true}
                            catalogName={`product-code-${index}`}
                            compact={true}
                            noLabel={true}
                          />
                        </td>
                        <td className="p-2">
                          <SATCombobox
                            catalog={SAT_UNIT_CODES}
                            value={item.satUnitCode}
                            onChange={(val) => updateLineItem(item.tempId, 'satUnitCode', val)}
                            placeholder="Unidad"
                            allowCustom={true}
                            catalogName={`unit-code-${index}`}
                            compact={true}
                            noLabel={true}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.tempId, 'quantity', e.target.value)}
                            className="h-7 text-xs text-right"
                            data-testid={`input-quantity-${index}`}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(item.tempId, 'unitPrice', e.target.value)}
                            className="h-7 text-xs text-right"
                            data-testid={`input-unit-price-${index}`}
                          />
                        </td>
                        <td className="p-2 text-right text-xs font-medium">${parseFloat(item.amount).toFixed(2)}</td>
                        <td className="p-2">
                          <SATCombobox
                            catalog={SAT_TAX_OBJECTS}
                            value={item.satTaxObject}
                            onChange={(val) => updateLineItem(item.tempId, 'satTaxObject', val)}
                            placeholder="Obj"
                            allowCustom={false}
                            catalogName={`tax-object-${index}`}
                            compact={true}
                            noLabel={true}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={item.applyTax}
                            onCheckedChange={(checked) => updateLineItem(item.tempId, 'applyTax', checked)}
                            data-testid={`checkbox-tax-${index}`}
                          />
                        </td>
                        <td className="p-2">
                          {item.applyTax && (
                            <Input
                              type="number"
                              step="0.01"
                              value={item.taxRate}
                              onChange={(e) => updateLineItem(item.tempId, 'taxRate', e.target.value)}
                              className="h-7 text-xs text-right"
                              data-testid={`input-tax-rate-${index}`}
                            />
                          )}
                        </td>
                        <td className="p-2 text-right text-xs font-medium">
                          {item.applyTax ? `$${parseFloat(item.taxAmount).toFixed(2)}` : '-'}
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeLineItem(item.tempId)}
                            disabled={lineItems.length === 1}
                            data-testid={`button-remove-${index}`}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totales */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA:</span>
                    <span className="font-medium">${totalTax.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total:</span>
                    <span className="text-primary">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/invoices")}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createInvoiceMutation.isPending}
              data-testid="button-save"
            >
              <Save className="w-4 h-4 mr-2" />
              {createInvoiceMutation.isPending ? "Guardando..." : "Guardar Factura"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
