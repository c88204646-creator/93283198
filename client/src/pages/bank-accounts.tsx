import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Edit, Trash2, DollarSign, Building2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBankAccountSchema, type BankAccount, type InsertBankAccount } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";

type BankAccountFormData = z.infer<typeof insertBankAccountSchema>;

export default function BankAccountsPage() {
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const { toast } = useToast();

  const { data: accounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const form = useForm<BankAccountFormData>({
    resolver: zodResolver(insertBankAccountSchema),
    defaultValues: {
      name: "",
      accountNumber: "",
      clabe: "",
      currency: "MXN",
      bankName: "",
      accountType: "checking",
      initialBalance: "0.00",
      currentBalance: "0.00",
      isActive: true,
      notes: "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: BankAccountFormData) => {
      if (editingAccount) {
        return apiRequest("PATCH", `/api/bank-accounts/${editingAccount.id}`, data);
      } else {
        return apiRequest("POST", "/api/bank-accounts", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      setIsDialogOpen(false);
      setEditingAccount(null);
      form.reset();
      toast({
        title: editingAccount ? "Cuenta actualizada" : "Cuenta creada",
        description: `La cuenta bancaria ha sido ${editingAccount ? 'actualizada' : 'creada'} exitosamente`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la cuenta bancaria",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bank-accounts/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({
        title: "Cuenta eliminada",
        description: "La cuenta bancaria ha sido eliminada exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la cuenta bancaria",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    form.reset({
      name: account.name,
      accountNumber: account.accountNumber,
      clabe: account.clabe || "",
      currency: account.currency,
      bankName: account.bankName || "",
      accountType: account.accountType || "checking",
      initialBalance: account.initialBalance,
      currentBalance: account.currentBalance,
      isActive: account.isActive,
      notes: account.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (account: BankAccount) => {
    if (confirm(`¿Estás seguro de eliminar la cuenta "${account.name}"? Esta acción no se puede deshacer.`)) {
      deleteMutation.mutate(account.id);
    }
  };

  const handleNewAccount = () => {
    setEditingAccount(null);
    form.reset({
      name: "",
      accountNumber: "",
      clabe: "",
      currency: "MXN",
      bankName: "",
      accountType: "checking",
      initialBalance: "0.00",
      currentBalance: "0.00",
      isActive: true,
      notes: "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: BankAccountFormData) => {
    saveMutation.mutate(data);
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$';
      case 'MXN': return '$';
      case 'EUR': return '€';
      default: return currency;
    }
  };

  const getAccountTypeLabel = (type: string | null) => {
    switch (type) {
      case 'checking': return 'Cuenta Corriente';
      case 'savings': return 'Cuenta de Ahorro';
      case 'investment': return 'Cuenta de Inversión';
      default: return type || 'N/A';
    }
  };

  // Calculate totals by currency
  const totalsByCurrency = accounts.reduce((acc, account) => {
    if (!acc[account.currency]) {
      acc[account.currency] = 0;
    }
    acc[account.currency] += parseFloat(account.currentBalance);
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Cargando cuentas bancarias...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            Cuentas Bancarias
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus cuentas bancarias y controla tus finanzas
          </p>
        </div>
        <Button onClick={handleNewAccount} data-testid="button-new-account">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cuenta
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cuentas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">
              {accounts.filter(a => a.isActive).length} activas
            </p>
          </CardContent>
        </Card>

        {Object.entries(totalsByCurrency).map(([currency, total]) => (
          <Card key={currency}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo {currency}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {getCurrencySymbol(currency)}{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {accounts.filter(a => a.currency === currency).length} cuenta(s)
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Accounts Table */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">No hay cuentas bancarias registradas</p>
            <Button onClick={handleNewAccount} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primera Cuenta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Número de Cuenta</TableHead>
                  <TableHead>CLABE</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Divisa</TableHead>
                  <TableHead className="text-right">Saldo Actual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow 
                    key={account.id} 
                    data-testid={`row-account-${account.id}`}
                    onClick={() => navigate(`/bank-accounts/${account.id}`)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>{account.bankName || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-sm">{account.accountNumber}</TableCell>
                    <TableCell className="font-mono text-sm">{account.clabe || 'N/A'}</TableCell>
                    <TableCell>{getAccountTypeLabel(account.accountType)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.currency}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {getCurrencySymbol(account.currency)}
                      {parseFloat(account.currentBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {account.isActive ? (
                        <Badge className="bg-green-100 text-green-800">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Inactiva</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(account)}
                          data-testid={`button-edit-account-${account.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(account)}
                          data-testid={`button-delete-account-${account.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount 
                ? 'Modifica los detalles de la cuenta bancaria' 
                : 'Agrega una nueva cuenta bancaria al sistema'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nombre de la Cuenta *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Cuenta Principal USD" {...field} data-testid="input-account-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: BBVA" {...field} value={field.value || ''} data-testid="input-bank-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Cuenta</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          {...field}
                          value={field.value || 'checking'}
                          data-testid="select-account-type"
                        >
                          <option value="checking">Cuenta Corriente</option>
                          <option value="savings">Cuenta de Ahorro</option>
                          <option value="investment">Cuenta de Inversión</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Cuenta *</FormLabel>
                      <FormControl>
                        <Input placeholder="0123456789" {...field} data-testid="input-account-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clabe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CLABE Interbancaria</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="012345678901234567" 
                          maxLength={18}
                          {...field} 
                          value={field.value || ''} 
                          data-testid="input-clabe" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Divisa *</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          {...field}
                          data-testid="select-currency"
                        >
                          <option value="MXN">MXN - Peso Mexicano</option>
                          <option value="USD">USD - Dólar Estadounidense</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="CAD">CAD - Dólar Canadiense</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="initialBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saldo Inicial</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-initial-balance" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currentBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saldo Actual</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-current-balance" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-2">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Cuenta Activa</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Desactiva la cuenta si ya no está en uso
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Notas adicionales sobre esta cuenta..." 
                          {...field} 
                          value={field.value || ''} 
                          data-testid="input-notes" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={saveMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-account">
                  {saveMutation.isPending ? 'Guardando...' : editingAccount ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
