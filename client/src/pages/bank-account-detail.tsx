import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, Download, Building2, CreditCard, Brain, Sparkles, RefreshCw } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { BankAccount, Payment, Expense } from "@shared/schema";

type Transaction = {
  id: string;
  date: Date;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  reference?: string;
  category?: string;
};

export default function BankAccountDetailPage() {
  const params = useParams();
  const accountId = params.id;

  // Fetch account details
  const { data: account, isLoading: accountLoading } = useQuery<BankAccount>({
    queryKey: ['/api/bank-accounts', accountId],
    enabled: !!accountId,
  });

  // Fetch payments (income)
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/bank-accounts', accountId, 'payments'],
    enabled: !!accountId,
  });

  // Fetch expenses (outgoing)
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ['/api/bank-accounts', accountId, 'expenses'],
    enabled: !!accountId,
  });

  // Fetch AI financial analysis
  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<any>({
    queryKey: ['/api/bank-accounts', accountId, 'analysis'],
    enabled: !!accountId && !!(payments.length > 0 || expenses.length > 0),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Mutation to refresh analysis
  const refreshAnalysisMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/bank-accounts/${accountId}/analysis/refresh`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-accounts', accountId, 'analysis'] });
      refetchAnalysis();
    },
  });

  if (accountLoading || paymentsLoading || expensesLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Cargando detalles de la cuenta...</div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">Cuenta bancaria no encontrada</p>
            <Link href="/bank-accounts">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Cuentas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Combine and sort transactions
  const transactions: Transaction[] = [
    ...payments.map(p => ({
      id: p.id,
      date: new Date(p.paymentDate),
      type: 'income' as const,
      amount: parseFloat(p.amount),
      description: `Pago recibido - ${p.paymentMethod}`,
      reference: p.reference || undefined,
    })),
    ...expenses.map(e => ({
      id: e.id,
      date: new Date(e.date),
      type: 'expense' as const,
      amount: parseFloat(e.amount),
      description: e.description,
      category: e.category,
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Calculate current month stats
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const previousMonthStart = startOfMonth(subMonths(now, 1));
  const previousMonthEnd = endOfMonth(subMonths(now, 1));

  const currentMonthTransactions = transactions.filter(t => 
    t.date >= currentMonthStart && t.date <= currentMonthEnd
  );
  const previousMonthTransactions = transactions.filter(t => 
    t.date >= previousMonthStart && t.date <= previousMonthEnd
  );

  const currentMonthIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const currentMonthExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const previousMonthIncome = previousMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const previousMonthExpenses = previousMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const previousMonthBalance = parseFloat(account.currentBalance) - currentMonthIncome + currentMonthExpenses;

  // Prepare chart data - Last 6 months
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const monthDate = subMonths(now, 5 - i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    const monthTransactions = transactions.filter(t => 
      t.date >= monthStart && t.date <= monthEnd
    );
    
    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      month: format(monthDate, 'MMM', { locale: es }),
      income,
      expense,
      net: income - expense,
    };
  });

  // Category breakdown for pie chart
  const categoryData = expenses.reduce((acc, expense) => {
    const category = expense.category || 'other';
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += parseFloat(expense.amount);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categoryData).map(([name, value]) => ({
    name: getCategoryLabel(name),
    value,
  }));

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$';
      case 'MXN': return '$';
      case 'EUR': return '€';
      default: return currency;
    }
  };

  function getCategoryLabel(category: string) {
    switch (category) {
      case 'travel': return 'Viaje';
      case 'supplies': return 'Suministros';
      case 'equipment': return 'Equipo';
      case 'services': return 'Servicios';
      case 'other': return 'Otro';
      default: return category;
    }
  }

  const formatCurrency = (amount: number) => {
    return `${getCurrencySymbol(account.currency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getAccountTypeLabel = (type: string | null) => {
    switch (type) {
      case 'checking': return 'Cuenta Corriente';
      case 'savings': return 'Cuenta de Ahorro';
      case 'investment': return 'Cuenta de Inversión';
      default: return type || 'N/A';
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bank-accounts">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="w-8 h-8 text-primary" />
              {account.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {account.bankName} • {account.accountNumber} • {getAccountTypeLabel(account.accountType)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {account.isActive ? (
            <Badge className="bg-green-100 text-green-800">Activa</Badge>
          ) : (
            <Badge variant="secondary">Inactiva</Badge>
          )}
          <Badge variant="outline">{account.currency}</Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(parseFloat(account.currentBalance))}</div>
            <p className="text-xs text-muted-foreground">
              Saldo inicial: {formatCurrency(parseFloat(account.initialBalance))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(currentMonthIncome)}</div>
            <p className="text-xs text-muted-foreground">
              {previousMonthIncome > 0 ? (
                <>
                  {currentMonthIncome >= previousMonthIncome ? '+' : ''}
                  {((currentMonthIncome - previousMonthIncome) / previousMonthIncome * 100).toFixed(1)}% vs mes anterior
                </>
              ) : (
                'Sin comparativa'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(currentMonthExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              {previousMonthExpenses > 0 ? (
                <>
                  {currentMonthExpenses >= previousMonthExpenses ? '+' : ''}
                  {((currentMonthExpenses - previousMonthExpenses) / previousMonthExpenses * 100).toFixed(1)}% vs mes anterior
                </>
              ) : (
                'Sin comparativa'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Mensual</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(currentMonthIncome - currentMonthExpenses) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(currentMonthIncome - currentMonthExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Saldo mes anterior: {formatCurrency(previousMonthBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Financial Analysis */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Análisis Financiero con IA
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                </CardTitle>
                <CardDescription>
                  Insights inteligentes generados por experto financiero empresarial
                </CardDescription>
              </div>
            </div>
            {(payments.length > 0 || expenses.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshAnalysisMutation.mutate()}
                disabled={refreshAnalysisMutation.isPending}
                data-testid="button-refresh-analysis"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshAnalysisMutation.isPending ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 && expenses.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm font-medium text-muted-foreground mb-2">
                No hay suficientes datos para generar análisis
              </p>
              <p className="text-xs text-muted-foreground">
                Registra algunos pagos o gastos en esta cuenta bancaria para obtener un análisis financiero inteligente con IA
              </p>
            </div>
          ) : analysisLoading ? (
            <div className="space-y-3">
              <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
            </div>
          ) : analysis && analysis.status === 'ready' ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {analysis.analysis}
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>📊 {analysis.paymentsAnalyzed} ingresos analizados</span>
                  <span>💸 {analysis.expensesAnalyzed} gastos analizados</span>
                </div>
                <span>
                  Generado: {format(new Date(analysis.generatedAt), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground mb-4">
                Generando análisis inteligente de tu cuenta bancaria...
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAnalysis()}
                data-testid="button-generate-analysis"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generar Análisis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Income vs Expenses Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos vs Egresos (Últimos 6 meses)</CardTitle>
            <CardDescription>Comparativa mensual de movimientos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Ingresos" />
                <Bar dataKey="expense" fill="#ef4444" name="Egresos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Net Balance Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Balance Neto</CardTitle>
            <CardDescription>Balance mensual (Ingresos - Egresos)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} name="Balance Neto" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Expense Categories Pie Chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Gastos por Categoría</CardTitle>
            <CardDescription>Análisis de gastos totales</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Historial de Movimientos</CardTitle>
              <CardDescription>Todos los ingresos y egresos de esta cuenta</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No hay movimientos registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Referencia/Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                    <TableCell>
                      {format(transaction.date, 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {transaction.type === 'income' ? (
                        <Badge className="bg-green-100 text-green-800">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Ingreso
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          Egreso
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {transaction.reference || (transaction.category ? getCategoryLabel(transaction.category) : '-')}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {account.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{account.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
