import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, User, Mail, Phone, MapPin, TrendingUp, FileText, Package, DollarSign, Calendar, Building2, Receipt, FileCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { Client, Operation, Invoice, Proposal } from "@shared/schema";

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id;
  const [, setLocation] = useLocation();

  // Fetch client details
  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['/api/clients', clientId],
    enabled: !!clientId,
  });

  // Fetch operations for this client
  const { data: allOperations = [] } = useQuery<Operation[]>({
    queryKey: ['/api/operations'],
  });

  // Fetch invoices
  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  // Fetch proposals
  const { data: allProposals = [] } = useQuery<Proposal[]>({
    queryKey: ['/api/proposals'],
  });

  if (clientLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Cargando información del cliente...</div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="text-center py-12">
            <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">Cliente no encontrado</p>
            <Link href="/clients">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Clientes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter data for this client
  const operations = allOperations.filter(op => op.clientId === clientId);
  const invoices = allInvoices.filter(inv => inv.clientId === clientId);
  const proposals = allProposals.filter(prop => prop.clientId === clientId);

  // Calculate statistics
  const totalOperations = operations.length;
  const activeOperations = operations.filter(op => op.status !== 'completed' && op.status !== 'cancelled').length;
  const completedOperations = operations.filter(op => op.status === 'completed').length;

  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending').length;
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
  const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.total), 0);
  const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + parseFloat(inv.total), 0);

  const totalProposals = proposals.length;
  const acceptedProposals = proposals.filter(prop => prop.status === 'accepted').length;
  const pendingProposals = proposals.filter(prop => prop.status === 'pending').length;

  // Operations by status
  const operationsByStatus = operations.reduce((acc, op) => {
    const status = op.status || 'pending';
    if (!acc[status]) acc[status] = 0;
    acc[status]++;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(operationsByStatus).map(([status, count]) => ({
    name: getStatusLabel(status),
    value: count,
  }));

  // Monthly operations trend (last 6 months)
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthOperations = operations.filter(op => {
      const opDate = new Date(op.createdAt);
      return opDate.getFullYear() === date.getFullYear() && opDate.getMonth() === date.getMonth();
    });
    return {
      month: format(date, 'MMM yyyy', { locale: es }),
      operations: monthOperations.length,
    };
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      'in-progress': 'En Proceso',
      'in-transit': 'En Tránsito',
      delivered: 'Entregado',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  }

  function getStatusBadgeVariant(status: string) {
    const variants: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      potential: 'bg-blue-100 text-blue-800',
    };
    return variants[status] || 'bg-gray-100 text-gray-800';
  }

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$';
      case 'MXN': return '$';
      case 'EUR': return '€';
      case 'ARS': return '$';
      default: return currency;
    }
  };

  const formatCurrency = (amount: number) => {
    return `${getCurrencySymbol(client.currency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${client.currency}`;
  };

  return (
    <div className="container mx-auto py-4 space-y-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <Link href="/clients">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="w-6 h-6 text-primary" />
              {client.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              Cliente desde {format(new Date(client.createdAt), "dd MMM yyyy", { locale: es })}
            </p>
          </div>
        </div>
        <Badge className={getStatusBadgeVariant(client.status)}>
          {client.status === 'active' ? 'Activo' : client.status === 'inactive' ? 'Inactivo' : 'Potencial'}
        </Badge>
      </div>

      {/* Statistics Cards compactas */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Operaciones</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold">{totalOperations}</div>
            <p className="text-xs text-muted-foreground">{activeOperations} activas</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Facturas</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">{paidInvoices} pagadas</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-green-600">{formatCurrency(totalInvoiceAmount)}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(paidAmount)} cobrado</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cotizaciones</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold">{totalProposals}</div>
            <p className="text-xs text-muted-foreground">{acceptedProposals} aceptadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="info" className="gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Información</span>
          </TabsTrigger>
          <TabsTrigger value="operations" className="gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Operaciones</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Facturas</span>
          </TabsTrigger>
          <TabsTrigger value="proposals" className="gap-2">
            <FileCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Cotizaciones</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Análisis</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-3 mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4" />
                  Información de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline flex-1 truncate">
                    {client.email}
                  </a>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                      {client.phone}
                    </a>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <p className="flex-1">{client.address}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-muted/30 border-t">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs">{client.currency}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">(No editable)</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  Datos Fiscales (CFDI)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {client.rfc && (
                  <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground font-medium">RFC:</span>
                    <span className="font-mono">{client.rfc}</span>
                  </div>
                )}
                {client.razonSocial && (
                  <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground font-medium">Razón Social:</span>
                    <span className="text-right flex-1">{client.razonSocial}</span>
                  </div>
                )}
                {client.regimenFiscal && (
                  <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground font-medium">Régimen Fiscal:</span>
                    <span className="font-mono">{client.regimenFiscal}</span>
                  </div>
                )}
                {client.usoCFDI && (
                  <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground font-medium">Uso CFDI:</span>
                    <span className="font-mono">{client.usoCFDI}</span>
                  </div>
                )}
                {client.codigoPostal && (
                  <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground font-medium">Código Postal:</span>
                    <span>{client.codigoPostal}</span>
                  </div>
                )}
                {(client.ciudad || client.estado) && (
                  <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground font-medium">Ubicación:</span>
                    <span>{[client.ciudad, client.estado].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {client.pais && (
                  <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground font-medium">País:</span>
                    <span>{client.pais}</span>
                  </div>
                )}
                {!client.rfc && !client.razonSocial && !client.regimenFiscal && !client.usoCFDI && (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">Sin datos fiscales registrados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {client.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  Notas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{client.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="operations" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Operaciones del Cliente</CardTitle>
                  <CardDescription className="text-xs">Todas las operaciones asociadas a {client.name}</CardDescription>
                </div>
                <Link href="/operations">
                  <Button variant="outline" size="sm">
                    Ver Todas
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {operations.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">No hay operaciones registradas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.map((operation) => (
                      <TableRow key={operation.id} data-testid={`row-operation-${operation.id}`}>
                        <TableCell className="font-medium">{operation.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{operation.operationType}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{operation.shippingMode}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getStatusLabel(operation.status)}</Badge>
                        </TableCell>
                        <TableCell>{format(new Date(operation.createdAt), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setLocation(`/operations/${operation.id}`)}
                          >
                            Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Facturas del Cliente</CardTitle>
                  <CardDescription className="text-xs">Historial de facturación de {client.name}</CardDescription>
                </div>
                <Link href="/invoices">
                  <Button variant="outline" size="sm">
                    Ver Todas
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">No hay facturas registradas</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-2 md:grid-cols-3 mb-4">
                    <div className="p-3 border rounded-lg">
                      <div className="text-xs text-muted-foreground mb-0.5">Total Facturado</div>
                      <div className="text-lg font-bold">{formatCurrency(totalInvoiceAmount)}</div>
                    </div>
                    <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950">
                      <div className="text-xs text-muted-foreground mb-0.5">Cobrado</div>
                      <div className="text-lg font-bold text-green-600">{formatCurrency(paidAmount)}</div>
                    </div>
                    <div className="p-3 border rounded-lg bg-orange-50 dark:bg-orange-950">
                      <div className="text-xs text-muted-foreground mb-0.5">Pendiente</div>
                      <div className="text-lg font-bold text-orange-600">{formatCurrency(pendingAmount)}</div>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(invoice.total))}</TableCell>
                          <TableCell>
                            <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                              {invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Pendiente' : invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              Ver Detalles
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Cotizaciones del Cliente</CardTitle>
                  <CardDescription className="text-xs">Cotizaciones enviadas a {client.name}</CardDescription>
                </div>
                <Link href="/proposals">
                  <Button variant="outline" size="sm">
                    Ver Todas
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {proposals.length === 0 ? (
                <div className="text-center py-8">
                  <FileCheck className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">No hay cotizaciones registradas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Válida hasta</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposals.map((proposal) => (
                      <TableRow key={proposal.id}>
                        <TableCell className="font-medium">{proposal.proposalNumber}</TableCell>
                        <TableCell>{proposal.title}</TableCell>
                        <TableCell>{formatCurrency(parseFloat(proposal.total))}</TableCell>
                        <TableCell>
                          <Badge variant={proposal.status === 'accepted' ? 'default' : 'secondary'}>
                            {proposal.status === 'accepted' ? 'Aceptada' : proposal.status === 'pending' ? 'Pendiente' : proposal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(proposal.validUntil), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-3 mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Tendencia de Operaciones</CardTitle>
                <CardDescription className="text-xs">Operaciones creadas por mes (últimos 6 meses)</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="operations" stroke="#3b82f6" strokeWidth={2} name="Operaciones" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {statusData.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Operaciones por Estado</CardTitle>
                  <CardDescription className="text-xs">Distribución actual de operaciones</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}