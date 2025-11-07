import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, User, Mail, Phone, MapPin, TrendingUp, FileText, Package, DollarSign, Calendar, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0);
  const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0);
  const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0);

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
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <User className="w-8 h-8 text-primary" />
              {client.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Cliente desde {format(new Date(client.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
        </div>
        <Badge className={getStatusBadgeVariant(client.status)}>
          {client.status === 'active' ? 'Activo' : client.status === 'inactive' ? 'Inactivo' : 'Potencial'}
        </Badge>
      </div>

      {/* Client Information */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Información de Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                {client.email}
              </a>
            </div>
            {client.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Teléfono:</span>
                <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                  {client.phone}
                </a>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Dirección:</span>
                  <p className="mt-1">{client.address}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm pt-2 border-t">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Divisa:</span>
              <Badge variant="outline">{client.currency}</Badge>
              <span className="text-xs text-muted-foreground">(No editable)</span>
            </div>
          </CardContent>
        </Card>

        {client.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operaciones Totales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOperations}</div>
            <p className="text-xs text-muted-foreground">
              {activeOperations} activas, {completedOperations} completadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">
              {paidInvoices} pagadas, {pendingInvoices} pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalInvoiceAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(paidAmount)} cobrado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cotizaciones</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProposals}</div>
            <p className="text-xs text-muted-foreground">
              {acceptedProposals} aceptadas, {pendingProposals} pendientes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Operations Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Operaciones</CardTitle>
            <CardDescription>Operaciones creadas por mes (últimos 6 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
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

        {/* Operations by Status */}
        {statusData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Operaciones por Estado</CardTitle>
              <CardDescription>Distribución actual de operaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
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

      {/* Recent Operations */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Operaciones Recientes</CardTitle>
              <CardDescription>Últimas operaciones de este cliente</CardDescription>
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
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No hay operaciones registradas para este cliente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.slice(0, 10).map((operation) => (
                  <TableRow key={operation.id} data-testid={`row-operation-${operation.id}`}>
                    <TableCell className="font-medium">{operation.referenceNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {operation.operationType === 'import' ? 'Importación' : 'Exportación'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getStatusLabel(operation.status)}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(operation.createdAt), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/operations/${operation.id}`}>
                        <Button variant="ghost" size="sm">
                          Ver Detalles
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoices Summary */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Facturación</CardTitle>
            <CardDescription>Estado financiero del cliente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Total Facturado</div>
                <div className="text-2xl font-bold">{formatCurrency(totalInvoiceAmount)}</div>
              </div>
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                <div className="text-sm text-muted-foreground mb-1">Cobrado</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</div>
              </div>
              <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950">
                <div className="text-sm text-muted-foreground mb-1">Pendiente</div>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(pendingAmount)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
